# CLAUDE.md — KantaiHomo

## Project Overview

**KantaiHomo** is a HarmonyOS native companion application for the Kantai Collection (HTML5) browser game. It embeds the game in a WebView and adds native tooling around it: battle calculators, expedition/quest tracking, ship/item management dashboards, database persistence, and a floating assistant overlay.

- **Bundle ID:** `com.cesium.kchomo`
- **Version:** 1.0.0 (versionCode: 1000000)
- **Target SDK:** HarmonyOS 6.0.0 (API level 20)
- **Supported devices:** phone, tablet, 2in1

---

## Repository Layout

```
KantaiHomo/
├── AppScope/                   # Global app manifest and resources
│   ├── app.json5               # Bundle name, version, vendor
│   └── resources/base/         # Global string/media resources
├── entry/                      # Single application module
│   ├── src/main/
│   │   ├── ets/                # All ArkTS/TypeScript source (247 files)
│   │   │   ├── ability/        # UIAbility entry point (Entry.ets)
│   │   │   ├── app/            # App bootstrap + page components
│   │   │   │   ├── pages/      # Route pages (WebRoot, Dashboard, BattleRecord, …)
│   │   │   │   └── stores/     # Global state stores
│   │   │   ├── domain/         # Pure domain layer (no HarmonyOS deps)
│   │   │   │   ├── models/     # API types, enums, mappers, normalizers, structs
│   │   │   │   ├── service/    # Business-logic services
│   │   │   │   └── events/     # Typed event definitions
│   │   │   ├── features/       # Feature-specific logic
│   │   │   │   ├── calc/       # Game calculators (air power, AACI, LoS, rates)
│   │   │   │   ├── parsers/    # API response parsing pipelines
│   │   │   │   ├── router/     # Route interception + persistence
│   │   │   │   ├── panel/      # Overlay panel UI
│   │   │   │   ├── alerts/     # Alert/notification system
│   │   │   │   ├── state/      # Reactive state management
│   │   │   │   └── utils/      # Shared utilities
│   │   │   ├── infra/          # Platform-specific infrastructure
│   │   │   │   ├── web/        # WebView host, bridge, interceptors, session
│   │   │   │   ├── storage/    # SQLite (RDB) + KV storage, DAOs, migrations
│   │   │   │   ├── net/        # WebSocket client
│   │   │   │   ├── fairy/      # Floating ball / overlay feature
│   │   │   │   ├── bus/        # Event dispatcher (pub/sub)
│   │   │   │   ├── deps/       # Manual DI container + RecentIdCache
│   │   │   │   └── work/       # Background task scheduler
│   │   │   └── widget/         # Home-screen widget pages
│   │   ├── resources/          # UI resources
│   │   │   ├── base/element/   # Colors, strings, floats
│   │   │   ├── base/media/     # Icons and images
│   │   │   ├── base/profile/   # Page routes, form config, backup config
│   │   │   ├── dark/           # Dark-theme overrides
│   │   │   ├── phone-*/        # Density-specific resources
│   │   │   └── rawfile/data/   # servers.json (20 game server IPs)
│   │   └── module.json5        # Module manifest (abilities, permissions, pages)
│   ├── src/test/               # Local unit tests
│   ├── src/ohosTest/           # Hypium device/emulator tests
│   ├── src/mock/               # Mock data for development
│   ├── oh-package.json5        # Module-level dependencies
│   └── build-profile.json5     # Debug/release build settings + obfuscation
├── hvigor/hvigor-config.json5  # Hvigor build tool settings
├── hvigorfile.ts               # Root Hvigor build config
├── build-profile.json5         # Signing configs
├── code-linter.json5           # ESLint rules for .ets files
└── oh-package.json5            # Root package manifest (model version 5.0.5)
```

---

## Architecture

The codebase follows a **Clean Architecture** with four distinct layers. Dependencies always point inward (infra/features → domain, never domain → infra).

```
ability / app/pages       ← Presentation (ArkUI components, page routing)
        ↓
features / app/stores     ← Application (feature logic, state, parsers, calcs)
        ↓
domain                    ← Domain (models, services, events — no HarmonyOS APIs)
        ↓
infra                     ← Infrastructure (WebView, SQLite, KV, WebSocket, DI)
```

### Key Design Patterns

