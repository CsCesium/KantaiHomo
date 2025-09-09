import { bus } from "./bus";
import { webSocket } from '@kit.NetworkKit';
import {BusinessError} from '@kit.BasicServicesKit'
import { util } from '@kit.ArkTS'
import type { AnyMsg, BaseMsg, Channel } from "./types";

export interface WsClientOptions {
  url: string;                    // ws://192.168.1.10:9001/ws
  heartbeatMs?: number;           // 心跳间隔，默认 15s
  reconnectMs?: number;           // 初始重连间隔，默认 2s（指数退避至 15s）
  log?: boolean;
}

export class WsClientArk {
  private ws = webSocket.createWebSocket();               // API9+：通过 NetworkKit 创建
  private opts: Required<WsClientOptions>;
  private hbTimer?: number;
  private reconnectDelay: number;
  private opened = false;

  constructor(opts: WsClientOptions) {
    this.opts = { heartbeatMs: 15000, reconnectMs: 2000, log: false, ...opts };
    this.reconnectDelay = this.opts.reconnectMs;
  }

  async connect() {
    this.bindEventsOnce();

    try {
      // API9+：connect 支持 Promise 形式
      await this.ws.connect(this.opts.url);
      this.log('connect requested');
    } catch (e) {
      this.log('connect rejected', e);
      this.scheduleReconnect();
    }
  }

  send<T>(msg: BaseMsg<T>) {
    const text = JSON.stringify(msg);
    // API9+：send 支持 Promise / Callback
    this.ws.send(text).catch((err: BusinessError) => this.log('send error', err));
  }

  subscribeChannel<T = AnyMsg>(ch: Channel, handler: (msg: T) => void) {
    return bus.on<T>(`ch:${ch}`, handler);
  }
  subscribeType<T = AnyMsg>(type: string, handler: (msg: T) => void) {
    return bus.on<T>(`type:${type}`, handler);
  }

  dispose() {
    this.stopHeartbeat();
    // API9+：close 同样支持 Promise / Callback
    this.ws.close().catch(() => {});
  }

  // ------- internal -------
  private bindEventsOnce() {
    // open
    this.ws.on('open', (err: BusinessError, value: Object) => {
      if (err) { this.log('open error', err); return; }
      this.log('open', value);
      this.opened = true;
      this.reconnectDelay = this.opts.reconnectMs;
      this.startHeartbeat();
      bus.emit('ws/open', undefined);
    });

    // message
    this.ws.on('message', (_err: BusinessError, data: string | ArrayBuffer) => {
      try {
        const text = (typeof data === 'string')
          ? data
          : (() => {
          const view = new Uint8Array(data as ArrayBuffer);
          const decoder = util.TextDecoder.create('utf-8', { ignoreBOM: true });
          return decoder.decodeToString(view);
        })();

        const msg = JSON.parse(text) as AnyMsg;
        bus.emit(`ch:${msg.ch}`, msg);
        bus.emit(`type:${msg.type}`, msg);
        bus.emit('ws/message', msg);
      } catch (e) {
        this.log('parse error', e);
      }
    });

    // close
    this.ws.on('close', (_err: BusinessError, res: webSocket.CloseResult) => {
      this.log('close', res?.code, res?.reason);
      this.opened = false;
      this.stopHeartbeat();
      bus.emit('ws/close', res);
      this.scheduleReconnect();
    });

    // error
    this.ws.on('error', (err: BusinessError) => {
      this.log('error', err);
      // 2302998: 域名未被允许（见文档）
      bus.emit('ws/error', err);
    });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.hbTimer = setInterval(() => {
      if (!this.opened) return;
      this.send({ ch: 'system', type: 'ping', ts: Date.now(), payload: {} });
    }, this.opts.heartbeatMs) as unknown as number;
  }

  private stopHeartbeat() {
    if (this.hbTimer) clearInterval(this.hbTimer);
    this.hbTimer = undefined;
  }

  private scheduleReconnect() {
    setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 15000);
      this.connect();
    }, this.reconnectDelay);
  }

  private log(...a: any[]) { if (this.opts.log) console.debug('[wsClientArk]', ...a); }
}

// 单例
let _client: WsClientArk | null = null;
export function getWsClient(): WsClientArk {
  if (!_client) {
    // 避免 127.0.0.1/localhost 在模拟器环境的环回歧义
    _client = new WsClientArk({ url: 'ws://192.168.1.100:9001/ws', log: true });
    _client.connect();
  }
  return _client;
}