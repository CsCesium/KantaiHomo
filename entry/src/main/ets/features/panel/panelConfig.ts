/**
 * Centralized visual configuration for the game info panel.
 *
 * Color scheme references KC3Kai's dark navy UI aesthetic.
 * All colors, dimensions, font sizes, and thresholds are defined here;
 * no changes needed inside individual UI component files.
 *
 * Color format: ArkUI uses #AARRGGBB (alpha first) for 8-digit hex.
 */

// ── Color palette ──────────────────────────────────────────────────────────

export const PanelColors = {
  // Backgrounds
  bg:            '#1a1d2e',   // main panel background (dark navy)
  bgSection:     '#20243a',   // ship row / content section
  bgTabs:        '#151829',   // tab bar row (darkest layer)
  bgTabInactive: '#252940',   // inactive tab background
  bgInfoOn:      '#2e3355',   // active info-type sub-tab
  bgHeader:      '#151829',   // ship list column header row
  bgHpTrack:     '#0c0e18',   // HP progress bar track
  bgBtn:         '#252940',   // action button background
  bgAvatar:      '#1e2244',   // avatar placeholder area

  // Text
  txtPrimary:    '#e8eaf0',   // ship name, primary content
  txtSub:        '#8890a8',   // level label, secondary info
  txtMuted:      '#606478',   // status bar values, type badge
  txtFainter:    '#404558',   // column header, very-dimmed labels
  txtSep:        '#2a2e45',   // status bar '|' separator
  txtTabOn:      '#ffffff',   // text on colored fleet tabs
  txtInfoOn:     '#c8cce0',   // active info-type tab label
  txtInfoOff:    '#505570',   // inactive info-type tab label

  // Stats
  stat:          '#56d8e0',   // all stat value columns (bright teal)

  // HP states
  hpOk:          '#43a047',   // hp ratio > 50%  — green
  hpWarn:        '#fdd835',   // hp ratio 25-50% — yellow
  hpCrit:        '#e53935',   // hp ratio ≤ 25%  — red

  // Row separators
  rowBorder:     '#20243a',

  // FloatOverlay specific
  overlayBg:     '#c01a1d2e', // ~75% opaque dark navy (#AARRGGBB)
  overlayBtn:    '#25294066', // semi-transparent button
  overlayRow:    '#252940',   // row separator + HP track in overlay
  overlayHdr:    '#2a2e45',   // status line bottom border
  overlayTxt:    '#8890a8',   // status text in overlay
} as const;

/**
 * Solid background color for each fleet / category tab, by tab index.
 * Inactive tabs use these colors at reduced opacity; active tab at full opacity.
 * Inspired by KC3Kai's per-fleet color coding.
 */
export const FLEET_TAB_COLORS: readonly string[] = [
  '#1b5e20',  // Fleet I   — deep green
  '#0d47a1',  // Fleet II  — deep blue
  '#006064',  // Fleet III — deep teal
  '#263238',  // Fleet IV  — dark blue-grey
  '#4e342e',  // 基地       — warm brown (base air corps)
  '#4a148c',  // 道具       — deep purple (supplies)
];

// ── Dimensions ─────────────────────────────────────────────────────────────

export const PanelDimens = {
  // Section heights (vp)
  tabBarH:     32,
  statusBarH:  22,
  listHdrH:    24,
  rowH:        54,   // ship row — expanded 2-line layout (BottomPanel)
  rowCompH:    44,   // ship row — compact 2-line layout (FloatOverlay)
  hpBarH:       5,   // HP bar height — expanded
  hpBarCompH:   4,   // HP bar height — compact
  btnH:        28,
  btnCompH:    24,

  // Column widths (vp)
  avatarW:     48,   // avatar placeholder column
  levelW:      36,   // Lv. label fixed width
  statW:       32,   // stat number column (expanded)
  statCompW:   22,   // stat number column (compact)
  btnW:        44,
  btnCompW:    40,

  // Font sizes (fp)
  fontSm:      10,
  fontMd:      11,
  fontLg:      12,

  // Misc
  borderW:       0.5,  // thin row separator stroke width
  radius:         3,   // tab item border radius
  btnRadius:      4,   // button border radius
  overlayBlur:   12,   // backdropBlur radius for FloatOverlay glass effect
  overlayPanelW: 220,  // FloatOverlay panel width when overlaid on game (vp)
  overlaySideGap: 30,  // left/right dismiss area in compact overlay (vp)
} as const;

// ── HP color helper ────────────────────────────────────────────────────────

