# 恢复代码迁移工具

这些工具记录从 2.1.4-alpha 发布 bundle 到可编辑 ESM 模块的迁移。日常开发直接修改 `src/`；`npm run build` 不会覆盖源码，也不运行迁移工具。

- `module-map.json`：原始顶层声明所属的功能模块。
- `semantic-names.json`：人工确认的函数词法作用域内变量名；类字段箭头函数使用 `Class.method`。
- `extract-recovered.mjs`：解析保存的基线、检查 vendor 反向依赖、生成明确的 import/export，并通过 Babel binding 重命名局部变量。
- `extraction-manifest.json`：本次迁移来源范围与输出摘要，供溯源；后续业务编辑不应为匹配这个摘要而回退。
- `renamed-bindings.json`：实际应用的变量命名记录。

只有需要重新演算此次迁移时，在干净的专用分支执行：

```sh
npm ci
node tools/extract-recovered.mjs --write
npm test
npm run build
```

这会覆盖映射中的已提取文件，不能用于合并后续手工开发成果。不可修改 `reference/v2.1.4-alpha/` 来绕过备份验证。

恢复范围仍有限：原始 TypeScript 类型、注释、JSX、部分嵌套回调变量名无法从发布 bundle 完整复原。第三方 runtime 保持打包版本；音频 Worker/Worklet 和服务器字段继续遵守原协议。后续按功能逐模块维护，另立变更替换 vendor 依赖或调整接口。

审查记录的既有问题：`FileUploaderClient.uploadFile` / `concatUploadedFile` 的 Promise 包装未转发 fetch rejection，网络失败可能使上传一直等待。该问题来自保存的基线，此次仅整理结构，后续修复应增加网络失败回归测试。
