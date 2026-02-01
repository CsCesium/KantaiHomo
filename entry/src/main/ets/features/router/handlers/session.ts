import { SessionBindEvent } from '../../../domain/events/session'
import { bindUserIfDefault } from '../../../infra/storage/db'
import { kvSet } from '../../../infra/storage/kv'
import { registerHandler } from '../persist/registry'
import { HandlerEvent, Handler, PersistDeps } from '../persist/type'

const KV_COOKIE_DISABLE: string = 'dmm.cookie.disable.v1'

function isSessionBindEvent(ev: HandlerEvent): boolean {
  return ev.type === 'SESSION_BIND'
}

class SessionPersistHandler implements Handler {
  async handle(ev: SessionBindEvent, _deps: PersistDeps): Promise<void> {
    if (!isSessionBindEvent(ev)) return

    const  memberId  = ev.payload.memberId;
    if (!memberId) return

    const switched: boolean = await bindUserIfDefault(memberId)
    if (switched) {
      await kvSet(KV_COOKIE_DISABLE, false)
    }
  }
}

registerHandler('SESSION_BIND', new SessionPersistHandler())