| Pattern | Location | Notes |
|---|---|---|
| Singleton | `FairyService`, `DebugDB` | Single instances via module-level vars |
| Repository | `infra/storage/repo/` | Wraps DAO calls, exposed via `RepositoryHub` |
| DAO | `infra/storage/dao/` | One file per entity (admiral, ship, battle, …) |
| Event Bus | `infra/bus/` | Typed pub/sub dispatcher |
| Mapper/Normalizer | `domain/models/mapper/`, `normalizer/` | API JSON → domain structs pipeline |
| Manual DI | `infra/deps/container.ets` | `setPersistDeps` / `ensurePersistDeps` pattern |
| WebView Bridge | `infra/web/bridge/` | Native ↔ WebView message passing |

---

## Language and File Extensions

| Extension | Usage |
|---|---|
| `.ets` | ArkTS — UI components (ArkUI decorators: `@Component`, `@Entry`, `@State`, etc.) |
| `.ts` | Pure TypeScript — domain models, services, utilities, DAOs |

**Rule:** Only use `.ets` when ArkUI decorators or `@ohos.*` UI APIs are needed. Pure logic goes in `.ts`.

---

## Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Page components | PascalCase | `WebRoot.ets`, `BattleRecord.ets` |
| Services | PascalCase + `Service` suffix | `FairyService.ets` |
| DAOs | snake_case entity name | `ship.ts`, `k_dock.ts` |
| Migrations | Zero-padded `NNN_description.ts` | `012_create_battle.ts` |
| Models/types | PascalCase | `AdmiralModel`, `BattleResult` |
| Utilities / functions | camelCase | `getAppContext.ts`, `sanitizeUserKey()` |
| Constants | SCREAMING_SNAKE_CASE | `HILOG_DOM`, `DB_PREFIX` |
| Enums | PascalCase | `ShipType`, `BattlePhase` |
| Event definitions | PascalCase + descriptive name | `BattleStartEvent` |

---

## Storage

### SQLite (RDB)

Accessed via `infra/storage/db.ts`. Migrations live in `infra/storage/migrations/` and run in order on first launch or upgrade.

Current migration history:
1. `001_init_core` — admiral, battle, deck tables
2. `002_add_missions`
3. `003_add_expedition_results`
4. `004_add_port`
5. `005_create_materials`
6. `006_create_slotitems`
7. `007_create_ships`
8. `008_create_deck`
9. `009_create_quest`
10. `010_create_k_dock`
11. `011_create_n_dock`
12. `012_create_battle`

**Adding a new migration:** create `0NN_description.ts` in the migrations folder and register it in `migrations/index.ts`. Never modify existing migrations.

### KV Store

Used for lightweight preferences (active user tracking, settings). Accessed via `infra/storage/kv.ts`.

### Multi-User Support

Data is isolated per user key. Always use `sanitizeUserKey()` before constructing storage identifiers.

---

## WebView Integration

The game runs inside a `WebView` component hosted in `infra/web/WebHost.ets`. Key concepts:

- **Bridge (`infra/web/bridge/`):** Bidirectional message channel between ArkTS and the game's JavaScript context.
- **Interceptors (`infra/web/interceptors/`):** HTTP request interception for API sniffing and response parsing.
- **Session (`infra/web/session/`):** Manages cookies and login state.
- **Config (`infra/web/config.ets`):** WebView configuration (user agent, etc.).

Game server IPs are defined in `entry/src/main/resources/rawfile/data/servers.json` (20 official servers).

---

## Domain: Game Concepts

| Concept | Description |
|---|---|
| Admiral | Player profile |
| Ship | Individual naval unit |
| Fleet / Deck | Squad of ships |
| SlotItem | Equipment item |
| Materials | Resources (fuel, ammo, steel, bauxite) |
| K-Dock | Construction facility |
| N-Dock | Repair facility |
| Sortie / Battle | Combat mission |
| Expedition | Automated fleet dispatch |
| Quest | In-game mission/objective |
| AACI | Anti-Air Cut-In (special AA mechanic) |
| LoS (Sakuteki) | Line-of-Sight formula |

API responses are processed through a `parser → normalizer → mapper` pipeline before reaching domain models.

---

## Build System

The project uses **Hvigor** (HarmonyOS build tool), configured via `hvigorfile.ts` (root) and `entry/hvigorfile.ts` (module).

