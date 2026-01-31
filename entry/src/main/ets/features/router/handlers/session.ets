import { bindUserIfDefault } from '../../../infra/storage/db'
import { kvSet } from '../../../infra/storage/kv'
import { registerPersistHandler } from '../persist'
import { HandlerEvent, PersistHandler, PersistDeps, PersistSessionBindEvent } from '../persist/type'

const KV_COOKIE_DISABLE: string = 'dmm.cookie.disable.v1'

function isSessionBindEvent(ev: HandlerEvent): boolean {
  return ev.type === 'SESSION_BIND'
}

class SessionPersistHandler implements PersistHandler {
  async handle(ev: HandlerEvent, _deps: PersistDeps): Promise<void> {
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