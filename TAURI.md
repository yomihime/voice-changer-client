# Tauri 2 Windows 试用

这是独立客户端的试验性桌面入口。EXE 内嵌前端和 Rust HTTP/WebSocket 代理，
不附带 Node、Electron、模型或推理服务。Windows 使用系统 WebView2；安装程序在缺少
WebView2 时下载安装 Evergreen Runtime，因此安装包体积不包含该共享运行时。

## 构建和运行

需要 Node.js 24.20+（24.x）、Rust 1.94+ MSVC 工具链、Visual Studio C++ Build Tools、
Windows SDK 和 WebView2。依赖已锁定于 package-lock.json 与 src-tauri/Cargo.lock。

```powershell
npm ci
npm run desktop:dev
npm run desktop:build
```

构建仅在客户端仓库内运行，`dist/` 是页面资源；Rust 中间产物、EXE 与安装包位于
`src-tauri/target/`，全部忽略。打包工具缓存也在 `target/.tauri/`，不进入源码仓库。
EXE 位于 `src-tauri/target/release/voice-changer-client.exe`；安装包在其 `bundle/nsis/` 下。
普通 `npm run dev` 仍可在浏览器中使用，不要求 Rust。

```powershell
.\voice-changer-client.exe
.\voice-changer-client.exe --offline
```

通常起動では毎回 `http://localhost:18888/` を有限時間で確認します。失敗した場合は
アドレス画面で再試行、または別の URL を入力できます。HTTP / HTTPS、IPv4 / IPv6、
ホスト名、LAN とベースパスに対応します。認証情報・query・fragment は受け付けません。
保存した手動 URL と `--backend` は入力欄の初期値です。既定の探測を省略しません。
画面用の loopback ポートは 21416 を優先し、使用中なら空きポートへ自動で回退します。
`--port` の指定は通常不要です。`--offline` は接続を行わない UI 診断用です。

配置默认在 `%APPDATA%/io.github.yomihime.voicechanger.client/`；
`--profile-dir <绝对路径>` 可使用隔离配置。WebView 数据和快捷键配置属于客户端。
接続先とグローバル設定は schema 付き原生 profile に保存します。旧 IndexedDB は保持し、
初回に原生設定へ移行します。旧 21416 が他プロセスに占有されていても、専用 WebView の
ローカル応答から読み取り、占有プロセスへ接続しません。移行失敗時は元データを保持して
エラーを表示します。保存設定の削除は明示的な clear-site-data 操作で行います。

## 当前能力和边界

- 内嵌页面、本地 HTTP 上传与配置请求、二进制 WebSocket、AudioWorklet。
- 日志使用独立窗口，不初始化音频设备或注册第二份快捷键。
- 全局快捷键默认关闭，可在按键设置中启用；注册冲突会提示，配置更新失败会回滚。
- 快捷键反馈显示在应用内，尚未重现原生桌面浮窗。
- 主窗口只允许本应用页面导航；外链通过受限的 HTTPS opener 打开。
- 麦克风交给 WebView2 权限提示；日志窗口、摄像头等不需要的权限拒绝。
- 关闭主窗口会退出子窗口和代理，推理服务保持独立。
- 清除站点数据会退出客户端；下次启动前清理其 WebView 数据，保留原生快捷键配置。

`/info` の実フィールドから旧 VCC を識別し、LegacyVccAdapter で制御します。2.x の
`/api/...` も維持します。機能ごとの対応状況は接続画面と無効化された操作の説明で確認できます。
Client Device はクライアント PC、Server Device はバックエンド PC のデバイスです。
音声の実機検証状態と段階別 commit は、親 `voice-changer` の唯一の総記録
`docs/development/implementation-progress.md` を参照してください。

旧 VCC の音声合同は `/test` の JSON、単一チャンネル little-endian Int16 の base64 です。
Float32 との変換はクライアント境界で一度だけ行い、履歴・resampling・SOLA は既存サーバーが
担当します。同じセッションへ HTTP と Socket.IO の音声を重複送信しません。
アップロードはクライアントが生成する独立リソース名を使い、クライアントのローカルパスを
サーバー上のパスとして扱いません。登録は安全な `/load_model_if_empty` 能力を持つ fork の
空の数値 slot に限定し、競合や失敗時の部分ファイルを保持します。能力のない旧 Server では
登録操作に理由を表示します。既存 `/load_model` の上書き動作は従来の呼び出しに従います。

## 复现测试

2026-09-27 本机验证：NSIS 安装包约 **2.85 MiB**，独立 EXE 约 **10.18 MiB**。
体积不含系统 WebView2。安装与静默卸载均返回 0；测试安装在验证后移除，保留构建产物。
Node 测试 9 项、Rust 测试 22 项通过。真实 WebView2 中的页面、上传、代理、合成音频、
日志窗口与重启测试见 [VALIDATION.md](VALIDATION.md)。缓存清理会等待 WebView2 的短暂文件锁，
最多重试 10 秒；仍失败时保留清理标记并报告错误。

```powershell
npm test
cargo test --manifest-path src-tauri/Cargo.toml --locked
npm run test:desktop
```

`test:desktop` 在真实 WebView2 中启动 release EXE，使用独立临时配置、隐藏窗口、模拟后端
和合成音频，拒绝真实麦克风。上传的 `synthetic-test.pth` 只是内存中的文本测试数据，
不读取模型目录。测试通过 CDP 控制本次进程，调试端口只由测试环境变量开启。

- `TAURI_TEST_EXE`：指定待测 EXE（包括安装后的程序）。
- `TAURI_TEST_OUTPUT`：指定报告和截图目录，默认 `.runtime/tauri-smoke/`。
- `TAURI_TEST_SEND_KEYS=1`：在允许 SendInput 的交互式 Windows 会话额外验证 OS 按键触发。
  默认只验证原生注册、配置保存和 Rust → WebView 事件；本次自动化环境的 SendInput
  返回 Access denied，实际物理按键触发仍需手动确认。

产物尚未签名，也没有自动更新；这是本地试用打包，不是正式发布。
官方依据：[Windows 前置环境](https://v2.tauri.app/start/prerequisites/)、
[Windows 安装包与 WebView2](https://v2.tauri.app/distribute/windows-installer/)。
