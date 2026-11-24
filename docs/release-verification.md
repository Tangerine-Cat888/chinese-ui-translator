# 0.5.0 独立发布验收

日期：2026-11-24。Tangerine.Cat / MIT / chinese-ui-translator，最低 Obsidian 1.11.5。用户已授权按已验证范围公开发布，明确接受暂缺手机实机。

## 通过

- 审阅本版所有代码差异、模块及发布材料。手机 DataAdapter 存储、浏览器 SHA-256/随机数、桌面 Node 访问隔离、移动管理入口与窄屏样式；桌面继续原词典路径。正式包 21 个源码模块及 Acorn、@noble/hashes；保留模块仍纳入静态检查。
- 94 项测试、lint 零警告、类型检查、依赖树通过；完整 audit 零漏洞（audit-current.json）。上游撤回 GHSA-fc5q-39xc-vjpf，删除旧审计例外。
- 两个独立 npm ci 干净构建三文件及 ZIP 完全一致：reproduce-1795497534684/result.json。安装包仅标准三文件，无个人配置、凭证、词典或工具。
- release-check 对正式 main.js 在无 process/Buffer/Node/Electron 环境执行 onload、Keychain 迁移、翻译保存、卸载重载及零请求补翻，使用自定义配置目录。
- Windows 实际 Obsidian 1.11.5、1.12.7、1.13.4、1.14.4、1.15.1 全部通过独立安装、设置、密钥、模型、插件/主题翻译、恢复、离线及文件保护。前四版本使用 Electron 39.2.7 隔离壳。证据 final-win-*/results.json 与 final/evidence。
- 1.15.1 完整桌面回归包含角色/数值/ARIA/Copilot、输入/事件、3001 条取消零请求、12 条检查点续译、失败重试、模型变更、损坏文件保护、旧 ID 迁移、密钥创建/选择/轮换/共享解除、弹出窗口及卸载。
- 主题独立 17 项通过，Minimal 486 字段完成，值与事件保留；关闭窗口 34 个会话归零并可重开。证据 theme/evidence。
- 移动模拟 1.15.1：管理入口、无状态栏、Keychain、插件和主题、恢复、取消续译、迁移/损坏保护、关闭模拟服务后冷重启离线应用通过。证据 mobile/mobile-results.json、mobile/evidence、mobile/mobile-cold-results.json。
- 移动布局 320/390/768 无横向溢出：mobile/layout-final.json；截图 mobile/mobile-final.png 已目视确认，公开图标注桌面模拟。
- 已备份个人插件、配置及 5 份词典：private-install-backup。发布安装及官方状态另行补记。

## 测试修正与限制

测试脚本旧字段引用和字符串引号、移动模拟端点配置先修正后重跑通过。布局初次采样处于动画中，等待稳定后重新验证三个宽度；不作为产品缺陷。

Android/iPhone 实机、macOS/Linux、真实付费提供商未测。移动模拟不能验证 iOS WebView、触摸/软键盘、后台回收及实际同步；用户确认按此范围发布。桌面词典不会自动搬到手机，手机配置目录是否同步取决于同步工具，密钥需在设备上配置。未沿用其他插件测试或许可证结论。

## 产物 SHA-256

8e52948c6e4fbeabd19365799de60560455315075d2f0ca1d7098b87bda9c18c  dist/chinese-ui-translator/main.js
a1a9edc39de3d630b6e6bcdad517084f8815058739942fda08f551d727aeae44  dist/chinese-ui-translator/manifest.json
41f739c7231edada78f33191b2e6933bcae2769ac619bde4a1c67660f42b35a0  dist/chinese-ui-translator/styles.css
6736439616838433c51e3759465a8d22a8a1f5e63f0f977799245338d69eaf94  dist/chinese-ui-translator-0.5.0.zip


## 公开发布与个人升级回读

