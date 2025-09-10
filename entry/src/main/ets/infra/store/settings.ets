import { kvGetBool } from './kv';

export interface Settings {
  isEnabled(key: string, defValue?: boolean): Promise<boolean>;
}

export class KvSettings implements Settings {
  async isEnabled(key: string, defValue: boolean = true): Promise<boolean> {
    return kvGetBool(key, defValue);
  }
}