import { webSocket } from '@kit.NetworkKit';
import { BusinessError } from '@kit.BasicServicesKit';
import util from '@ohos.util';
import { bus } from './bus';
import type { AnyMsg, BaseMsg, Channel } from './types';

export interface WsClientOptions {
  url: string;
  heartbeatMs?: number;
  reconnectMs?: number;
  log?: boolean;
}

export class WsClientArk {
  private ws: webSocket.WebSocket = webSocket.createWebSocket();
  private opts: Required<WsClientOptions>;
  private hbTimer: number = -1;
  private reconnectDelay: number;
  private opened: boolean = false;

  public constructor(opts: WsClientOptions) {
    const heartbeatMs: number = opts.heartbeatMs !== undefined ? opts.heartbeatMs : 15000;
    const reconnectMs: number = opts.reconnectMs !== undefined ? opts.reconnectMs : 2000;
    const log: boolean = opts.log !== undefined ? opts.log : false;
    this.opts = { url: opts.url, heartbeatMs, reconnectMs, log };
    this.reconnectDelay = this.opts.reconnectMs;
  }

  public async connect(): Promise<void> {
    this.bindEventsOnce();
    try {
      await this.ws.connect(this.opts.url);
      this.log('connect', 'issued');
    } catch (e) {
      const emsg: string = this.errToStr(e as BusinessError | Error | string | number | boolean | object | null | undefined);
      this.log('connect rejected', emsg);
      this.scheduleReconnect();
    }
  }

  public send<T extends object>(msg: BaseMsg<T>): void {
    if (!this.opened) {
      this.log('send', 'drop (not open)');
      return;
    }
    const text: string = JSON.stringify(msg);
    this.ws.send(text).catch((err: BusinessError): void => {
      this.log('send error', this.errToStr(err as object));
    });
  }

  public subscribeChannel(ch: Channel, handler: (msg: AnyMsg) => void): () => void {
    return bus.on('ch:' + ch, handler);
  }

  public subscribeType(type: string, handler: (msg: AnyMsg) => void): () => void {
    return bus.on('type:' + type, handler);
  }

  public dispose(): void {
    this.stopHeartbeat();
    this.ws.close().catch((): void => {});
  }

  // ---------- internal ----------
  private bindEventsOnce(): void {
    this.ws.on('open', (err: BusinessError): void => {
      if (err) {
        this.log('open error', this.errToStr(err as object));
        return;
      }
      this.opened = true;
      this.reconnectDelay = this.opts.reconnectMs;
      this.startHeartbeat();
      bus.emit('ws/open', { ch: 'system', type: 'open', payload: {} });
      this.log('open', 'ok');
    });

    this.ws.on('message', (_err: BusinessError, data: string | ArrayBuffer): void => {
      try {
        const text: string = typeof data === 'string'
          ? data
          : new util.TextDecoder('utf-8').decode(new Uint8Array(data as ArrayBuffer));
        const msg: AnyMsg = JSON.parse(text) as AnyMsg;
        bus.emit('ch:' + msg.ch, msg);
        bus.emit('type:' + msg.type, msg);
        bus.emit('ws/message', msg);
      } catch {
        this.log('parse', 'error');
      }
    });

    this.ws.on('close', (_err: BusinessError, res: webSocket.CloseResult): void => {
      const codeStr: string = res !== undefined ? String(res.code) : '';
      this.log('close', codeStr);
      this.opened = false;
      this.stopHeartbeat();
      bus.emit('ws/close', { ch: 'system', type: 'close', payload: {} });
      this.scheduleReconnect();
    });

    this.ws.on('error', (err: BusinessError): void => {
      this.log('error', this.errToStr(err as object));
      bus.emit('ws/error', { ch: 'system', type: 'error', payload: {} });
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.hbTimer = setInterval((): void => {
      if (!this.opened) { return; }
      this.send({ ch: 'system', type: 'ping', ts: Date.now(), payload: {} });
    }, this.opts.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.hbTimer !== -1) {
      clearInterval(this.hbTimer);
      this.hbTimer = -1;
    }
  }

  private scheduleReconnect(): void {
    const delay: number = this.reconnectDelay;
    setTimeout((): void => {
      const multiplied: number = (this.reconnectDelay * 3) / 2;
      this.reconnectDelay = multiplied < 15000 ? multiplied : 15000;
      void this.connect();
    }, delay);
  }

  private errToStr(e: BusinessError | Error | string | number | boolean | object | null | undefined): string {
    if (typeof e === 'string') { return e; }
    if (typeof e === 'number') { return String(e); }
    if (typeof e === 'boolean') { return e ? 'true' : 'false'; }
    if (e === null || e === undefined) { return 'null'; }
    if (typeof e === 'object') {
      // BusinessError
      const be: BusinessError = e as BusinessError;
      if (typeof be.message === 'string' && be.message.length > 0) { return be.message; }
      // 标准 Error
      const er: Error = e as Error;
      if (typeof er.message === 'string' && er.message.length > 0) { return er.message; }
      try { return JSON.stringify(e); } catch { return 'error'; }
    }
    return 'error';
  }

  private log(tag: string, msg: string): void {
    if (!this.opts.log) { return; }
    console.debug('[wsClientArk] ' + tag + ' - ' + msg);
  }
}
// TODO：单例（把 URL 改成局域网 IP）
let _client: WsClientArk | null = null;

export function getWsClient(): WsClientArk {
  if (_client === null) {
    _client = new WsClientArk({ url: 'ws://192.168.1.100:9001/ws', log: true });
    void _client.connect();
  }
  return _client;
}