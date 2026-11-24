# 第三方组件与来源

安装包包含 **Acorn 8.19.0**（MIT，用于扫描插件代码）与 **@noble/hashes 2.4.0**（MIT，用于跨平台 SHA-256 和密钥标识生成）。构建时从锁定依赖读取两者的完整许可证并嵌入 main.js。实际版本可查 package-lock.json 和 dist/build-meta.json。 [Acorn](https://github.com/acornjs/acorn) · [@noble/hashes](https://github.com/paulmillr/noble-hashes)

Obsidian API 由各平台宿主提供。桌面运行时按需加载其 Node 内置模块和 Electron 兼容接口。构建与测试依赖的许可证随各依赖保留。

本项目早期研究参考 LLM Settings Translator、Obsidian Immersive Translate、KISS Translator、i18n、i18n+ 的设计。已有整合方案记录为自主实现、不复制上游业务代码；当前入口和构建依赖图未引用这些本地参考仓库。参考不转移其版权，不把 KISS Translator 的 GPL 许可替换成 MIT。本项目 MIT 仅适用于本项目作者拥有权利的代码。
