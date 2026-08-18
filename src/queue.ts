import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { PeakWindow } from './peak.js'

export interface QueuedTask {
  id: string
  sessionId: string
  text: string
  enqueuedAt: string
  runAfter: string
  messageId?: string
}

export interface CheapStore {
  peakWindows?: PeakWindow[]
  items: QueuedTask[]
}

export function loadStore(path: string): CheapStore {
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed = JSON.parse(raw) as CheapStore
    const items = Array.isArray(parsed.items) ? parsed.items : []
    const seen = new Set<string>()
    return {
      peakWindows: Array.isArray(parsed.peakWindows) ? parsed.peakWindows : undefined,
      items: items.filter(item => {
        if (!item?.id || seen.has(item.id)) {
          return false
        }
        seen.add(item.id)
        return true
      }),
    }
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error
      ? (error as { code?: string }).code
      : undefined
    if (code === 'ENOENT') {
      return { items: [] }
    }
    throw error
  }
}

export function saveStore(path: string, store: CheapStore): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
}
