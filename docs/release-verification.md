# 0.3.2 发布验证

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
