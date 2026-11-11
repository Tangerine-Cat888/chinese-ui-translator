# 0.3.14 发布验证

2026-11-11：0.3.13 官方扫描发现 ARIA ID 与 Copilot 路径过滤的两条控制字符正则警告。本版改为等价字符码检查，不覆盖已公开0.3.13附件。

90项自动测试、类型及lint通过；新建独立验收库重跑基础19项、进度/ARIA/Copilot、Keychain、旧ID迁移和损坏词典保护，明暗主题、键盘及卸载检查通过。Keychain重载检查首次固定400ms等待不足，改为等待实际翻译状态后通过。证据位于本地work/release-0.3.14，早期未完成的运行不计入通过。

平台与服务边界同下：Windows Obsidian1.15.0与本地模拟服务；macOS/Linux宿主、真实供应商及客户端搜索未测。[0.3.14](https://github.com/Tangerine-Cat888/chinese-ui-translator/releases/tag/0.3.14) 已公开；[CI](https://github.com/Tangerine-Cat888/chinese-ui-translator/actions/runs/42978836256) 与两次 Windows 干净构建一致，四附件草稿和公开下载均核验，来源证明通过。个人安装已更新并启用，配置、启用列表与库外存储哈希不变，5份词典和Keychain引用正常，重载无捕获错误。实际Copilot当前停用，本轮仅对合成Copilot界面验收。官方0.3.14检查 **Completed**：构建逐字节复现通过，来源证明通过，无Error或源码/CSS警告。仅保留已披露的库外文件访问Warning与额外ZIP Recommendation。公开页简介、详情、4张截图及Add to Obsidian链接已回读。

---

# 0.3.13 发布验证

2026-11-11，包含 Keychain 集成、0.3.7—0.3.12 优化及本轮修复。90项测试、类型与lint通过；最终构建独立安装于Windows Obsidian1.15.0测试库。

基础19项、进度/ARIA/Copilot新增功能、原生Keychain创建选择/迁移/轮换/解除关联/缺失保护、旧ID迁移与损坏词典保护均重新执行。验证明暗主题、窄屏、键盘、卸载清理、控件事件和值、笔记及目标插件源码不变。截图为模拟内容。

Keychain前的81项结果仅为历史中间证据，不替代本次。最终证据位于本地 work/release-0.3.13/final。仅使用模拟端点；真实供应商账号、macOS/Linux宿主和客户端目录搜索未测。0.3.13 已正式发布，官方检查Completed且逐字节复现通过，随后发现的两条源码Warning在0.3.14修复。

---

# 0.3.6 发布验证

2026-11-08，标签 `0.3.6` 对应 `4dbd41108d62345a72b4038a678f5d5d066cb99d`。

- 0.3.5 已按授权发布并完成官方检查。随后针对官方 createElement 警告追加 0.3.6，不覆盖 0.3.5 标签与附件。
- 修复测量/焦点 class 变化触发整页恢复英文的闪回：仅语义类或 role 变化重新判定译文。回归测试与真实 Obsidian 均确认普通样式更新后文字和选项值稳定。
- [CI](https://github.com/Tangerine-Cat888/chinese-ui-translator/actions/runs/42489272206)通过 65 项测试、类型、lint、audit（零漏洞）、依赖树、构建/打包/哈希；两次 Windows 干净构建与 Linux CI 完全一致。
- [发行附件](https://github.com/Tangerine-Cat888/chinese-ui-translator/releases/tag/0.3.6)来自 CI，草稿四附件校验后公开；下载回读哈希及来源证明验证通过。
- 在新建 Windows Obsidian 1.15.0 库重跑五项新功能和基础完整流程，以及失败取消重试、迁移、清空密钥、损坏上下文保护、离线、窗口重开、卸载、明暗窄屏与键盘。实机检查输入/选项值、事件、笔记和测试插件文件不变。
- 个人插件已更新到 0.3.6 并启用，配置、4 份词典和启用列表前后哈希一致，重载无捕获错误。

仅本地模拟端点；macOS/Linux 实机、真实供应商及客户端目录搜索未测，移动端不支持。独立证据位于本地 `work/release-0.3.6/`。早期候选测试不计入最终通过结论。

官方 0.3.6 检查为 **Completed**，构建逐字节复现通过，无 Error 或源码/CSS 警告。仅保留已披露的库外文件访问 Warning 与额外手动安装 ZIP Recommendation。

---

# 0.3.5 发布验证

2026-11-08，源码标签 `0.3.5` 对应 `34a8b5733c9bac72400372abe59498b62792e9e5`。

- [CI](https://github.com/Tangerine-Cat888/chinese-ui-translator/actions/runs/42488426969)通过完整类型检查、lint、64 项测试、audit（零漏洞）、依赖树、构建、打包和哈希核验。两套 Windows 全新目录产物与 Linux CI 完全一致。
- [0.3.5 正式发行](https://github.com/Tangerine-Cat888/chinese-ui-translator/releases/tag/0.3.5)的三标准附件和 ZIP 来自 CI；草稿时检查数量、大小、状态、哈希后公开，回下载与来源证明校验通过。
- Windows Obsidian 1.15.0 新建两套独立验收库，本轮重跑干净安装、配置和模型列表、翻译/恢复/角色补翻、取消失败重试、离线/窗口重开/卸载、菜单、控件事件和值、明暗窄屏键盘。新增短标签、观察标签补漏、拆分文字、角色词典和受限数字模板均实机通过；笔记及测试插件文件不变。
- 真实宿主通过旧 ID 配置迁移、清空密钥不复活，以及损坏上下文词典保留和阻止写入。现有个人安装的三文件与公开附件一致，配置和 4 份词典正常、保护项哈希未变。
- 修正英文/中文说明遗漏的观察标签隐私与角色传输范围；DeepL/DeepLX 只接收文字。README 新增合成界面的角色和数字截图，官方长描述同步更新。本轮未发现需修改运行代码的功能错误。
- 旧验收脚本曾把首次角色补翻误当作零请求；更新为“首次补齐角色、随后零请求”，在另一个全新库重跑通过。未复用历史测试结论。

仅使用本地模拟服务；macOS/Linux 实机、真实付费供应商和客户端目录搜索未测。桌面专用，窄屏不等于手机。已知 ESLint 9 上游弃用提示受官方 peer 依赖要求限制。独立记录和证据保存在本地 `work/release-0.3.5/`，不公开个人数据。

官方 0.3.5 为 Completed，但存在 createElement 源码 Warning；随后在 0.3.6 修复并独立复验。

---

# 0.3.4 发布验证

2026-11-08，源码标签 `0.3.4` 对应 `e82ad32eb0b1c21eaf39e35b037af5ab71b5131f`。

- 设置页标签/说明与控件垂直居中，统一控件宽度与间距。0.3.3 发布后官方提示 `:has()` 性能警告，本版改为明确容器类；已发布的 0.3.3 保留原样。
- [CI](https://github.com/Tangerine-Cat888/chinese-ui-translator/actions/runs/42480851647)通过类型检查、lint、52 项测试、audit（零漏洞）、依赖树、构建、打包和哈希核验。
- 两次 Windows 全新目录构建与 Linux CI 产物一致。四个发行附件来自 CI，草稿校验后公开，回下载哈希和 main.js/styles.css 来源证明均通过。
- 本版独立 Windows Obsidian 1.15.0 新库重跑：首次无凭证/词典、配置与模型列表、翻译/补翻/恢复、离线、取消失败重试、控件值与事件、菜单、弹出窗口关闭重开、卸载、明暗/窄屏/键盘。笔记和测试插件文件不变。服务使用本地模拟端点。
- 实机确认明确容器类生效、背景透明、无外层 padding、行垂直居中。当前个人安装已更新 0.3.4 并启用，4 份词典和现有配置哈希不变，重载无捕获错误。

macOS/Linux 未实机验收，真实付费供应商和客户端目录搜索未测；移动端不支持。ESLint 9 上游弃用受官方 peer 约束。独立验收材料保存在本地 `work/release-0.3.4/`，不公开个人数据。

官方 0.3.4 检查 Completed，main.js 逐字节复现，无 Error 和 CSS 警告。仅保留已披露的 Direct Filesystem Access Warning 与额外 ZIP Recommendation。

---

# 0.3.2 发布验证

官方 [公开条目](https://community.obsidian.md/plugins/chinese-ui-translator) 已发布；0.3.2 检查为 **Completed**，官方构建复现 main.js 逐字节一致，无 Error。唯一 Warning 为已披露的库外文件访问；额外 ZIP 属于 Recommendation。客户端内搜索未单独验收。

2026-11-08，源码标签 `0.3.2` 对应 `2e1b15f2d3210d8c4644fa9c3087bbecfdf393ff`。

- [CI](https://github.com/Tangerine-Cat888/chinese-ui-translator/actions/runs/42475720522)通过干净安装、完整类型感知 lint、类型检查、52 项测试、audit、依赖树、构建、打包与哈希核验。
- 两套独立 Windows 干净构建和 Linux CI 产物一致，发行附件取自 CI。标准三附件及 ZIP 的 SHA256 见根目录 release.sha256。
- [0.3.2 发行](https://github.com/Tangerine-Cat888/chinese-ui-translator/releases/tag/0.3.2)于 2026-11-08 19:28:16 UTC+8 公开，四个附件回下载哈希一致。main.js/styles.css 的 GitHub artifact attestation 已使用 gh attestation verify 验证。
- Windows Obsidian 1.15.0 的新测试库完成安装、实际按钮配置与翻译、模型列表、增量、恢复、离线重载、窗口重开、卸载、取消失败重试、明暗和窄屏验收。旧 ID 配置迁移实机通过，旧文件未改变。测试仅使用本地模拟服务。
- 官方 0.3.1 源码检查指出的错误已修复：JSON 类型验证、设置定义 API、DOM helper、主窗口文档引用、时钟、注释描述、Promise 返回和废弃 API。英文 README 已补齐。源码不再禁用官方禁止关闭的规则。
- 库外词典需要 Node 文件系统权限，已在 README 与官方描述披露；ZIP 是手动安装便利包，不用于官方自动安装。官方目录审核与 GitHub 发行状态分开记录。

macOS/Linux 未实机测试；不支持手机；未使用真实付费供应商账号验证；ESLint 9 上游弃用提示受官方插件 peer 依赖限制，audit 无漏洞。

---

# 0.3.1 发布验证

日期：2026-11-08。

- 公开源码：[Tangerine-Cat888/chinese-ui-translator](https://github.com/Tangerine-Cat888/chinese-ui-translator)。
- 标签 `0.3.1` 指向 `976245fdfe37d74c9fd5c939a1f0d61b349913dd`。
- [云端检查](https://github.com/Tangerine-Cat888/chinese-ui-translator/actions/runs/42474562784)通过：干净 npm ci、lint、类型检查、44 项测试、audit、依赖树、构建、打包、SHA256 核验。
- 下载的 CI 产物与两次本地干净构建一致；发行附件来自该 CI 产物。
- [正式发行](https://github.com/Tangerine-Cat888/chinese-ui-translator/releases/tag/0.3.1)于 2026-11-08 19:11:56（UTC+8）公开；附件上传状态均为 uploaded，再次下载后哈希一致。

| 附件 | 字节 | SHA256 |
| --- | ---: | --- |
| main.js | 264460 | 2b5343e93c47a0c770899e559f57d1027e30ad4b1a52c4ef708e0f8c9666afaa |
| manifest.json | 330 | 97f8a3b2f09e3be0545da3317239003807c247cf7f18be54fce9abf173f6931a |
| styles.css | 4569 | e5353242b220a89402cfb59b7651a354434a337481bf5780fe0ca6b626f80eb4 |
| chinese-ui-translator-0.3.1.zip | 269801 | f3ad02866f0875b5eeb404676f903a6ebac750412e009b6667bca443d90a596f |

真实宿主验收：Windows、Obsidian 1.15.0，干净安装、模拟服务配置/翻译、恢复、离线重载、取消/失败、明暗主题和窄窗口通过；旧 ID 配置迁移与双开保护通过。macOS/Linux 和其他宿主版本未实机测试，手机不支持；未用真实供应商账号逐一验证。

GitHub 发布与官方社区审核是两个独立阶段。目前不宣称官方审核通过或已被客户端目录收录。

最终公开页 Current version 为 0.3.2，Add to Obsidian 已启用并指向 obsidian://show-plugin?id=chinese-ui-translator；未点击以免改动用户日常库。
