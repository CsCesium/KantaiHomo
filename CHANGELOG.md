# Changelog

English | [简体中文](CHANGELOG.zh-CN.md)

## 1.0.2 - 2026-06-17

Compared with `v1.0.1`.

### Added

- Equipment improvement information viewer backed by `rawfile/data/improvement.json`,
  including improvement days, secretary ships, normal/guaranteed dev material
  and screw costs, consumed equipment, base resource costs, and MAX conversion
  targets.
- Persistent improvement favorites with priority sorting and `addEquip:` command
  support for adding favorite equipment from the game context.
- Aerial combat detail panel in battle preview, showing aircraft stage losses,
  contact, anti-air cut-in information, and land-based air waves.
- Arsenal event parsing and Toast alerts for equipment development, ship
  construction start/completion, and equipment improvement results, with
  separate settings toggles.
- Jet carrier cut-ins in day battle scenario estimates.
- Additional ship and equipment attributes in state and info pages, including
  ship armor/evasion and equipment armor, speed, range, rarity, cost, and
  distance.
- Equipment classification rules for land attack bombers and anti-air
  resistance groups.

### Changed

- Improvement recipes now use current ElectronicObserver/wiki-derived data and
  show only today's secretary ships for today-improvable equipment.
- Battle preview now shows output/received damage totals beside HP bars, and the
  aerial combat detail popup is centered with Chinese labels.
- Quest state handling now merges partial quest pages and removes completed or
  inactive quests from the visible panel list.
- Map gauge ordering and display logic were refined.
- Equipment and ship info pages were expanded with richer filters and stat
  display.

### Fixed

- Escaped ships are normalized from battle results and stay grayed out as
  escaped until returning to port.
- Fixed the expedition check "All" tab showing an empty-data state after
  filtering.
- Corrected carrier attack checks and the land-based aircraft UI description.
- Fixed missing state properties and lint issues around the 1.0.2 changes.

## 1.0.1 - 2026-06-12

Compared with `v1.0.0`.

### Added

- Expedition check panel with area filters, per-mission requirement details,
  fleet stat checks, ship type rules, equipment requirements, and big-success
  assessment.
- Land-based air corps and repair dock panels in the game information panel.
- Ship battle scenario estimation panel, including day battle, special attack,
  night battle, anti-submarine, and improvement bonus calculations.
- Damage calculation modules for attack power, day attack rate, equipment
  improvement bonuses, and scenario construction.
- Night Zuiun and expanded special attack handling in rate and attack
  calculations.
- Static equipment classification data and icon overrides for special equipment
  cases such as seaplane bomber and depth charge icons.
- Fleet state icon assets, additional ship avatar assets, and reorganized
  equipment icon resources under `rawfile/icons/equip`.

### Changed

- Updated fleet panels with richer fleet stats, horizontal scrolling, fleet icon
  states, equipment badges, range display, and better state refresh behavior.
- Reworked responsive layout and split-scene decisions for bottom panel,
  floating overlay, portrait fit, and narrow screens.
- Improved land-based air corps state parsing and squadron/base merging.
- Updated quest parsing to use API label types and expanded reset type handling.
- Replaced older expedition condition data with `rawfile/data/expedition_req.json`.
- Expanded README documentation and added Simplified Chinese documentation.

### Fixed

- Prevented orientation ping-pong after manual portrait fit and restricted
  rotation controls to narrow screens.
- Fixed stale panel header and fleet statistics updates.
- Fixed touch wheel delta calculation and several unintended UI behaviors.
- Corrected application vendor/name metadata and equipment icon mismatches.
