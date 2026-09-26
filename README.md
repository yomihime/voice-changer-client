# Voice Changer Client

独立开发的变声客户端前端，基于 w-okada Voice Changer **2.1.4-alpha 发布版恢复代码**。
这里不是原作者的 TypeScript / TSX 源码；来源、修改和第三方许可证见 [NOTICE](NOTICE.md)。

仓库：[yomihime/voice-changer-client](https://github.com/yomihime/voice-changer-client)。
本仓库只包含前端、开发服务和构建工具，**不包含 Electron、Python 推理服务或模型**。
将来采用哪一种桌面打包方式另行决定。

## 独立开发

需要 Node.js 24.20+（24.x）。在本仓库目录中执行：

```sh
npm ci
npm run dev -- --backend http://127.0.0.1:18000/
```

页面地址为 `http://127.0.0.1:21416/`。省略 `--backend` 可以离线查看界面，
界面会显示未连接提示。修改源码后重新构建并刷新；目前没有热更新。

```sh
npm run build
npm test
npm run test:browser
```

`dist/` 是本仓库自己的构建产物，不提交到 Git。开发服务只监听本机，
通过同源 HTTP / WebSocket 代理连接指定后端，不负责启动或停止推理服务。
浏览器测试需要已安装 Chrome，或通过 `CHROME_PATH` 指定 Chromium 程序。

## 与服务端仓库的关系

`voice-changer` 仓库的 `client/frontend` 是指向本仓库的 Git 子模块。
源码、依赖安装、测试与构建都在本仓库内进行；服务端的构建流程不构建或打包这个新客户端。
从服务端仓库开始时，先执行 `git submodule update --init client/frontend`，然后进入该目录开发。
前端变更先在本仓库提交并推送，再由父仓库更新子模块指针。

## 代码与恢复参考

- `src/`：应用模块、平台适配及样式覆盖。模块职责与原声明映射见 [代码导航](CODE_INDEX.md)。
- `public/`：翻译、图标、第三方许可证等静态资源。
- `tools/`：恢复拆分工具及命名映射，供追溯过程；普通构建不会重新生成或覆盖 `src/`。
- `reference/v2.1.4-alpha/`：拆分前恢复 bundle、CSS、ponyfill 与 SHA-256 校验清单。
  该参考目录不参与构建，后续开发不要改写它。
- `server.cjs`：本机静态文件服务及代理。
- `assets.json`：构建输入清单，明确排除恢复参考、测试和个人文件。

恢复出来的第三方运行库仍保留其内部压缩变量；应用页面与业务模块按真实依赖拆分、命名。
这些代码不是原始源码。验证范围见 [VALIDATION](VALIDATION.md)。

`src/` 的职责如下：

| 目录 | 职责 |
| --- | --- |
| `app/`、`pages/` | React 挂载、应用入口、变声主页与日志页 |
| `features/` | 模型管理、角色展示、音频控制和设置窗口 |
| `components/` | 共享弹窗与图标 |
| `state/`、`hooks/` | Context、Provider、配置同步与客户端生命周期 |
| `api/` | HTTP 协议与文件上传 |
| `audio/` | 音频流、Worker、Worklet 与队列 |
| `platform/` | 浏览器能力与原生协议桥接边界 |
| `domain/`、`storage/`、`shared/`、`i18n/` | 常量、存储、通用工具与翻译初始化 |
| `vendor/` | 从发布包保留的第三方运行库 |

组件使用明确名称，业务状态采用 `is…` / `set…` 等含义清楚的局部变量。
服务端 JSON 字段、命令名称与协议中的历史拼写保留原样；来源映射记录在 `tools/`。
这次共提取 60 个业务模块和 1 个 vendor 模块，完成 792 处作用域内重命名；
部分嵌套回调仍保留恢复名称，可在后续功能开发中逐步整理。

## 当前接口边界

需要兼容 2.1.4 的 `/api/...` 后端。旧版 `voice-changer` 的 `/info`、`/update_settings`
接口尚未适配；新客户端不能直接替代旧前端操作该后端。
浏览器模式尚未实现全局快捷键与原生浮窗，相关能力不会报告虚假的成功状态。

个人模型、检索索引、录音、运行日志和构建包不属于源码仓库。官方示例音频不是必需项，默认样例列表为空。