const HP_OK_RATIO   = 0.5;
const HP_WARN_RATIO = 0.25;

/** Returns the HP bar / text color for the given HP ratio. */
export function hpColor(hp: number, hpMax: number): string {
  const ratio = hpMax > 0 ? hp / hpMax : 0;
  if (ratio > HP_OK_RATIO)   { return PanelColors.hpOk; }
  if (ratio > HP_WARN_RATIO) { return PanelColors.hpWarn; }
  return PanelColors.hpCrit;
}

const EQUIP_ICON_DIR = 'resource://RAWFILE/equip-icons/';
const CARRIER_AIRCRAFT_TYPES: ReadonlySet<number> = new Set([
  6, 7, 8, 9, 45, 56, 57, 58,
]);

/** Returns true if the equip type should display carried aircraft count. */
export function isCarrierAircraftType(equipType: number): boolean {
  return CARRIER_AIRCRAFT_TYPES.has(equipType);
}

/** Maps SlotItemEquipType (api_type[2]) to an equipment icon svg path. */
export function equipLabel(equipType: number): string {
  switch (equipType) {
    case 1: case 2: case 3: return `${EQUIP_ICON_DIR}main_gun.svg`;
    case 4: return `${EQUIP_ICON_DIR}secondary_gun.svg`;
    case 5: case 27: return `${EQUIP_ICON_DIR}torpedo.svg`;
    case 6: case 33: return `${EQUIP_ICON_DIR}carrier_fighter.svg`;
    case 7: case 17: case 30: return `${EQUIP_ICON_DIR}carrier_bomber.svg`;
    case 8: case 34: case 55: return `${EQUIP_ICON_DIR}carrier_attacker.svg`;
    case 9: case 29: case 65: return `${EQUIP_ICON_DIR}recon.svg`;
    case 10: case 57: case 67: return `${EQUIP_ICON_DIR}seaplane.svg`;
    case 11: case 64: case 66: return `${EQUIP_ICON_DIR}radar.svg`;
    case 12: case 13: return `${EQUIP_ICON_DIR}shell.svg`;
    case 14: return `${EQUIP_ICON_DIR}repair.svg`;
    case 15: return `${EQUIP_ICON_DIR}aagun.svg`;
    case 16: case 69: return `${EQUIP_ICON_DIR}high_angle.svg`;
    case 18: case 54: return `${EQUIP_ICON_DIR}sonar.svg`;
    case 19: case 31: return `${EQUIP_ICON_DIR}engine.svg`;
    case 20: return `${EQUIP_ICON_DIR}landing_craft.svg`;
    case 21: return `${EQUIP_ICON_DIR}autogyro.svg`;
    case 22: case 28: case 60: return `${EQUIP_ICON_DIR}patrol.svg`;
    case 23: return `${EQUIP_ICON_DIR}armor.svg`;
    case 24: return `${EQUIP_ICON_DIR}searchlight.svg`;
    case 25: return `${EQUIP_ICON_DIR}transport.svg`;
    case 26: return `${EQUIP_ICON_DIR}facility.svg`;
    case 32: case 68: return `${EQUIP_ICON_DIR}special_armor.svg`;
    case 35: return `${EQUIP_ICON_DIR}special_gun.svg`;
    case 36: return `${EQUIP_ICON_DIR}aamissile.svg`;
    case 37: return `${EQUIP_ICON_DIR}land_attack.svg`;
    case 38: return `${EQUIP_ICON_DIR}command.svg`;
    case 39: case 41: case 59: return `${EQUIP_ICON_DIR}personnel.svg`;
    case 40: return `${EQUIP_ICON_DIR}supply.svg`;
    case 42: case 46: case 71: return `${EQUIP_ICON_DIR}boat.svg`;
    case 43: return `${EQUIP_ICON_DIR}sub_radar.svg`;
    case 44: return `${EQUIP_ICON_DIR}ration.svg`;
    case 45: return `${EQUIP_ICON_DIR}replenish.svg`;
    case 47: case 49: return `${EQUIP_ICON_DIR}land_plane.svg`;
    case 48: return `${EQUIP_ICON_DIR}interceptor.svg`;
    case 50: case 51: case 52: case 53: case 56: case 70: return `${EQUIP_ICON_DIR}jet.svg`;
    case 58: case 72: return `${EQUIP_ICON_DIR}asw_patrol.svg`;
    case 62: return `${EQUIP_ICON_DIR}antisurface.svg`;
    default: return `${EQUIP_ICON_DIR}unknown.svg`;
  }
}
