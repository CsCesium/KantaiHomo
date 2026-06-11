# Changelog

English | [简体中文](CHANGELOG.zh-CN.md)

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
