/**
 * Mission name cache — pure TS, importable from handler layer.
 * Populated via EXPEDITION_CATALOG events.
 */

const _cache = new Map<number, string>();

export function cacheMissionNames(missions: ReadonlyArray<{ id: number; name: string }>): void {
  for (const m of missions) {
    _cache.set(m.id, m.name);
  }
}

export function getMissionName(missionId: number): string {
  return _cache.get(missionId) ?? `任务 ${missionId}`;
}