### Build Modes

| Mode | Obfuscation | Debug DB |
|---|---|---|
| `debug` | Property + toplevel obfuscation | Enabled (`@hadss/debug-db`) |
| `release` | Property + toplevel + filename + export obfuscation | Disabled |

### Common Commands

```bash
# Build debug APK/HAP
hvigor build --mode debug

# Build release HAP
hvigor build --mode release

# Run unit tests (local JVM)
hvigor test --type unit

# Run device/emulator tests
hvigor test --type ohos
```

---

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@hadss/debug-db` | `^1.0.0-rc.11` | Database inspection (debug only) |
| `@ohos/hypium` | `1.0.21` | Test framework |
| `@ohos/hamock` | `1.0.0` | Mocking for tests |
| `@ohos/polka` | `1.0.3` (transitive) | Embedded web server |
| `@ohos/node-polyfill` | `1.0.0` (transitive) | Node.js API polyfills |

### HarmonyOS Kit APIs Used

- `@kit.BasicServicesKit` — business errors
- `@kit.PerformanceAnalysisKit` — HiLog logging
- `@kit.ArkWeb` — WebView and cookies
- `@ohos.data.relationalStore` — SQLite
- `@ohos.data.preferences` — KV storage
- `@ohos.net.http` — HTTP client
- `@ohos.net.websocket` — WebSocket

---

## Linting

ESLint runs on all `.ets` files via `code-linter.json5`.

Active rule sets:
- `plugin:@performance/recommended` — HarmonyOS performance best practices
- `plugin:@typescript-eslint/recommended` — TypeScript strict rules

Active security rules (all `error`-level unless noted):
- `@security/no-unsafe-aes`, `no-unsafe-hash` (warn), `no-unsafe-mac`
- `no-unsafe-dh`, `no-unsafe-dsa`, `no-unsafe-ecdsa`
- `no-unsafe-rsa-encrypt`, `no-unsafe-rsa-sign`, `no-unsafe-rsa-key`
- `no-unsafe-dsa-key`, `no-unsafe-dh-key`, `no-unsafe-3des`

Excluded from linting: `ohosTest/`, `test/`, `mock/`, `node_modules/`, `oh_modules/`, `build/`, `.preview/`.

---

## Permissions

Declared in `entry/src/main/module.json5`:

| Permission | Reason |
|---|---|
| `ohos.permission.INTERNET` | Game and API network access |
| `ohos.permission.GET_NETWORK_INFO` | Network state checks |
| `ohos.permission.KEEP_BACKGROUND_RUNNING` | Background task execution |
| `ohos.permission.VIBRATE` | UI haptic feedback |

Note: `USE_FLOAT_BALL` is commented out pending platform support.

---

## Pages and Navigation

Pages are registered in `entry/src/main/resources/base/profile/main_pages.json`.

Current pages:
- `WebRoot` — Main game WebView
- `FairyPage` — Floating assistant overlay
- `Dashboard`, `BattleRecord`, `BattleResult`, `BuildPage`, `DockyardPage`, `ExpeditionPage`, `QuestPage`, `Setting` — Feature dashboards

Navigation uses HarmonyOS Router APIs.

---

## Development Workflow

### Branch Strategy

- `main` — stable production branch
- `beta` — pre-release testing
- Feature branches: `<prefix>/<description>` (e.g., `claude/add-claude-documentation-eycn3`)

### Adding a New Feature Page

1. Create `entry/src/main/ets/app/pages/MyPage.ets` with `@Entry @Component`.
2. Register the route in `entry/src/main/resources/base/profile/main_pages.json`.
3. Add any required domain models in `domain/models/`.
4. Add business logic in `domain/service/` or `features/`.
5. If storage is needed, add a DAO in `infra/storage/dao/` and a new migration.

### Adding a Database Migration

1. Create `entry/src/main/ets/infra/storage/migrations/0NN_description.ts`.
2. Export the migration and register it in `migrations/index.ts`.
3. Never rename or edit existing migration files.

### Logging

Use `HiLog` from `@kit.PerformanceAnalysisKit`. Domain-specific log tags follow the `HILOG_*` constant pattern (e.g., `HILOG_DOM`).

---

## CI/CD

No automated CI/CD pipelines are currently configured. Builds are produced manually via DevEco Studio or the Hvigor CLI.
