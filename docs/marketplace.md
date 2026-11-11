# 市场资料 — 0.3.13

名称：Chinese UI Translator

作者：Tangerine.Cat

内部 ID / 安装目录：chinese-ui-translator（旧 bilingual-assistant 首次迁移后保留原配置文件；升级前先停用旧版）

许可证：MIT

官方分类：Interface（主分类）、AI、Languages；付款选项 Free。

英文简介（与 manifest 一致）：

Translate plugin interfaces into Simplified Chinese and reuse saved dictionaries offline, preserving plugin names and original files.

中文简介：

按需将插件界面汉化为简体中文，保存词典后离线应用，保留插件名称与原始文件。

## 详情页

### 为常用插件保存中文界面

在统一列表中找到英文插件，点击“汉化”，生成并保存中文词典。之后打开可识别的设置、菜单与插件控件时，直接使用本地词典，不再自动调用翻译服务。插件更新后，可点击“补翻新增”。

“恢复英文”只暂停显示中文，词典仍保留；需要时可以再次启用。插件名称、输入内容和原始插件文件保持原样，不改写笔记。

### 使用前准备

需要桌面版 Obsidian 1.15.0 或更新版本。展开“翻译服务”，选择 DeepSeek、OpenAI、OpenRouter、自定义 OpenAI 兼容服务、DeepL 或自建 DeepLX，填入相应配置，点击“保存并测试”。AI 服务可以获取模型列表，也可手动填写模型。

插件本身没有会员、试用、付费解锁或许可证激活流程。所选第三方服务可能要求账号、API Key 或收费，费用由该服务决定；本插件不提供免费额度。自定义服务和 DeepLX 需要用户自行部署或取得使用权限。

### 数据与网络

只有主动汉化、获取模型、测试连接才访问所选服务。汉化发送静态候选和已访问插件界面中识别出的标签、说明及占位提示，AI 请求还包含插件 ID 上下文；候选词条可能包含非界面静态文本，不上传整个源码或笔记正文。

服务配置与密钥名称保存在本插件 data.json，密钥由 Obsidian 钥匙串管理。已有明文密钥先写入钥匙串并回读验证，再移除当前配置中的明文；失败保留原配置。解除关联不会删除共享密钥。旧文件与历史备份保留，不承诺系统级加密或跨设备密钥同步。译文词典按库路径摘要保存在库外的 ObsidianBilingualAssistant 目录，用于离线复用；Windows 下位于 %APPDATA%。库外旧加密配置仅在首次迁移时读取。卸载不自动删除这些数据。

### 支持范围

支持可识别的静态英文标签。动态拼接、图片文字、原生系统菜单、iframe、封闭 Shadow DOM 和无法明确归属的文本可能保留英文。无显式 value 的下拉选项保持原样，以保护选项值。无法归属到单个插件的菜单只应用无歧义匹配。中文识别是启发式，未知语言插件暂不列入待汉化列表。

本轮真实测试为 Windows / Obsidian 1.15.0，包含默认明暗主题和窄窗口。macOS、Linux、其他主题与更高宿主版本尚未实机验证；移动端不支持。没有正文翻译功能。

### 补漏与上下文

先访问目标插件设置页，再主动补翻。可识别标签仅暂存在内存；角色上下文仅发送给 AI 服务。说明和提示可能包含动态上下文，不能保证过滤所有敏感内容。支持已确认插件区域中的受限数字模板，冲突或来源不明时保留原文。

### 0.3.13 大型任务与界面覆盖

静态扫描不再截断到 3000 条；剩余词条超过 3000 时先确认费用与耗时。中断后保存已验证进度，重试仅处理缺失条目；模型或服务配置变化后重新判断进度。进度文件与词典同在库外。新增 ARIA 关联标签及 Copilot 设置和聊天界面适配，本地回退服从词典开关。

### 截图

最新 0.3.13 截图：`screenshots/keychain-0.3.13.png`，展示原生钥匙串与首次配置指引。下列历史截图中的明文输入框已由原生钥匙串控件替代。

1. `screenshots/overview-light.png`：真实设置页、已保存词典与恢复英文按钮。
2. `screenshots/translated-controls.png`：模拟测试插件的中文控件，原插件名称及输入值保持不变。
3. `screenshots/narrow-dark.png`：真实窄窗口下的服务配置。

截图来自独立验收库，使用模拟翻译服务和测试插件，不展示用户笔记、账户或密钥。模拟内容不代表真实模型的翻译质量。

## 0.3.5 提交状态

0.3.5 已发布并完成官方检查。为修复官方 DOM helper 警告与测量/焦点变化造成的英文闪回，追加 0.3.6；不覆盖原标签。0.3.6 官方检查 Completed，源码警告已消除，构建逐字节复现通过；保留库外文件访问提示与额外 ZIP 建议。最终证据见 release-verification.md。

## 0.3.4 历史提交状态

源码与 0.3.4 已公开发布：

- 仓库：https://github.com/Tangerine-Cat888/chinese-ui-translator
- 发行：https://github.com/Tangerine-Cat888/chinese-ui-translator/releases/tag/0.3.4
- CI：https://github.com/Tangerine-Cat888/chinese-ui-translator/actions/runs/42480851647

官方条目已提交并发布：https://community.obsidian.md/plugins/chinese-ui-translator 。公开页已回读简介、说明、3 张截图。0.3.4 / e82ad32 官方检查现为 Completed，构建复现逐字节通过，无 Error。保留已披露的库外文件访问 Warning 和额外 ZIP Recommendation。客户端内搜索未单独验收。已保存的 986 字英文长描述见 marketplace-description-en.txt。
