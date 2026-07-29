#!/usr/bin/env python3
"""XMind -> Markdown 转换服务（可打包为单文件 exe）

- GET  /           渲染上传页面
- POST /convert    接收 xmind 原始字节，返回 {markdown, html, stats}
- GET  /quit       退出程序（打包成 exe 后用于关闭后台服务）
"""
import io
import os
import sys
import json
import socket
import zipfile
import threading
import webbrowser
import xml.etree.ElementTree as ET

from flask import Flask, request, render_template, jsonify

# ---- 路径：兼容开发态与 PyInstaller 冻结态 ----
if getattr(sys, "frozen", False):
    BASE = sys._MEIPASS          # 单文件 exe 解压后的临时目录
    TEMPLATES = os.path.join(BASE, "templates")
else:
    BASE = os.path.dirname(os.path.abspath(__file__))
    TEMPLATES = os.path.join(BASE, "templates")

app = Flask(__name__, template_folder=TEMPLATES)
# 仅开发态自动重载模板；冻结态关闭（无文件监视必要）
if not getattr(sys, "frozen", False):
    app.config["TEMPLATES_AUTO_RELOAD"] = True

MAX_SIZE = 30 * 1024 * 1024  # 30MB 上限


# ----------------------------- 解析核心 -----------------------------
def _emit(node, depth, lines, stats):
    stats["nodes"] += 1
    title = (node.get("title") or "").strip()
    if depth == 0:
        lines.append(f"# {title}\n")
    elif depth == 1:
        lines.append(f"## {title}\n")
    elif depth == 2:
        lines.append(f"### {title}\n")
    else:
        lines.append(f"{'  ' * (depth - 3)}- {title}")
    for c in node.get("children", {}).get("attached", []) or []:
        _emit(c, depth + 1, lines, stats)


def _parse_json(raw: bytes, lines, stats):
    data = json.loads(raw)
    for sheet in data:
        stats["sheets"] += 1
        _emit(sheet["rootTopic"], 0, lines, stats)
        stats["topics"] += len(
            sheet.get("rootTopic", {}).get("children", {}).get("attached", []) or []
        )
        if lines and lines[-1] != "":
            lines.append("")
    return True


def _local(tag: str) -> str:
    return tag.split("}")[-1]


def _parse_xml(raw: bytes, lines, stats):
    """兜底：经典 XMind XML 格式（<node TEXT="..."> 递归）"""
    root = ET.fromstring(raw)

    def find_nodes(el):
        return [c for c in el if _local(c.tag) == "node"]

    if _local(root.tag) == "node":
        roots = [root]
    else:
        roots = find_nodes(root)
        if not roots:
            topics = [c for c in root.iter() if _local(c.tag) == "topic"]
            roots = topics[:1] if topics else []

    def emit_xml(el, depth):
        stats["nodes"] += 1
        title = (el.get("TEXT") or el.get("text") or "").strip()
        if depth == 0:
            lines.append(f"# {title}\n")
        elif depth == 1:
            lines.append(f"## {title}\n")
        elif depth == 2:
            lines.append(f"### {title}\n")
        else:
            lines.append(f"{'  ' * (depth - 3)}- {title}")
        for c in find_nodes(el):
            emit_xml(c, depth + 1)

    for r in roots:
        stats["sheets"] += 1
        emit_xml(r, 0)
        lines.append("")
    return bool(roots)


def xmind_to_markdown(raw: bytes):
    stats = {"sheets": 0, "topics": 0, "nodes": 0}
    lines: list[str] = []
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        names = set(z.namelist())
        if "content.json" in names:
            _parse_json(z.read("content.json"), lines, stats)
        elif "content.xml" in names:
            if not _parse_xml(z.read("content.xml"), lines, stats):
                raise ValueError("未识别的 XMind XML 结构")
        else:
            raise ValueError("该文件不是有效的 .xmind（缺少 content.json / content.xml）")
    md = "\n".join(lines).rstrip() + "\n"
    return md, stats


# ----------------------------- 路由 -----------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/convert", methods=["POST"])
def convert():
    raw = request.get_data(cache=False)
    if not raw:
        return jsonify(error="未收到文件内容"), 400
    if len(raw) > MAX_SIZE:
        return jsonify(error="文件超过 30MB 限制"), 413
    if raw[:2] != b"PK":
        return jsonify(error="文件不是 .xmind（应为 PK zip 格式）"), 400
    try:
        import markdown as md_lib

        markdown_text, stats = xmind_to_markdown(raw)
        html = md_lib.markdown(
            markdown_text,
            extensions=["tables", "fenced_code", "toc", "sane_lists"],
        )
    except zipfile.BadZipFile:
        return jsonify(error="无法解压，文件可能已损坏"), 400
    except ValueError as e:
        return jsonify(error=str(e)), 422
    except Exception as e:
        return jsonify(error=f"解析失败：{e}"), 500

    return jsonify(
        markdown=markdown_text,
        html=html,
        stats=stats,
        filename=(request.headers.get("X-Filename") or "mindmap"),
    )


@app.route("/quit")
def quit_app():
    """打包成 exe 后用于退出后台服务。"""
    def _kill():
        import time
        time.sleep(0.4)
        os._exit(0)
    threading.Thread(target=_kill, daemon=True).start()
    return "<!doctype html><meta charset='utf-8'><h2 style='font-family:sans-serif;padding:40px'>已退出，可关闭此窗口。</h2>"


# ----------------------------- 启动 -----------------------------
def free_port(start: int = 5000, span: int = 50) -> int:
    for p in range(start, start + span):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                return p
    return start


def main():
    port = free_port(5000)
    url = f"http://127.0.0.1:{port}/"

    # 服务起来后自动打开浏览器（仅打包态或非开发态时更友好）
    def open_browser():
        webbrowser.open(url)

    threading.Timer(1.2, open_browser).start()

    if not getattr(sys, "frozen", False):
        print(f"开发服务已启动：{url}  （Ctrl+C 退出）")
    app.run(host="127.0.0.1", port=port, debug=False)


if __name__ == "__main__":
    main()
