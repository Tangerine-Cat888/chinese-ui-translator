# 第三方组件与来源

发行时唯一打包的第三方运行时组件为 **Acorn 8.19.0**（MIT），来自 https://github.com/acornjs/acorn 。其完整许可证在构建时从锁定依赖读取并嵌入 main.js 顶部，标准三文件安装也保留声明。实际版本以 package-lock.json 和 dist/build-meta.json 为准。

Obsidian、Electron、Node 内置模块由桌面宿主提供，不捆绑宿主本身；构建与测试依赖不进入安装包。开发依赖的许可证随各依赖保留。

本项目早期研究参考 LLM Settings Translator、Obsidian Immersive Translate、KISS Translator、i18n、i18n+ 的设计。已有整合方案记录为自主实现、不复制上游业务代码；当前入口和构建依赖图未引用这些本地参考仓库。参考不转移其版权，不把 KISS Translator 的 GPL 许可替换成 MIT。本项目 MIT 仅适用于本项目作者拥有权利的代码。
