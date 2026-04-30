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
  hpMid:         '#fb8c00',   // hp ratio 25-50% — orange (中破)
  hpWarn:        '#fdd835',   // warning yellow (engagement, condition — NOT hp bars)
  hpCrit:        '#e53935',   // hp ratio ≤ 25%  — red
  hpDamage:      '#6b6f7e',   // hp lost in batle
  escapeLabel:   '#42a5f5',   // 退避 (goback_port) label — blue
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
  '#1a3a5c',  // 地図       — dark navy (map info)
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
  hpBarW:    '45%',  // HP bar width — expanded; fixed so equipment column aligns
  hpBarCompW: '40%', // HP bar width — compact; fixed so equipment column aligns
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
  overlaySideGap: 60,  // left/right dismiss area in compact overlay (vp)
} as const;

// ── HP color helper ────────────────────────────────────────────────────────

const HP_OK_RATIO   = 0.5;
const HP_WARN_RATIO = 0.25;

/** Returns the HP bar / text color for the given HP ratio. */
export function hpColor(hp: number, hpMax: number): string {
  const ratio = hpMax > 0 ? hp / hpMax : 0;
  if (ratio > HP_OK_RATIO)   { return PanelColors.hpOk; }
  if (ratio > HP_WARN_RATIO) { return PanelColors.hpMid; }
  return PanelColors.hpCrit;
}

const EQUIP_ICON_DIR = 'resource://RAWFILE/equip-icons/';

const AIRCRAFT_EQUIP_TYPES: ReadonlySet<number> = new Set([
  6, 7, 8, 9, 10, 11, 25, 26, 41, 45, 47, 48, 49, 53, 56, 57, 58, 59, 94,
]);

/** Returns true if slotitem equip type (api_type[2]) is an aircraft category. */
export function isAircraftEquipType(equipType: number): boolean {
  return AIRCRAFT_EQUIP_TYPES.has(equipType);
}

/** Maps api_type[3] icon id to an equipment icon svg path. */
export function equipLabel(iconType: number): string {
  return `${EQUIP_ICON_DIR}${iconType > 0 ? iconType : 0}.svg`;
}

const KAISYUU_ICON_DIR = 'resource://RAWFILE/icons/kaisyuu/';
const AIR_MASTERY_ICON_DIR = 'resource://RAWFILE/icons/air_mastery/';

/**
 * Returns the kaisyuu (improvement) star icon path for a given level (1..10).
 * Returns null when level is 0 (no improvement).
 */
export function kaisyuuIcon(level: number): string | null {
  if (level <= 0) return null;
  const lv = level > 10 ? 10 : level;
  return `${KAISYUU_ICON_DIR}starts_${lv}.png`;
}

/**
 * Returns the aircraft proficiency icon path for alv (1..7).
 * Maps alv 1..7 → sally_airunit_128..134.png. Returns null when alv is 0.
 */
export function airMasteryIcon(alv: number): string | null {
  if (alv <= 0) return null;
  const a = alv > 7 ? 7 : alv;
  return `${AIR_MASTERY_ICON_DIR}sally_airunit_${127 + a}.png`;
}
