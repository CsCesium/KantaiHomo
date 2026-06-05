export type ResourceKind =
  | 'fuel'
  | 'ammo'
  | 'steel'
  | 'bauxite'
  | 'instantBuild'
  | 'instantRepair'
  | 'devMaterial'
  | 'screw';

interface ResourceMeta {
  kind: ResourceKind;
  name: string;
  icon?: string;
}

const RES_ICON_DIR = 'resource://RAWFILE/icons/res/';

const RESOURCE_BY_ID: Record<number, ResourceMeta> = {
  1: { kind: 'fuel', name: '燃料', icon: `${RES_ICON_DIR}fuel.png` },
  2: { kind: 'ammo', name: '弹药', icon: `${RES_ICON_DIR}ammo.png` },
  3: { kind: 'steel', name: '钢材', icon: `${RES_ICON_DIR}iron.png` },
  4: { kind: 'bauxite', name: '铝土', icon: `${RES_ICON_DIR}bauxite.png` },
  5: { kind: 'instantBuild', name: '高速建造材', icon: `${RES_ICON_DIR}build.png` },
  6: { kind: 'instantRepair', name: '高速修复材', icon: `${RES_ICON_DIR}repair.png` },
  7: { kind: 'devMaterial', name: '开发资材', icon: `${RES_ICON_DIR}dev.png` },
  8: { kind: 'screw', name: '改修资材', icon: `${RES_ICON_DIR}nail.png` },
};

const RESOURCE_ID_BY_KIND: Record<ResourceKind, number> = {
  fuel: 1,
  ammo: 2,
  steel: 3,
  bauxite: 4,
  instantBuild: 5,
  instantRepair: 6,
  devMaterial: 7,
  screw: 8,
};

export function resourceMetaById(id: number | undefined): ResourceMeta | undefined {
  return id !== undefined ? RESOURCE_BY_ID[id] : undefined;
}

export function resourceNameById(id: number | undefined): string | undefined {
  return resourceMetaById(id)?.name;
}

export function resourceIconPath(kind: ResourceKind): string {
  const id = RESOURCE_ID_BY_KIND[kind];
  return RESOURCE_BY_ID[id].icon ?? '';
}

export function resourceIconPathById(id: number | undefined): string {
  return resourceMetaById(id)?.icon ?? '';
}

export function resourceGainIconPath(itemId: number | undefined, iconId: number | undefined): string {
  return resourceIconPathById(itemId) || resourceIconPathById(iconId);
}

export function resourceGainName(itemId: number | undefined, iconId: number | undefined, fallback: string = ''): string {
  return resourceNameById(itemId) ?? resourceNameById(iconId) ?? fallback;
}