- 通过：源提交及 0.5.0 tag 为 a61b81cc2943ca98bfe98b50af16e8f3812c7f0c，远端回读一致。GitHub 主分支 CI 45333565078、标签 CI 45333579423 成功。
- 通过：修复 CI 的 Node 20 弃用警告，将 checkout/setup-node/upload-artifact 更新至官方 Node 24 版本并固定提交；标签构建 annotations 为 0。证据 actions-upgrade.json。
- 通过：CI、两次干净构建、本地与草稿四附件哈希相同；main.js/styles.css 构建来源证明验证通过。草稿回读数量、大小、状态及 digest 后公开，再下载四附件验证。证据 ci-comparison.json、attestation-*.json、draft-verified.json、published.json。
- 通过：[GitHub 0.5.0](https://github.com/Tangerine-Cat888/chinese-ui-translator/releases/tag/0.5.0) 已公开；明确 Android/iPhone 实机、macOS/Linux、真实付费服务未测。
- 通过：个人库由 0.4.1 升级 0.5.0，仅覆盖下载验证后的三个程序文件。正常启用、配置/目录 ready、5 份词典、Keychain 引用有效、无明文 key、无捕获错误；配置/词典/主题/启用列表哈希未变。实际设置页、当前 Still 主题 108 字段正常。证据 personal-install.json、personal-ui-smoke.json；完整备份留存在 private-install-backup。
- 通过。2026-11-24 官方扫描已从 Pending 转为 Completed，对应提交 a61b81c。[官方详情页](https://community.obsidian.md/plugins/chinese-ui-translator)显示当前版本 0.5.0。公开 About 与 961 字符送审文案一致，桌面图库 5 张，手机图库 1 张。已在窄屏公开页目视确认新增的移动模拟截图。Android 和 iPhone 实机未测。
- 扫描无 Error。官方逐字节复现 main.js，验证 main.js 和 styles.css 的来源证明，未发现依赖漏洞、可疑网络模式或代码混淆。
- 官方保留 4 项 Warning。桌面库外词典的文件访问触发 1 项行为提示，另 3 项源码提示指向 src/storage.ts 的 fs/promises、path、os。复核该标签代码，桌面环境检查先于 require，移动端由 src/manager.ts 选择 DataAdapter。无 Node 的成品测试及移动模拟通过。2 项 Recommendation 分别涉及手工安装 ZIP 和旧宿主需要的 display 接口。
- 本版审核证据见 official-completed.txt、official-review.jpg，目录与图库证据见 official-public.txt、official-mobile-listing.jpg。客户端内目录搜索未单独验证。

所有本版测试使用独立证据；保留备份与验收材料，未删除其他工作文件，未更新共享记忆。

---

# 0.4.1 独立发布验收

日期：2026-11-18。作者 Tangerine.Cat，MIT，插件 ID chinese-ui-translator。沿用本聊天的公开推送、发行、官方审核及升级授权；不含个人配置与词典。

## 通过

- 审阅本次全部差异：最低版本 1.11.5、旧版 display/refreshSettings 回退、保留模块 legacy-main 同步处理、版本及文档。22 个源模块纳入 lint/类型检查；正式包为 20 个源模块加 Acorn，排除 legacy-main/dom 与测试模块。
- 93 项测试、lint 零警告、类型检查、依赖树正常。两个全新目录 npm ci，三文件及 ZIP 完全一致，见 reproduce-1795006706177/result.json。
- 最终三文件在 Windows Obsidian 1.11.5、1.12.7、1.13.4、1.14.4、1.15.1 的独立库重新验收。实际 apiVersion 回读，设置页、服务配置/模型列表、Keychain 迁移、插件/主题汉化、恢复英文、离线重载、笔记与目标源码哈希、运行异常均通过。见 final-win-*/results.json。前四个使用 Electron 39.2.7 隔离壳，1.15.1 使用当前 Electron 壳。
- 最低版本另跑原生密钥创建/选择、轮换、解除关联保留共享密钥、缺失保护及迁移，见 final-win-1.11.5/evidence/keychain-results.json。测试脚本最初假设宿主按钮为中文，按实际英文 Add secret 文案修正后通过；产品无此问题。
- Obsidian 1.15.0 独立库重跑完整基础流程、输入/选项值与事件、动态/角色/数字标签、补翻零重复、弹出窗口、窄屏、明暗、键盘、卸载。进度取消/恢复/失败、3000 条确认取消零请求、Copilot/ARIA 可编辑保护、旧 ID 迁移及损坏词典保护通过，见 final/evidence。
- 主题独立 17 项、同名片段/主题隔离、增量及移除、原始值、暂停/恢复、重载、明暗通过。Minimal 486 条字段翻译完成，离线复查选项值与事件正常；窗口关闭 34 个会话归零并可重开。见 theme/evidence。首次 Minimal 批量翻译超过测试控制通道的 25 秒等待，任务实际完成后复查通过，不记作首次通过。
- 包仅 main.js、manifest.json、styles.css，ZIP 同三文件；许可证与 Acorn 声明齐全，无凭证、词典、用户内容或开发工具。见 dist/release-check.json、release.sha256。
- README、更新记录、详情文案与最低版本同步；现有截图界面仍匹配。新版宿主截图见 final/evidence，故障注入后的提示截图仅作测试证据，不作为市场宣传图。

## 已核实的依赖例外

生产依赖无告警；完整审计保留 11 个 high 节点，均由开发依赖 picomatch 单一公告 GHSA-fc5q-39xc-vjpf 传递。2026-11-18 官方公告及 npm 最新 4.0.7 均无修复版本，不能以降级消除真实风险。构建 glob 来源为受信任项目配置，插件包不包含该依赖。

scripts/audit.mjs 只允许该公告、仅 lock 中 dev=true 的全部节点，2026-12-18 到期；新公告、生产节点、网络错误仍阻断。四组正反例验证通过，见 audit-policy-tests.json。不宣称全量审计零漏洞。

## 依据与边界

最低 1.11.5 使用官方 SecretStorage 落盘加密修复：https://obsidian.md/changelog/2026-01-20-desktop-v1.11.5/ 。1.11.4 测试副本降低 manifest 的结果仅作历史探索，不宣称正式支持。1.10.6 缺少 Keychain API。

macOS/Linux 实机、真实供应商账号/质量/计费、客户端目录搜索未测；本轮只使用合成内容与本地模拟端点。未修改共享记忆。

## 发布与安装结果

源码提交 8da0e5eee2e53ba78869cab4043f76d7d99cd9ed。主分支 CI 44310301636、标签 CI 44310705224 均成功；三文件和 ZIP 与本地双构建及 CI 逐字节一致，草稿附件状态/大小/digest 与公开下载回读通过，main.js/styles.css 来源证明通过。

GitHub 0.4.1 已公开，官方检查 Completed，对应 8da0e5e；main.js 逐字节复现与两项来源证明通过，运行时依赖无漏洞，无 Error 或源码/CSS Warning。保留已披露的库外文件访问 Warning，以及 display 兼容入口与额外 ZIP 两项 Recommendation。官方当前发行已更新为 0.4.1。完整证据 official-completed.txt / official-summary.jpg。公开页简介、详情、5 张截图与安装链接均回读。

实际库 0.4.0 → 0.4.1 已完成，启用正常、配置及 5 份词典与 9 个保护文件哈希不变，Keychain 引用可解析，无明文密钥，无重载捕获异常。主题入口和密钥指引存在，当前 Still 主题提取 108 条；备份保留于 private-install-backup。见 personal-install.json、personal-ui-smoke.json。测试宿主均正常退出，仅原用户宿主仍运行。

官方已返回运行时依赖无漏洞；新增 `display` 自 1.13.0 起弃用的 Recommendation。本版为支持 1.11/1.12 必须保留旧入口，1.13+ 已实际使用 getSettingDefinitions，因此保留该兼容性建议，不删除旧版支持。该项不同于错误或源码 Warning。

---

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

## 0.4.0 — 2026-11-17

主题汉化与全部模块回归通过：93项自动测试、独立宿主基础/ARIA/续翻/Keychain/迁移/损坏保护、主题17项、Minimal486字段、弹出窗口会话释放。两套干净构建一致、审计零漏洞，包仅标准三文件。详细证据见 work/release-0.4.0/验收记录.md。发布提交10b80c2；CI44024545564与44024673342通过，来源证明及公开附件哈希一致。官方0.4.0 Completed，逐字节复现通过，无Error或源码/CSS警告；仅保留已披露的库外文件访问Warning和额外ZIP Recommendation。简介与5张截图公开回读。日常库已更新0.4.0，5份词典、Keychain引用和9个保护文件哈希不变，正常启用、无捕获错误。Windows/Obsidian1.15.0实测，其他系统、真实供应商质量与客户端目录搜索未测。
