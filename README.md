# shence-dsh-compat（DSH compat）

OpenAI 兼容协议适配器插件——**国产模型接入 DeepSeek Harness 的桥**。集思(jisi)的依赖项,与集思本体无关(2026-09-14 从 shence-jisi 拆出独立成仓)。

- 多路由注册:每条路由 = provider 名 + baseURL + apiKeyEnv + 模型目录(thinking 参数映射含 effortParam 直传);
- 现网路由:kimi-gw(moonshot)、zhipu-gw(bigmodel);
- **F35 余额枯竭检测**:401/402/403/429 + 余额语义 → `BALANCE_EXHAUSTED` + sidecar 隔离(`storages/provider-balance-exhausted.jsonl`),供集思下次 fanout/派单自动隔离该 provider;
- 纯逻辑模块 `src/balance-guard.ts`(L0 可测,导出 isBalanceExhausted/readBalanceExhausted/recordBalanceExhausted)。

## 开发

```bash
npm test        # vitest(thinking 映射 + 余额检测)
npm run build   # esbuild → lib/index.js
```
