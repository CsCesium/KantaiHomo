export const enum PanelMode {
  Hidden       = 'HIDDEN',
  FloatOverlay = 'FLOAT_OVERLAY',
  BottomPanel  = 'BOTTOM_PANEL',
}

export interface PanelLayoutConfig {
  mode: PanelMode;
  // BottomPanel 模式下（vp），FloatOverlay 可忽略
  bottomPanelHeight: number;
}

/** Single ship display state for panel rendering. */
export interface ShipItem {
  id: number;
  name: string;
  shipType: string; // short type label, e.g. '駆', '戦', '空'
  level: number;
  hp: number;
  hpMax: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  /** Active slot item UIDs; -1 = empty slot. Length = actual slot count. */
  slots: number[];
  /** SlotItemEquipType (api_type[2]) per slot, parallel to slots; 0 = empty. */
  slotTypes: number[];
  /** Current carried aircraft count per slot, parallel to slots. */
  slotAirs: number[];
  /** Ex-slot UID: 0 = locked, -1 = empty, >0 = equipped item uid. */
  exSlot: number;
  /** SlotItemEquipType of the ex-slot item; 0 = locked/empty. */
  exSlotType: number;
}
