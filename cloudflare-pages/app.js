// app.js — 纯前端 XMind → Markdown 转换（Cloudflare Pages 静态版）
// 移植自 app.py：xmind 是 zip，内含 content.json（新版）或 content.xml（经典版）。
// 全部在浏览器内完成，无后端、无网络请求。
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const drop = $("drop"), fileInput = $("file"), filebar = $("filebar");
  const convertBtn = $("convert"), copyBtn = $("copy"), downloadBtn = $("download");
  const alertBox = $("alert"), result = $("result"), stats = $("stats");
  let currentFile = null, currentMd = null, currentName = "mindmap";

  const MAX_SIZE = 30 * 1024 * 1024; // 30MB

  function showAlert(msg) {
    alertBox.textContent = msg;
    alertBox.classList.add("show");
  }
  function clearAlert() { alertBox.classList.remove("show"); }

  // ----------------------------- 解析核心 -----------------------------
  function pushLine(depth, title, lines) {
    if (depth === 0) lines.push("# " + title + "\n");
    else if (depth === 1) lines.push("## " + title + "\n");
    else if (depth === 2) lines.push("### " + title + "\n");
    else lines.push("  ".repeat(depth - 3) + "- " + title);
  }

  // 新版 content.json
  function emitJson(node, depth, lines, st) {
    st.nodes += 1;
    const title = (node.title || "").trim();
    pushLine(depth, title, lines);
    const children = (node.children && node.children.attached) || [];
    for (const c of children) emitJson(c, depth + 1, lines, st);
  }

  function parseJson(data, lines, st) {
    for (const sheet of data) {
      st.sheets += 1;
      emitJson(sheet.rootTopic, 0, lines, st);
      const attached =
        (sheet.rootTopic && sheet.rootTopic.children && sheet.rootTopic.children.attached) || [];
      st.topics += attached.length;
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    }
    return true;
  }

  // 经典 content.xml：<node TEXT="..."> 递归
  function localName(el) { return el.localName; }

  function parseXml(rawText, lines, st) {
    const doc = new DOMParser().parseFromString(rawText, "text/xml");
    if (doc.querySelector("parsererror")) throw new Error("XML 解析失败");
    const root = doc.documentElement;

    function findNodes(el) {
      return Array.from(el.children).filter((c) => c.localName === "node");
    }

    let roots;
    if (root.localName === "node") {
      roots = [root];
    } else {
      roots = findNodes(root);
      if (roots.length === 0) {
        const topics = Array.from(root.getElementsByTagName("*")).filter(
          (e) => e.localName === "topic"
        );
        roots = topics.slice(0, 1);
      }
    }

    function emitXml(el, depth) {
      st.nodes += 1;
      const title = (el.getAttribute("TEXT") || el.getAttribute("text") || "").trim();
      pushLine(depth, title, lines);
      for (const c of findNodes(el)) emitXml(c, depth + 1);
    }

    for (const r of roots) {
      st.sheets += 1;
      emitXml(r, 0);
      lines.push("");
    }
    return roots.length > 0;
  }

  async function xmindToMarkdown(arrayBuffer) {
    const st = { sheets: 0, topics: 0, nodes: 0 };
    const lines = [];
    const zip = await JSZip.loadAsync(arrayBuffer);
    const names = Object.keys(zip.files);

    if (names.indexOf("content.json") !== -1) {
      const raw = await zip.file("content.json").async("string");
      parseJson(JSON.parse(raw), lines, st);
    } else if (names.indexOf("content.xml") !== -1) {
      const raw = await zip.file("content.xml").async("string");
      if (!parseXml(raw, lines, st)) throw new Error("未识别的 XMind XML 结构");
    } else {
      throw new Error("该文件不是有效的 .xmind（缺少 content.json / content.xml）");
    }
    const md = lines.join("\n").replace(/\s+$/, "") + "\n";
    return { md, st };
  }

  // ----------------------------- UI 逻辑 -----------------------------
  function setFile(file) {
    clearAlert();
    if (!file) return;
    if (!/\.xmind$/i.test(file.name)) {
      showAlert("请选择 .xmind 后缀的文件");
      return;
    }
    if (file.size > MAX_SIZE) {
      showAlert("文件超过 30MB 限制");
      return;
    }
    currentFile = file;
    currentName = file.name.replace(/\.xmind$/i, "");
    $("fname").textContent = file.name;
    $("fmeta").textContent = (file.size / 1024).toFixed(1) + " KB";
    filebar.classList.add("show");
    convertBtn.disabled = false;
  }

  drop.addEventListener("click", () => fileInput.click());
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });
  fileInput.addEventListener("change", (e) => setFile(e.target.files[0]));

  ["dragenter", "dragover"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); })
  );
  ["dragleave", "drop"].forEach((ev) =>
    drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); })
  );
  drop.addEventListener("drop", (e) => {
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) setFile(f);
  });

  $("clear").addEventListener("click", () => {
    currentFile = null; fileInput.value = "";
    filebar.classList.remove("show");
    convertBtn.disabled = true;
    result.classList.remove("show");
    stats.classList.remove("show");
  });

  convertBtn.addEventListener("click", async () => {
    if (!currentFile) return;
    clearAlert();
    convertBtn.disabled = true;
    convertBtn.innerHTML = '<span class="spinner"></span> 转换中…';
    try {
      const buf = await currentFile.arrayBuffer();
      // PK 头校验（zip 魔数 0x50 0x4B）
      if (buf.byteLength < 2) {
        showAlert("文件不是 .xmind（应为 PK zip 格式）");
        return;
      }
      const head = new Uint8Array(buf.slice(0, 2));
      if (head[0] !== 0x50 || head[1] !== 0x4b) {
        showAlert("文件不是 .xmind（应为 PK zip 格式）");
        return;
      }

      const { md, st } = await xmindToMarkdown(buf);
      currentMd = md;

      const render = typeof marked.parse === "function" ? marked.parse(md) : marked(md);
      $("preview").innerHTML = render;
      $("raw").value = md;
      $("st-sheets").textContent = st.sheets;
      $("st-topics").textContent = st.topics;
      $("st-nodes").textContent = st.nodes;
      stats.classList.add("show");
      result.classList.add("show");
      copyBtn.disabled = false;
      downloadBtn.disabled = false;
    } catch (err) {
      showAlert("解析失败：" + (err && err.message ? err.message : err));
    } finally {
      convertBtn.innerHTML = "转换";
      convertBtn.disabled = false;
    }
  });

  function switchTab(which) {
    const prev = which === "preview";
    $("tab-preview").classList.toggle("active", prev);
    $("tab-raw").classList.toggle("active", !prev);
    $("tab-preview").setAttribute("aria-selected", prev);
    $("tab-raw").setAttribute("aria-selected", !prev);
    $("pane-preview").classList.toggle("active", prev);
    $("pane-raw").classList.toggle("active", !prev);
  }
  $("tab-preview").addEventListener("click", () => switchTab("preview"));
  $("tab-raw").addEventListener("click", () => switchTab("raw"));

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentMd);
      copyBtn.textContent = "已复制 ✓";
      setTimeout(() => (copyBtn.textContent = "复制 Markdown"), 1500);
    } catch { showAlert("复制失败，请手动选择文本"); }
  });

  downloadBtn.addEventListener("click", () => {
    const blob = new Blob([currentMd], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = currentName + ".md";
    a.click();
    URL.revokeObjectURL(a.href);
  });
})();
