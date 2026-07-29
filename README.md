<p align="center">
  <img src="assets/icon.jpg" width="128" alt="XMind2MD logo">
</p>

<h1 align="center">XMind2MD</h1>

<p align="center">
  <strong>本地运行的 XMind 思维导图 → Markdown 转换工具</strong>
</p>
<p align="center">
  纯本地运行、网页交互、一键转换、可预览 / 复制 / 下载。
</p>
<p align="center">
  <a href="https://www.python.org"><img src="https://img.shields.io/badge/Python-3.8%2B-3776AB?logo=python&logoColor=white" alt="Python"></a>
  <a href="https://www.microsoft.com/windows"><img src="https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white" alt="Platform"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"></a>
</p>



---

## 目录

- [快速开始](#快速开始)
- [使用](#使用)
  - [方式一：直接使用打包好的 exe（推荐）](#方式一直接使用打包好的-exe推荐)
  - [方式二：从源码运行](#方式二从源码运行)
- [项目结构](#项目结构)
- [开发](#开发)
- [许可证](#许可证)

---

## 快速开始

1. 进入 [`dist/`](dist/) 目录，双击 **`XMind2MD.exe`**
2. 程序自动在后台启动本地服务并打开浏览器到转换页面
3. 拖入 `.xmind` → 转换 → 复制 / 下载 `.md`
4. 用完点击下方「退出程序」关闭后台服务

---


## 使用

### 方式一：直接使用打包好的 exe（推荐）

无需安装任何依赖。从 [`dist/XMind2MD.exe`](dist/XMind2MD.exe) 直接运行即可（Windows）。

### 方式二：从源码运行

需要 Python 3.8+ 与 `pip`。

```bash
git clone https://github.com/levi52/XMind2MD.git
cd XMind2MD
pip install -r requirements.txt
python app.py
# 浏览器打开 http://127.0.0.1:5000
```

默认端口 `5000`；若被占用，程序会自动顺延到下一个空闲端口。

1. 启动程序（双击 exe 或 `python app.py`）
2. 在网页中点击或拖入一个 `.xmind` 文件
3. 等待转换完成，页面展示：
   - **预览**：渲染后的 Markdown 效果
   - **Markdown**：原始文本，可复制或下载
4. 下载得到的 `.md` 文件即可用于笔记 / 文档 / 博客等

> 所有解析与转换均在本地完成。

---

## 项目结构

```
XMind2MD/
├─ app.py              # Flask 后端：提供页面与 /convert 接口
├─ build.bat           # 重打包脚本（PyInstaller）
├─ requirements.txt    # Python 依赖清单
├─ README.md           # 项目说明
├─ LICENSE             # MIT 许可证
├─ assets/
│  ├─ icon.ico         # 程序图标
│  └─ icon.jpg         # 图标源图
├─ templates/
│  └─ index.html       # 前端页面
└─ dist/
   └─ XMind2MD.exe     # 打包好的成品（双击运行）
```

---

## 开发

确保已安装依赖，在 `XMind2MD` 目录下执行：

```bash
pip install pyinstaller -r requirements.txt
build.bat
```

生成的 `XMind2MD.exe` 位于 `dist/`。`build.bat` 已内置：

- `--onefile --windowed`：单文件、无控制台窗口
- `--icon "assets/icon.ico"`：嵌入图标
- `--add-data "templates;templates"`：打包前端页面
- 隐藏导入 `markdown` 各扩展，避免运行缺模块

> 打包环境：Python 3.13，PyInstaller 6.x。
>
> ⚠️ 打包前请确保 `dist/`、`build/`、`XMind2MD.spec` 已清除，否则 PyInstaller 预删旧 exe 可能触发环境的安全删除机制导致构建中断。

---

## 许可证

[MIT 许可证](LICENSE)
