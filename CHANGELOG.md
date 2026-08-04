# Changelog

English | [简体中文](CHANGELOG.zh-CN.md)

## 1.1.1 - 2026-08-04

Compared with `v1.1.0`.

### Added

- Detection of a seven-ship third fleet as a striking force. Bottom and floating
  panels select it automatically and no longer report it as an idle expedition fleet.
- Type 47 C3H AACI detection for Shiratsuyu Kai Ni, Shigure Kai Ni/Kai San,
  Murasame Kai Ni, and Harusame Kai Ni, including the C-model Kai San H,
  upgraded 25 mm AA gun, and air-radar equipment combinations.
- Map-node recognition for no-event, aerial reconnaissance, escort success,
  transport, air raid, long-range air raid, radar fire, anchorage repair, and
  both legacy and current route-selection formats.
- Carrier night air-attack power and night carrier cut-in loadout detection in
  ship battle scenarios, including night fighters, attackers, dive bombers,
  and supported special night aircraft.

### Changed

- Combined-fleet battle parsing now follows `api_active_deck` for main/escort
  indices, supports legacy and current night packets, opening-night and
  night-to-day battles, and predicts the active enemy night fleet.
- Fleet and LBAS fighter-power calculations now use corrected improvement
  coefficients, proficiency ranges, air-state boundaries, reconnaissance
  multipliers, and land-attacker/heavy-bomber rules. Hidden proficiency
  uncertainty is displayed as a power range.
- Land-base air-raid previews now match bases to the active map area and show
  resource/base damage kind, base HP loss, and total surviving aircraft.
- Event-map gauges update immediately after selecting difficulty and preserve
  current multi-gauge number/type data while ignoring unselected placeholders.
- Quest parsing now ignores empty server placeholders and updates accepted or
  stopped quests immediately. The All tab synchronizes disappeared quests,
  while the panel shows only currently active quests.
- The combined-fleet sidebar is available in port and switches between the main
  and escort fleets by clicking its heading or double-tapping the sidebar.

### Fixed

- Fixed combined-fleet escort attackers/targets, initial HP, cumulative damage,
  battle-record snapshots, and stale simulator state after refreshing into a
  night battle.
- Fixed air-state normalization and S1/S2 surviving-aircraft totals; land-base
  air raids now record base damage and no-damage outcomes correctly.
- Ship scenarios now apply current chuuha/taiha state to day, torpedo, ASW, and
  night power, with correct midget-submarine opening torpedoes, armored-carrier
  behavior, and empty aircraft-slot handling.
- LoS and Formula 33 calculations now exclude escaped ships.

## 1.1.0 - 2026-06-21

Compared with `v1.0.2`.

### Added

- Sortie log information page, accessible from the game control buttons, with
  recent battle records and filters for time, map, cell, rank, and drop ship.
- Battle detail replay backed by persisted `BattleSegment` data, including phase
  summaries, per-hit attacker/target, damage, critical state, HP bars, aerial
  combat details, and land-based air waves.
- Storage migration `014_add_battle_segment` to persist `segmentJson` for new
  battle records. Older records remain readable with summary-only details.
- AACI tab in the ship battle scenario panel, showing detected anti-air cut-ins
  with priority, multiplier, percent shootdown, and fixed shootdown values.
- Quest reward-claim parsing through the new `QUEST_CLAIMED` event so claimed
  quests are removed from local state and storage.

### Changed

- Battle normalization now preserves shelling special attack codes from
  `api_sp_list` and handles zero-based shelling/torpedo indices, including
  torpedo list-item formats.
- Battle result records now use merged battle-segment HP for enemy fleets at
  result time, improving post-battle enemy HP display.
- Ship and equipment information pages now render rows in batches to reduce
  initial page construction cost for large inventories.
- Battle preview aerial detail opens with a larger single-tap touch target and
  refreshes when escaped-ship state changes.
- Floating panels and full-screen information pages now block accidental
  launcher back-swipe navigation while they are open.
- Packaged equipment improvement data was refreshed.

### Fixed

- Completed-but-unclaimed quests remain visible until their reward is claimed,
  then disappear from state and storage.
- Morale color handling now treats `cond = 50` as high morale.
- Fixed typos and minor UI wording issues around the new 1.1.0 flows.

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
