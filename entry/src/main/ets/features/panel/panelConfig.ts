/**
 * Centralized visual configuration for the game info panel.
 *
 * All colors, dimensions, font sizes, and thresholds used by panel components
 * are defined here. Tweak values in this file; no changes needed in UI files.
 *
 * Color format: ArkUI uses #AARRGGBB (alpha first) for 8-digit hex.
 */

// ── Color palette ──────────────────────────────────────────────────────────

export const PanelColors = {
  // Backgrounds
  bg:         '#0b0b0b',   // main panel / ship row background
  bgStatus:   '#0e0e0e',   // status bar row (expanded)
  bgTabs:     '#141414',   // tab bar row
  bgTabOn:    '#1c5050',   // active fleet tab highlight
  bgInfoOn:   '#252525',   // active info-type tab
  bgHeader:   '#111111',   // ship list column header row
  bgHpTrack:  '#222222',   // HP progress bar track (expanded)
  bgBtn:      '#2a2a2a',   // action button background (expanded)

  // Text
  txtPrimary: '#dddddd',   // ship name, primary content
  txtSub:     '#aaaaaa',   // button label, secondary info
  txtMuted:   '#777777',   // status bar values, ship type badge
  txtFaint:   '#666666',   // inactive fleet tab
  txtFainter: '#555555',   // inactive info tab, list column header
  txtSep:     '#333333',   // '|' separator in status bar
  txtTabOn:   '#ffffff',   // active fleet tab label
  txtInfoOn:  '#cccccc',   // active info-type tab label

  // Stats
  stat:       '#44dddd',   // all stat value columns (s1–s4)

  // HP state thresholds
  hpOk:       '#44cc88',   // hp ratio > 50%
  hpWarn:     '#ddcc44',   // hp ratio 25–50%
  hpCrit:     '#dd4444',   // hp ratio ≤ 25%

  // Row separators
  rowBorder:  '#1c1c1c',   // ship row bottom border (expanded)

  // FloatOverlay-specific
  overlayBg:  '#bf000000', // ~75% opaque black (#AARRGGBB)
  overlayBtn: '#44444466', // action button on overlay (semi-transparent)
  overlayRow: '#2a2a2a',   // row separator + HP bar track on overlay
  overlayHdr: '#333333',   // status line bottom border on overlay
  overlayTxt: '#888888',   // status line text on overlay
} as const;

// ── Dimensions ─────────────────────────────────────────────────────────────

export const PanelDimens = {
  // Section heights (vp)
  tabBarH:     30,
  statusBarH:  22,
  listHdrH:    24,
  rowH:        36,   // ship row height — expanded (BottomPanel)
  rowCompH:    32,   // ship row height — compact  (FloatOverlay)
  hpBarH:       6,   // HP progress bar height — expanded
  hpBarCompH:   5,   // HP progress bar height — compact
  btnH:        26,
  btnCompH:    24,

  // Column widths (vp)
  typeW:       18,   // ship type badge
  hpNumW:      28,   // HP number text — expanded
  hpNumCompW:  26,   // HP number text — compact
  hpBarW:      40,   // HP progress bar — expanded
  hpBarCompW:  32,   // HP progress bar — compact
  statW:       24,   // each stat column — expanded (4 cols)
  statCompW:   22,   // each stat column — compact  (2 cols)
  btnW:        44,
  btnCompW:    40,

  // Font sizes (fp)
  fontSm:      10,
  fontMd:      11,
  fontLg:      12,

  // Misc
  borderW:     0.5,  // thin row separator stroke width
  radius:       3,   // tab item border radius
  btnRadius:    4,   // action button border radius
  overlayBlur: 10,   // backdropBlur radius for FloatOverlay glass effect
} as const;

// ── HP color helper ────────────────────────────────────────────────────────

const HP_OK_RATIO   = 0.5;
const HP_WARN_RATIO = 0.25;

/** Returns the HP bar / text color for the current HP ratio. */
export function hpColor(hp: number, hpMax: number): string {
  const ratio = hpMax > 0 ? hp / hpMax : 0;
  if (ratio > HP_OK_RATIO)   { return PanelColors.hpOk; }
  if (ratio > HP_WARN_RATIO) { return PanelColors.hpWarn; }
  return PanelColors.hpCrit;
}
