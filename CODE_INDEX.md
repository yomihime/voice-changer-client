# 前端代码导航

日常开发编辑 `src/`。`reference/v2.1.4-alpha/` 为不可变恢复基线，`tools/extract-recovered.mjs` 仅用于重放此次迁移，不参与正常构建。

| 可编辑模块 | 原始名称 | 基线行范围 |
| --- | --- | --- |
| [src/platform/bridge.js](src/platform/bridge.js) | `invokeDesktop`, `listenDesktop`, `transformCallback`, `invoke`, `TauriEvent`, `_unlisten`, `listen` | 2–2, 102257–102259, 102260–102262, 105180–105180, 105181–105196, 105197–105199, 105200–105209 |
| [src/state/app-root-context.js](src/state/app-root-context.js) | `AppRootContext`, `useAppRoot` | 13566–13566, 13567–13573 |
| [src/shared/logger.js](src/shared/logger.js) | `log$1` | 13574–13580 |
| [src/pages/LogViewer.js](src/pages/LogViewer.js) | `codeFilename$6`, `logPrefix$6`, `LogViewer` | 22959–22959, 22960–22960, 22961–23225 |
| [src/state/app-state-context.js](src/state/app-state-context.js) | `AppStateContext`, `useAppState` | 23226–23226, 23227–23233 |
| [src/audio/elements.js](src/audio/elements.js) | `AUDIO_ELEMENT_FOR_PLAY_RESULT`, `AUDIO_ELEMENT_FOR_PLAY_MONITOR`, `AUDIO_ELEMENT_FOR_INPUT_MEDIA`, `AUDIO_ELEMENT_FOR_INPUT_MEDIA_ECHOBACK` | 31361–31361, 31362–31362, 31363–31363, 31364–31365 |
| [src/i18n/setup.js](src/i18n/setup.js) |  | 34545–34553 |
| [src/features/settings/LinkArea.js](src/features/settings/LinkArea.js) | `languageNativeNames`, `LinkArea` | 34554–34568, 34652–34815 |
| [src/components/common/ConfirmationDialog.js](src/components/common/ConfirmationDialog.js) | `ConfirmationDialog` | 34569–34651 |
| [src/audio/wav.js](src/audio/wav.js) | `downloadAsWav` | 34817–34853 |
| [src/domain/constants.js](src/domain/constants.js) | `MAX_SLOT_INDEX`, `VOICE_CHANGER_CLIENT_EXCEPTION`, `VoiceChangerInputMode`, `VoiceChangerType`, `EmbedderType`, `PitchEstimatorType`, `InputAudioType` | 35047–35047, 35048–35048, 35049–35049, 35050–35050, 35051–35061, 35062–35070, 98985–98990 |
| [src/api/FileUploaderClient.js](src/api/FileUploaderClient.js) | `FileUploaderClient` | 35071–35126 |
| [src/api/results.js](src/api/results.js) | `RestResult`, `Ok`, `Err` | 35127–35127, 35128–35139, 35140–35151 |
| [src/api/RestClient.js](src/api/RestClient.js) | `RestClient` | 35152–35267 |
| [src/api/VoiceChangerApiClient.js](src/api/VoiceChangerApiClient.js) | `VCRestClient` | 35268–35501 |
| [src/audio/worker-source.js](src/audio/worker-source.js) | `workerjs` | 35502–35722 |
| [src/audio/VoiceChangerWorkletNode.js](src/audio/VoiceChangerWorkletNode.js) | `log`, `LOG_PREFIX$1`, `VoiceChangerWorkletNode` | 37950–37956, 37957–37957, 37958–38280 |
| [src/audio/BlockingQueue.js](src/audio/BlockingQueue.js) | `BlockingQueue` | 93685–93713 |
| [src/audio/VoiceChangerClient.js](src/audio/VoiceChangerClient.js) | `createDummyMediaStream`, `validateUrl`, `LOG_PREFIX`, `VoiceChangerClient` | 93714–93720, 93721–93721, 93722–93722, 93723–94034 |
| [src/features/models/ModelActions.js](src/features/models/ModelActions.js) | `RightButtonArea` | 94035–94725 |
| [src/features/models/ModelIcon.js](src/features/models/ModelIcon.js) | `IconArea` | 94726–94872 |
| [src/components/icons.js](src/components/icons.js) | `TagIcon`, `CloseIcon`, `AudioFile`, `Edit`, `ExpandLess`, `ExpandMore`, `FiberManualRecord`, `GraphicEq`, `LibraryMusic`, `Loop`, `Mic`, `NetworkPing`, `PlayArrow`, `ScreenShare`, `Send`, `Settings`, `Stop`, `SwapHoriz`, `Tune`, `VolumeUp`, `WaveformIcon`, `WaveformPlusIcon`, `EmbedderIcon`, `IndexIcon` | 94873–94890, 95206–95210, 95606–95610, 95611–95615, 95616–95620, 95621–95625, 95626–95628, 95629–95633, 95634–95638, 95639–95643, 95644–95648, 95649–95653, 95654–95656, 95657–95661, 95662–95666, 95667–95671, 95672–95672, 95673–95677, 95678–95682, 95683–95687, 100083–100109, 100110–100110, 100111–100159, 100160–100160, 100161–100257, 100258–100258, 100259–100358, 100359–100359 |
| [src/features/models/ModelInfo.js](src/features/models/ModelInfo.js) | `InfoArea` | 94891–95205 |
| [src/features/models/ModelUploadDialog.js](src/features/models/ModelUploadDialog.js) | `ModelUploadDialog` | 95211–95605 |
| [src/components/common/DownloadProgressDialog.js](src/components/common/DownloadProgressDialog.js) | `DownloadProgressDialog` | 95688–95756 |
| [src/features/models/SampleModelDialog.js](src/features/models/SampleModelDialog.js) | `SampleModelDailog` | 95757–96022 |
| [src/features/models/ModelList.js](src/features/models/ModelList.js) | `ModelList` | 96023–96149 |
| [src/features/models/ModelEditDialog.js](src/features/models/ModelEditDialog.js) | `ModelEditDialog` | 96150–96225 |
| [src/features/models/ModelSelector.js](src/features/models/ModelSelector.js) | `ModelSelector` | 96226–96654 |
| [src/features/voice/HeaderArea.js](src/features/voice/HeaderArea.js) | `HeaderArea` | 96655–96725 |
| [src/features/voice/VoiceCharacterEditDialog.js](src/features/voice/VoiceCharacterEditDialog.js) | `codeFilename$5`, `logPrefix$5`, `VoiceCharacterEditDialog` | 96726–96726, 96727–96727, 96728–96947 |
| [src/features/voice/PortraitArea.js](src/features/voice/PortraitArea.js) | `codeFilename$4`, `logPrefix$4`, `PortraitArea` | 96948–96948, 96949–96949, 96950–97238 |
| [src/components/common/WaitingDialog.js](src/components/common/WaitingDialog.js) | `WaitingDialog` | 97239–97262 |
| [src/features/audio-controls/SettingsDialog.js](src/features/audio-controls/SettingsDialog.js) | `SettingsDialog` | 97263–98347 |
| [src/shared/recordings.js](src/shared/recordings.js) | `generateTimestamp`, `downloadFile`, `downloadServerRecordingFiles` | 98348–98357, 98358–98367, 98368–98374 |
| [src/features/audio-controls/MainControls.js](src/features/audio-controls/MainControls.js) | `MainControls` | 98375–98751 |
| [src/storage/settings.js](src/storage/settings.js) | `DB_NAME`, `DB_VERSION`, `STORE_NAME`, `db`, `initDB`, `saveSettings`, `loadSettings` | 98968–98968, 98969–98969, 98970–98970, 98971–98971, 98972–98980, 98981–98983, 98984–98984 |
| [src/hooks/useGlobalSetting.js](src/hooks/useGlobalSetting.js) | `useGlobalSetting` | 98991–99129 |
| [src/features/audio-controls/InputControls.js](src/features/audio-controls/InputControls.js) | `isDesktopApp`, `InputControls` | 99130–99130, 99131–99821 |
| [src/features/audio-controls/VolumeControls.js](src/features/audio-controls/VolumeControls.js) | `VolumeControls` | 99822–100039 |
| [src/hooks/useAppGuiSetting.js](src/hooks/useAppGuiSetting.js) | `defaultAppGuiSettin`, `useAppGuiSetting` | 100040–100045, 100046–100082 |
| [src/features/voice/VoiceControls.js](src/features/voice/VoiceControls.js) | `VoiceControls` | 100360–100887 |
| [src/features/audio-controls/Controls.js](src/features/audio-controls/Controls.js) | `Controls` | 100888–100914 |
| [src/features/performance/PerformanceArea.js](src/features/performance/PerformanceArea.js) | `codeFilename$3`, `logPrefix$3`, `Y_AXIS_MULTIPLIER`, `PerformanceArea` | 100915–100915, 100916–100916, 100917–100917, 100918–101329 |
| [src/pages/ControlArea.js](src/pages/ControlArea.js) | `ControlArea` | 101330–101365 |
| [src/features/settings/AdvancedSettingDialog.js](src/features/settings/AdvancedSettingDialog.js) | `AdvancedSettingDialog` | 101366–101751 |
| [src/state/hotkey-context.js](src/state/hotkey-context.js) | `HotkeyContext`, `useHotkey` | 101752–101752, 101753–101759 |
| [src/features/settings/ShortcutSettingDialog.js](src/features/settings/ShortcutSettingDialog.js) | `ShortcutSettingDialog` | 101760–102214 |
| [src/components/common/ConfirmDialog.js](src/components/common/ConfirmDialog.js) | `ConfirmDialog` | 102215–102255 |
| [src/features/settings/AdvancedArea.js](src/features/settings/AdvancedArea.js) | `AdvancedArea` | 102263–102352 |
| [src/pages/VoiceChangerPage.js](src/pages/VoiceChangerPage.js) | `Demo` | 102353–102397 |
| [src/app/App.js](src/app/App.js) | `App` | 102398–102418 |
| [src/hooks/useAudioConfig.js](src/hooks/useAudioConfig.js) | `codeFilename$2`, `logPrefix$2`, `useAudioConfig` | 102419–102419, 102420–102420, 102421–102507 |
| [src/hooks/useServerConfig.js](src/hooks/useServerConfig.js) | `codeFilename$1`, `logPrefix$1`, `DefaultServerConfiguration`, `useServerConfig` | 102508–102508, 102509–102509, 102510–102544, 102545–102828 |
| [src/state/AppRootProvider.js](src/state/AppRootProvider.js) | `AppRootProvider` | 104772–104852 |
| [src/hooks/useVoiceChangerClient.js](src/hooks/useVoiceChangerClient.js) | `codeFilename`, `logPrefix`, `useVoiceChangerClient` | 104853–104853, 104854–104854, 104855–105160 |
| [src/state/AppStateProvider.js](src/state/AppStateProvider.js) | `AppStateProvider` | 105161–105179 |
| [src/hooks/useHotKeySetting.js](src/hooks/useHotKeySetting.js) | `useHotKeySetting` | 105210–105597 |
| [src/state/HotkeyProvider.js](src/state/HotkeyProvider.js) | `HotkeyProvider` | 105598–105604 |
| [src/app/mount.js](src/app/mount.js) |  | 105605–105617 |

第三方打包代码保留在 [src/vendor/recovered-runtime.js](src/vendor/recovered-runtime.js)，应用模块只通过命名导出使用它。不要在 vendor 内添加业务逻辑。

`tools/module-map.json` 记录模块归属；`semantic-names.json` 是经人工确认的作用域命名；`renamed-bindings.json` 记录实际成功的重命名；`extraction-manifest.json` 记录初次迁移来源，不是后续开发约束。
