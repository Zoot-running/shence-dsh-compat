/**
 * L0: 故障窗口检测(v6)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { rmSync } from 'node:fs'
import { observeProviderFailure, observeProviderSuccess, readOutageWindows, inOutageWindow } from '../src/outage-guard.ts'

const tmp = '/tmp/outage-test-home'
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
  delete process.env.DSH_HOME
  vi.restoreAllMocks()
})

describe('outage guard', () => {
  it('120s 内连续 3 次失败 → 记窗口; 窗口内时间点命中', () => {
    process.env.DSH_HOME = tmp
    const t0 = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(t0)
    observeProviderFailure('kimi-gw')
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 10_000)
    observeProviderFailure('kimi-gw')
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 20_000)
    observeProviderFailure('kimi-gw')
    const ws = readOutageWindows()
    expect(ws.length).toBe(1)
    expect(ws[0]).toMatchObject({ provider: 'kimi-gw', to: null })
    expect(inOutageWindow(t0 + 25_000, ws)).toBe(true)
  })
  it('间隔超 120s 重新计数, 不记窗口', () => {
    process.env.DSH_HOME = tmp
    const t0 = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(t0)
    observeProviderFailure('kimi-gw')
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 200_000)
    observeProviderFailure('kimi-gw')
    vi.spyOn(Date, 'now').mockReturnValue(t0 + 400_000)
    observeProviderFailure('kimi-gw')
    expect(readOutageWindows().length).toBe(0)
  })
  it('成功重置突发计数', () => {
    process.env.DSH_HOME = tmp
    const t0 = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(t0)
    observeProviderFailure('kimi-gw')
    observeProviderFailure('kimi-gw')
    observeProviderSuccess('kimi-gw')
    observeProviderFailure('kimi-gw')
    observeProviderFailure('kimi-gw')
    expect(readOutageWindows().length).toBe(0)
  })
})
