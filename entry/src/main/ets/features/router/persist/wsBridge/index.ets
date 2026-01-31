import { EventBus } from '../../../../infra/net/wsClient/bus';
import type { AnyMsg, Channel } from '../../../../infra/net/wsClient/types';
import type { PersistDeps, HandlerEvent,MsgAdapter, PersistEventIdMaker, WsBridgeOptions  } from '../type';
import { persistEvent } from '../../persist';

class DefaultIdMaker implements PersistEventIdMaker {
  makeId(kind: string, keyA: number, keyB: number, ts: number): string {
    return kind + '-' + keyA.toString() + '-' + keyB.toString() + '-' + ts.toString();
  }
}

export class WsPersistBridge {
  private readonly bus: EventBus;
  private readonly deps: PersistDeps;
  private readonly adapters: MsgAdapter[];
  private readonly idMaker: PersistEventIdMaker;

  constructor(bus: EventBus, deps: PersistDeps, adapters: MsgAdapter[], options?: WsBridgeOptions) {
    this.bus = bus;
    this.deps = deps;
    this.adapters = adapters;
    this.idMaker = options && options.idMaker ? options.idMaker : new DefaultIdMaker();
  }

  start():()=>void{
    const channelSet: Set<Channel> = new Set<Channel>();
    for (let i = 0; i < this.adapters.length; i++) {
      channelSet.add(this.adapters[i].channel);
    }

    const offs: Array<() => void> = [];
    const it: IterableIterator<Channel> = channelSet.values();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const n: IteratorResult<Channel> = it.next();
      if (n.done === true) break;
      const ch: Channel = n.value;

      const off: () => void = this.bus.on(ch, (msg: AnyMsg) => {
        // 在该通道内找到所有能处理此消息的适配器
        for (let j = 0; j < this.adapters.length; j++) {
          const ad: MsgAdapter = this.adapters[j];
          if (ad.channel !== ch) continue;
          if (!ad.canHandle(msg)) continue;

          const events: HandlerEvent[] = ad.toPersistEvents(msg, this.idMaker);
          for (let k = 0; k < events.length; k++) {
            // 单条投递到持久化层
            // 不 await，保证订阅回调非阻塞；失败在 persistEvent 内部自行处理
            void persistEvent(events[k], this.deps);
          }
        }
      });

      offs.push(off);
    }
    return () => {
      for (let i = 0; i < offs.length; i++) {
        offs[i]();
      }
    };
  }
}