/**
 * 平台/供应商故障窗口检测(v6): 连续 TRANSPORT/5xx 突发 → 记录 outage 窗口到 sidecar。
 * 用途: 宿主(runner)据此把窗口内的 failed 终态从"死思路"计数里剔除——
 * 昨晚 DS 故障时段, 执行者死于 LLM 调用, 不是思路死(用户实锤)。
 * 纯逻辑 + node:fs, 与 balance-guard 同模式。
 * @module @shence/dsh-compat/outage-guard
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface OutageWindow {
  provider: string
  from: number
  to: number | null
}

/** 进程内突发计数器: provider → {consecutive, windowStart, closed}。 */
const bursts = new Map<string, { consecutive: number; start: number; lastAt: number; open: boolean }>()

/** 判定为故障突发: 120s 内连续 ≥3 次 transport/5xx。 */
export const OUTAGE_BURST_N = 3
export const OUTAGE_BURST_MS = 120_000

export function observeProviderFailure(provider: string, now = Date.now()): void {
  const b = bursts.get(provider) ?? { consecutive: 0, start: now, lastAt: 0, open: false }
  if (now - b.lastAt > OUTAGE_BURST_MS) {
    b.consecutive = 1
    b.start = now
    b.open = false
  } else {
    b.consecutive += 1
    if (!b.open && b.consecutive >= OUTAGE_BURST_N) {
      b.open = true
      recordOutage(provider, b.start, null)
    }
  }
  b.lastAt = now
  bursts.set(provider, b)
}

export function observeProviderSuccess(provider: string, now = Date.now()): void {
  const b = bursts.get(provider)
  if (b === undefined) return
  bursts.set(provider, { consecutive: 0, start: now, lastAt: now, open: false })
}

function recordOutage(provider: string, from: number, to: number | null): void {
  try {
    const dir = join(process.env.DSH_HOME ?? '.', 'storages')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'provider-outages.jsonl'),
      JSON.stringify({ provider, from, to, recordedAt: Date.now() }) + '\n')
  } catch { /* 落盘失败不致命 */ }
}

export function readOutageWindows(): OutageWindow[] {
  try {
    const p = join(process.env.DSH_HOME ?? '.', 'storages', 'provider-outages.jsonl')
    if (!existsSync(p)) return []
    return readFileSync(p, 'utf8').split('\n').filter(l => l.trim() !== '')
      .map(l => { try { return JSON.parse(l) as OutageWindow } catch { return null } })
      .filter((r): r is OutageWindow => r !== null)
  } catch { return [] }
}

/** 时间点是否落在任一故障窗口内(窗口未闭合视为一直开着, 保守过滤)。 */
export function inOutageWindow(at: number, windows: OutageWindow[]): boolean {
  return windows.some(w => at >= w.from && (w.to === null || at <= w.to))
}
