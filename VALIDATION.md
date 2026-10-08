# 验证范围（2026-09-27）

- Node.js 24.20.0：独立构建与全部运行时 JavaScript 语法检查通过。
- `npm test`：9 项测试通过，覆盖平台适配、静态服务、HTTP 上传代理、来源隔离、
  离线响应、WebSocket 转发与连接清理，以及新增的参考文件 SHA-256、模块依赖和 API 契约检查。
- 模块检查验证命名导入可解析、静态依赖无环、vendor 不反向依赖业务模块。
- Chrome 无头浏览器：主页、模型上传窗口、高级设置、按键设置与独立日志页通过；
  未出现未捕获的 JavaScript 错误；日志页关闭后主页面保留。
- 拆分前保存副本也通过同一组浏览器检查；主页文字和截图逐字节一致。
  上传窗口含随时间变化的通知进度，按控件显示与关闭交互验证。

复现方式：`npm ci`、`npm run build`、`npm test`、`npm run test:browser`。
浏览器检查需要本机 Chrome，或通过 `CHROME_PATH` 指定 Chromium 可执行文件。
证据保存在忽略的 `.runtime/browser-smoke/`，不纳入 Git。
浏览器测试拒绝真实麦克风采集，未连接推理服务、上传私人模型或测试实际变声质量。

## Tauri Windows 试用

Rust `cargo test --locked`：22 项通过，覆盖代理、来源限制、原生命令、快捷键配置回滚、
缓存清理路径检查，以及真实 Windows 文件锁的释放与超时处理。

在实际 WebView2 中验证安装包安装后的 EXE，以及 release 独立 EXE。检查通过：

- 主页、高级设置、按键设置，以及通过界面上传内存生成的测试文件。
- HTTP 配置更新、二进制 WebSocket 往返。
- 原有 AudioWorklet 处理 48 kHz 合成音频，经模拟后端返回 960 个采样点。
- 原生快捷键注册、配置持久化、Rust 到页面的通知事件。
- 独立日志窗口、窗口权限隔离、关闭日志后主窗口保留。
- 重启保留配置、清除站点数据后重启、退出时关闭本地代理。

证据在忽略的 `.runtime/tauri-installed-smoke/` 与 `.runtime/tauri-release-smoke/`。
每次测试使用独立配置目录；不会读取私人模型或采集真实麦克风。
复现命令与产物说明见 [TAURI.md](TAURI.md)。

实际物理按键触发尚未验证：本自动化会话的 Windows SendInput 返回 Access denied。
快捷键提示目前显示在应用内，原生桌面浮窗尚未实现。
2.1.4 客户端与旧版服务端协议的适配也尚未完成；模拟后端检查不代表真实模型推理已通过。

## 2026-10-08 提交前复核

- Node 24.20.0：独立前端构建、9 项测试与 Chrome 浏览器检查通过。
- Rust：`cargo test --locked --offline` 的 22 项测试通过。
- Tauri 2：本次重新生成 release EXE 与 NSIS 安装包；真实 WebView2 的模拟后端集成检查通过，报告在忽略目录 `.runtime/tauri-commit-20261008/`。
- 本次未重新安装/卸载 NSIS，未采集真实麦克风、运行真实模型或测试物理快捷键；旧协议兼容和原生浮窗仍未完成。
