import { ApiDump } from "../../../infra/web/types"
import { PersistEvent, PersistEventPort, PersistSessionBindEvent, PortEventPayloads } from "../../router/persist/type"
import { parsePort } from "../module"
import { DumpPipeline, ParseResult, registerPipeline } from "../pipeline"


export const portPipeline: DumpPipeline = {
  name: 'port',
  match: (url) => url.includes('/api_port/port'),

  parse: (dump: ApiDump): ParseResult | null => {
    const evts = parsePort(dump);
    if (!evts?.length) return null;

    const preEvents: PersistEvent[] = [];
    const mainEvents: PersistEvent[] = [];

    for (const e of evts) {
      if (e.type === 'SESSION_BIND') {
        preEvents.push(e);  // SESSION_BIND 必须先执行
      } else {
        mainEvents.push(e); // 其他 PORT_* 事件可并发
      }
    }

    return { preEvents, mainEvents };
  }
};

registerPipeline(portPipeline);