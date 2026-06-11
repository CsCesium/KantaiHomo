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
- Current configured app version: `1.0.1`.
- Default game URL: `https://play.games.dmm.com/game/kancolle`.
- Built with ArkTS, ArkWeb, Hvigor, and HarmonyOS SDK 6.x.

## Features

- Game launcher and WebView host with DMM login autofill, session persistence,
  logout, cache controls, custom home URL, and custom user agent.
- Responsive game layout with portrait/landscape handling, game scale controls,
  fleet state icons, side fleet status, bottom panel, and floating overlay.
- Local game data pipeline: XHR/Fetch hooks parse game API responses, normalize
  domain models, and persist ships, equipment, fleets, resources, quests,
  expeditions, repairs, battles, maps, and battle records.
- Live companion panels for fleet HP/status, equipment, resources, quests,
  expedition checks, repair docks, land-based air corps, map gauges, air power,
  transport points, LoS, battle preview, battle result, and ship battle
  scenarios.
- Information pages and static data for ship, equipment, expedition, equipment
  classification, and expedition requirement rules.
- Alerts for night battle prompts, sortie advance risk, practice/battle
  result taiha warnings, expedition returns, and repair completion, with
  vibration and system notification modes.
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

## Notes

- Notifications and reminders require HarmonyOS notification/reminder
  permissions. The app requests network, network status, background running,
  reminder publishing, and vibration permissions.
- The `dist/` directory may contain unsigned HAP artifacts and `SHA256SUMS.txt`.
  Sign or install them according to your device policy.
- Some settings, especially WebView injection toggles, apply after re-entering
  the game page.
