# 来源、许可与修改

本仓库基于 w-okada/voice-changer 的 `vcclient_win_cuda_2.1.4-alpha.zip`，
实际页面入口为 `dist/main/web_front/index.html`。
发布包 SHA-256：`58ced135e0768a9f382461fab13a8967520fde2d307d39c0ab4b830040f9c70f`。

`reference/v2.1.4-alpha/app.js` 保留拆分前从发布版 `assets/index-D8G8J-aW.js`
格式化、适配得到的 JavaScript；这不是原作者的 TypeScript/TSX 源码。
参考 CSS 来自 `index-GtP8_cVt.css`，ponyfill 和 public 资源来自同一发布包。
参考文件以 SHA-256 校验，不参与构建。

本仓库将恢复代码按声明依赖拆到 `src/`，把可确认的业务变量改为语义名称，
并保留来源映射与重命名清单。第三方运行库集中在 `src/vendor/recovered-runtime.js`。
`recovered/app.js` 仅作兼容入口；`recovered/app.css` 与 ponyfill 仍用于运行。
ponyfill 的主模块引用已指向 vendor，浏览器平台适配在 `src/platform/`，
连接提示和样式覆盖也由本仓库维护。未迁移 Electron 或其他桌面打包壳。

保留上游版权注释、根目录 LICENSE、`public/licenses-js.json`、
`public/licenses-py.json` 及 `public/assets/licenses/`；这些清单是发布包的来源记录，
不表示本仓库重新分发了其中全部组件。原发布包的 JVNV 样例音频（CC BY-SA 4.0）
不随本仓库分发，署名与说明保留于 `public/assets/voices/JVNV/`。
模型、个人录音、原生 EXE 和 Python 推理程序不属于本仓库。

更早的二进制分析记录保留在
[服务端仓库的 reverse_engineering/v214_native_client](https://github.com/yomihime/voice-changer/tree/8794a93889a889c358b715e4ae702a70a4d96bcd/reverse_engineering/v214_native_client)。
