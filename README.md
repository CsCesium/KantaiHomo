# KantaiHomo

English | [简体中文](README.zh-CN.md) | [Changelog](CHANGELOG.md)

KanColleObserver(KCO) is a HarmonyOS native viewer and companion app for Kantai Collection
(HTML5). It embeds the DMM game in ArkWeb and adds native panels, local
persistence, reminders, calculators, and mobile input/layout fixes around the
game.

This is an unofficial project and is not affiliated with DMM, C2, or KADOKAWA.

## Current Scope

- HarmonyOS app for phone, tablet, and 2in1 devices.
- Bundle name: `io.github.cesium.kchomo`.
- Current configured app version: `1.1.2`.
- Default game URL: `https://play.games.dmm.com/game/kancolle`.
- Built with ArkTS, ArkWeb, Hvigor, and HarmonyOS SDK 6.x.

## Features

- Game launcher and WebView host with DMM login autofill, session persistence,
  logout, cache controls, custom home URL, and custom user agent.
- Responsive game layout with portrait/landscape handling, game scale controls,
  fleet state icons, combined-fleet main/escort switching, automatic striking-force
  selection, bottom panel, and floating overlay.
- Three-pane mode for fully unfolded tri-fold devices and sufficiently large
  fullscreen landscape tablets: a 2:1 game/information layout with swappable
  sides, independent game scaling, a single-column battle preview, and a
  dashboard that cycles through expeditions, quests, and repairs.
- Local game data pipeline: XHR/Fetch hooks parse game API responses, normalize
  domain models, and persist ships, equipment, fleets, resources, quests,
  expeditions, repairs, arsenal events, battles, maps, battle records, and
  battle segments.
- Live companion panels for fleet HP/status, equipment, resources, quests,
  expedition checks, repair docks, land-based air corps, map gauges, air power,
  aerial combat details, transport points, LoS, battle preview, battle result,
  ship battle scenarios, and AACI detection.
- Battle handling for normal and combined fleets, opening-night and night-to-day
  combat, enemy combined-fleet night targeting, and land-base air-raid damage;
  ship scenarios include carrier night air attacks and current damage-state effects.
- Information pages for ship, equipment, sortie logs, and equipment improvement
  recipes, plus static data for expedition, equipment classification, and
  expedition requirement rules.
- Local quest formation checks for the first fleet and per-goal progress tracking
  backed by 425 bundled quest definitions. Counters are saved per account,
  support recurring resets, pause when a quest is stopped, and resume when accepted again.
- Alerts for night battle prompts, sortie advance risk, practice/battle
  result taiha warnings, expedition returns, repair completion, development,
  construction, and equipment improvement results, with vibration, system
  notification, and Toast modes.
- System-managed expedition return reminders with registration status and retry
  controls. Optional practice refresh, monthly ranking settlement, and month-end
  EO medal reminders have independent switches and are disabled by default.
- Persistent application mute preference, restored when the app restarts.
- Resource cache for game image assets, optional audio caching, cache statistics,
  and manual clearing.
- Optional WebView injections for touch hover, two-finger wheel, FPS display,
  ticker RAF, and Pixi rendering compatibility patches.

## Project Layout

```text
entry/src/main/ets/app/pages/        UI pages and game-facing panels
entry/src/main/ets/infra/web/        ArkWeb host, bridge, and injection modules
entry/src/main/ets/features/router/  API event routing and persistence handlers
entry/src/main/ets/features/parsers/ Game API parsing pipelines
entry/src/main/ets/domain/           Domain models, events, and services
entry/src/main/ets/infra/storage/    KV, database, migrations, and DAOs
entry/src/main/ets/features/alerts/  Reminder and notification system
entry/src/main/ets/features/calc/    Air power, LoS, TP, AACI, damage, and rate calculators
entry/src/main/ets/features/expedition/ Expedition requirement checking
entry/src/main/ets/features/quests/  Quest formation checks and progress tracking
entry/src/main/resources/rawfile/    Static data, ship avatars, and icons
```

## Build

Prerequisites:

- DevEco Studio with HarmonyOS SDK 6.x.
- `ohpm` and `hvigor` available from DevEco Studio or your PATH.
- A local signing configuration for device installation.

```powershell
cd app
ohpm install
hvigor build --mode debug
```

For a release build:

```powershell
hvigor build --mode release
```

Use `build-profile.example.json5` as a template or let DevEco Studio generate
local signing data. Keep machine-specific signing paths and passwords in your
local build profile.

## Tests

```powershell
hvigor test --type unit
hvigor test --type ohos
```

## Data Sources And Acknowledgements

- Quest goal data (`entry/src/main/resources/rawfile/data/quest_goals.json`) is
  converted from [poi](https://github.com/poooi/poi)'s `assets/data/fcd/questgoal.json`,
  snapshot `2026/09/15/02` with 425 definitions. Event counting, goal matching, and
  progress reconciliation also reference poi. Thanks to the poi contributors;
  the data's MIT copyright and license notice are bundled in
  [quest_goals.LICENSE.txt](entry/src/main/resources/rawfile/data/quest_goals.LICENSE.txt).
- Quest nationality mappings (`quest_nations.json`) were checked against
  [ElectronicObserver's ShipClass definitions](https://github.com/ElectronicObserverEN/ElectronicObserver/blob/master/ElectronicObserver.Core/Types/ShipClass.cs).
  Formation requirements (`quest_req.json`) are a user-provided table. See the
  [quest tracking documentation](entry/src/main/ets/features/quests/README.md)
  for coverage, update commands, and limitations; bundled rules need no runtime download.
- Equipment improvement data (`entry/src/main/resources/rawfile/data/improvement.json`) is generated from external KanColle improvement datasets. The packaged data currently declares [akashi-list.me](https://akashi-list.me/) as its source; the updater script can also fetch [ElectronicObserverEN/Data](https://github.com/ElectronicObserverEN/Data)'s `EquipmentUpgrades.json`, which is wiki-derived and maintained by the ElectronicObserver project.
- These data files are used only for in-app reference and calculation support. Original data, names, and related rights remain with their respective projects and rightsholders.
- Project-maintained static rule files, such as equipment classification and expedition requirement data, live under `entry/src/main/resources/rawfile/data/`.

## Notes

- Notifications and reminders require HarmonyOS notification/reminder
  permissions. The app requests network, network status, background running,
  reminder publishing, and vibration permissions.
- The `dist/` directory may contain unsigned HAP artifacts and `SHA256SUMS.txt`.
  Sign or install them according to your device policy.
- From `app`, run `bash dist/generate-checksum.sh` to generate checksums for the
  single top-level HAP in `dist`; pass its filename when multiple HAPs are present.
- Quest formation indicators only check the first fleet's formation. They do not
  confirm map, equipment, or completion requirements. `≈` marks estimated progress
  when earlier or other-device activity is unknown; completion is determined by the game.
- Successfully registered reminders are managed by the system after the app exits.
  Check registration status in Settings. Time-point reminders send system notifications
  without app Toasts or vibration; reopen the app after a device timezone change to
  recalibrate schedules. Monthly reminders cover a rolling 12-month window.
- Some settings, especially WebView injection toggles, apply after re-entering
  the game page.
