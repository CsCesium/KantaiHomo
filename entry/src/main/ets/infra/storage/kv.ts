//src/main/ets/infra/storage/kv.ts
import preferences from '@ohos.data.preferences';
import { getAppContext } from '../appContext';

let pref: preferences.Preferences | null = null;
const PREF_FILE = 'kchomo_prefs';

async function getPrefs(): Promise<preferences.Preferences> {
  if (pref) {
    return pref;
  }
  pref = await preferences.getPreferences(getAppContext(), PREF_FILE);
  return pref;
}

export async function kvSet(key: string, val: number | string | boolean): Promise<void> {
  const p = await getPrefs();
  await p.put(key, val);
  await p.flush();
}

export async function kvDelete(key: string): Promise<void> {
  const p = await getPrefs();
  await p.delete(key);
  await p.flush();
}

export async function kvGetBool(key: string, def = false): Promise<boolean> {
  const p = await getPrefs();
  const v = await p.get(key, def);
  return Boolean(v);
}

export async function kvGetNumber(key: string, def = 0): Promise<number> {
  const p = await getPrefs();
  const v = await p.get(key, def);
  return Number(v);
}

export async function kvGetString(key: string, def = ''): Promise<string> {
  const p = await getPrefs();
  const v = await p.get(key, def);
  return String(v);
}