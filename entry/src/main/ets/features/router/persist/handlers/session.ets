import { registerPersistHandler } from '..'
import type { PersistDeps, PersistEvent, PersistHandler, PersistSessionBindEvent } from '../type'
import { kvSet } from '../../../../infra/storage/kv'
import { bindUserIfDefault } from '../../../../infra/storage/db'

const KV_COOKIE_DISABLE: string = 'dmm.cookie.disable.v1'

function isSessionBindEvent(ev: PersistEvent): boolean {
  return ev.type === 'SESSION_BIND'
}

class SessionPersistHandler implements PersistHandler {
  async handle(ev: PersistEvent, _deps: PersistDeps): Promise<void> {
    if (!isSessionBindEvent(ev)) return

    const e: PersistSessionBindEvent = ev as PersistSessionBindEvent
    const memberId: string = String(e.payload.data.memberId ?? '')
    if (!memberId) return

    const switched: boolean = await bindUserIfDefault(memberId)
    if (switched) {
      await kvSet(KV_COOKIE_DISABLE, false)
    }
  }
}

registerPersistHandler('SESSION_BIND', new SessionPersistHandler())