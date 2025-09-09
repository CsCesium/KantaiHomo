type Channel = 'system' | 'expedition' | 'battle' | 'log';
interface BaseMsg<T extends object> { ch: Channel; type: string; ts?: number; payload: T; }
type AnyMsg = BaseMsg<Record<string, never>>;

export interface IWsClient {
  connect(): void;
  send<T extends object>(msg: BaseMsg<T>): void;
  subscribeChannel(ch: Channel, handler: (msg: AnyMsg) => void): () => void;
  subscribeType(type: string, handler: (msg: AnyMsg) => void): () => void;
  dispose(): void;
}

class WsClientWebStub implements IWsClient {
  public connect(): void { /* no-op for web stub */ }
  public send<T extends object>(_msg: BaseMsg<T>): void { /* no-op */ }
  public subscribeChannel(_ch: Channel, _h: (m: AnyMsg) => void): () => void { return (): void => {}; }
  public subscribeType(_t: string, _h: (m: AnyMsg) => void): () => void { return (): void => {}; }
  public dispose(): void { /* no-op */ }
}

let _client: IWsClient | null = null;
export function getWsClient(): IWsClient {
  if (_client === null) _client = new WsClientWebStub();
  return _client;
}