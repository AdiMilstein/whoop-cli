# whoop-cli Implementation Plan

## Decisions Summary

All 16 architectural/design decisions confirmed:

| # | Decision | Choice |
|---|----------|--------|
| 1 | Token storage | File-based with `chmod 600` |
| 2 | Framework | oclif |
| 3 | Device auth | Dropped — enhance `auth login --no-browser` instead |
| 4 | Dashboard fetching | Partial parallelism (cycle → then recovery+sleep+workout in parallel) |
| 5 | Shared flags | BaseCommand → BaseListCommand class hierarchy |
| 6 | Latest commands | Thin wrappers delegating to get/detail display |
| 7 | Timezone handling | Local system timezone for relative dates |
| 8 | Config commands | `config set` and `config list` only |
| 9 | Test framework | Vitest |
| 10 | API mocking | msw (network-level interception) |
| 11 | Auth testing | Decompose into testable units |
| 12 | Edge cases | Explicit test matrix with factory fixtures |
| 13 | Startup time | Accept oclif overhead, optimize later if needed |
| 14 | Pagination perf | Stream output + rate-aware fetching + progress indicator |
| 15 | HTTP client | axios (interceptors for auth injection + auto-refresh) |
| 16 | File I/O | Lazy loading with in-memory caching |

---

## Implementation Phases

### Phase 1: Project Scaffold
**Files:** `package.json`, `tsconfig.json`, `.env.example`, `src/index.ts`, `bin/`

1. Initialize oclif multi-command project with ESM modules
2. Configure `package.json` with all dependencies:
   - **Runtime:** `@oclif/core`, `axios`, `chalk` (v5, ESM), `cli-table3`, `open`
   - **Dev:** `vitest`, `msw`, `typescript`, `@types/node`, `oclif`
3. Configure `tsconfig.json` with strict mode, ESM target
4. Set up Vitest config (`vitest.config.ts`)
5. Create `.env.example` documenting `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `WHOOP_ACCESS_TOKEN`, `WHOOP_CONFIG_DIR`

### Phase 2: Types & Core Library
**Files:** `src/lib/types.ts`, `src/lib/config.ts`, `src/lib/auth.ts`, `src/lib/units.ts`

1. **`src/lib/types.ts`** — All TypeScript interfaces from the spec: `Cycle`, `Recovery`, `Sleep`, `Workout`, `UserBasicProfile`, `UserBodyMeasurement`, `PaginatedResponse<T>`, `ScoreState`, all score/sub-interfaces
2. **`src/lib/config.ts`** — Config management:
   - Lazy-loading with in-memory cache (Decision #16)
   - Respect `XDG_CONFIG_HOME` / `WHOOP_CONFIG_DIR` env var
   - `loadConfig()`, `saveConfig()`, `getConfigDir()`
   - Config schema: `{ units, default_format, default_limit, color, client_id, client_secret }`
3. **`src/lib/auth.ts`** — Token management:
   - `loadAuth()` / `saveAuth()` with `chmod 600` (Decision #1)
   - `isTokenExpired()` — check if within 5 minutes of expiry
   - `refreshToken()` — POST to token endpoint, save new tokens
   - `getValidToken()` — lazy load, auto-refresh if needed, return valid access token
   - `clearAuth()` — delete auth.json
   - Environment variable overrides: `WHOOP_ACCESS_TOKEN` takes highest priority
4. **`src/lib/units.ts`** — Unit conversion helpers:
   - `msToHuman(ms)` → "Xh Ym" or "Xh Ym Zs"
   - `kjToKcal(kj)` → kcal
   - `metersToFeetInches(m)` → "X'Y\""
   - `kgToLbs(kg)` → lbs
   - `celsiusToFahrenheit(c)` → °F
   - `metersToMiles(m)` → miles
5. **Tests:** Unit tests for all of the above (especially auth token lifecycle, unit conversions)

### Phase 3: API Client
**Files:** `src/lib/api.ts`, `src/lib/pagination.ts`

1. **`src/lib/api.ts`** — Typed WHOOP API client class:
   - Base URL: `https://api.prod.whoop.com/developer`
   - Axios instance with interceptors:
     - Request interceptor: inject `Authorization: Bearer {token}` via `getValidToken()`
     - Response interceptor: handle 401 (refresh + retry once), 429 (parse Retry-After, wait, retry with warning), 4xx/5xx (throw descriptive errors)
   - Methods for every endpoint:
     - `getProfile()`, `getBodyMeasurement()`, `revokeAccess()`
     - `listCycles(params)`, `getCycle(id)`, `getCycleSleep(cycleId)`
     - `listRecoveries(params)`, `getCycleRecovery(cycleId)`
     - `listSleeps(params)`, `getSleep(id)`
     - `listWorkouts(params)`, `getWorkout(id)`
   - All methods return typed responses
2. **`src/lib/pagination.ts`** — Auto-pagination helper:
   - Generic function: `paginate<T>(fetchPage, options)` where options = `{ limit?, all?, pages? }`
   - Streaming support (Decision #14): accepts a `onPage` callback for stream-as-you-go output
   - Inter-page delay (50-100ms) to avoid rate limiting
   - Progress indicator via callback
3. **Tests:** msw-based tests (Decision #10) for:
   - Auth header injection
   - 401 → refresh → retry flow
   - 429 → backoff → retry flow
   - Pagination: empty results, single page, multi-page, --all

### Phase 4: Base Command Classes & Formatter
**Files:** `src/lib/formatter.ts`, `src/commands/base.ts`, `src/commands/base-list.ts`

1. **`src/lib/formatter.ts`** — Output formatting module:
   - `formatTable(columns, rows, options)` — cli-table3 with color coding
   - `formatJson(data)` — pretty-printed JSON
   - `formatCsv(columns, rows)` — CSV with headers
   - Color coding helpers: recovery score → green/yellow/red, strain gradient, sleep performance colors
2. **`src/commands/base.ts`** — Abstract `BaseCommand`:
   - Global flags: `--json`, `--csv`, `--format`, `--no-color`, `--quiet`, `--units`
   - Auth check: verify tokens exist (skip for auth/config commands)
   - Lazy API client initialization
   - Output method that routes to formatter based on flags
3. **`src/commands/base-list.ts`** — Abstract `BaseListCommand` extends `BaseCommand` (Decision #5):
   - Shared flags: `--start`, `--end`, `--limit`, `--all`, `--pages`
   - Relative date parsing (Decision #7): `7d`, `2w`, `1m`, `today`, `yesterday`, ISO 8601 — resolved in local system timezone
   - Pagination orchestration: calls `paginate()` with streaming output for table/CSV
   - Abstract methods for subclasses: `getEndpointData()`, `getColumns()`, `mapToRow()`
4. **Tests:** Formatter output for all modes, relative date parsing, base command flag handling

### Phase 5: Auth Commands
**Files:** `src/commands/auth/login.ts`, `src/commands/auth/token.ts`, `src/commands/auth/status.ts`, `src/commands/auth/logout.ts`, `src/commands/auth/refresh.ts`

1. **`auth login`** — Browser OAuth flow:
   - Start local HTTP server on random port (or `--port`)
   - Build auth URL with correct scopes (including `offline`), random state (≥8 chars)
   - Open browser (or print URL with `--no-browser`)
   - `--no-browser` enhanced flow (Decision #3): print URL, then either wait for callback OR prompt user to paste redirect URL/auth code (for headless envs)
   - Catch redirect, verify state, exchange code for tokens
   - Save tokens with chmod 600
   - Fetch and cache basic profile in auth.json
   - Shut down server, print success
2. **`auth token`** — Manual token paste:
   - Interactive prompt (or `--access-token` / `--refresh-token` flags)
   - Validate token by calling `GET /v2/user/profile/basic`
   - Save if valid
3. **`auth status`** — Show auth state: logged in as who, token expiry, scopes
4. **`auth refresh`** — Force immediate token refresh
5. **`auth logout`** — Call `DELETE /v2/user/access`, delete local auth.json
6. **Tests (Decision #11):** Unit test each decomposed piece:
   - URL builder: correct params, scopes, state
   - State verification: CSRF check
   - Token exchange: msw-mock token endpoint
   - Token storage: file read/write/permissions
   - Callback handler: mock req/res

### Phase 6: Profile & Simple Data Commands
**Files:** `src/commands/profile/index.ts`, `src/commands/profile/body.ts`

1. **`profile`** — Display user profile (name, email, user ID)
2. **`profile body`** — Display body measurements with dual units (metric + imperial)
3. **Tests:** Profile display with all fields, body measurements with unit conversion

### Phase 7: Data Commands (Recovery, Sleep, Workout, Cycle)
**Files:** All files under `src/commands/recovery/`, `sleep/`, `workout/`, `cycle/`

Each resource follows the same pattern using BaseListCommand:

1. **`{resource}/index.ts`** — List command extending BaseListCommand:
   - Define columns, row mapping, endpoint
   - Resource-specific flags (e.g., `--sport` on workout list for client-side filtering)
2. **`{resource}/get.ts`** — Detail view for a single record by ID:
   - Full detail display with all fields
   - Score state handling: SCORED → show data, PENDING_SCORE → "(Pending)", UNSCORABLE → "(Unscorable)"
3. **`{resource}/latest.ts`** — Thin wrapper (Decision #6):
   - Fetch latest (list with limit=1), delegate to get's display logic

**Resource-specific details:**

- **Recovery:** Table columns: Date, Recovery%, HRV, RHR, SpO2, Skin Temp. Color-code recovery score.
- **Sleep:** Table columns: Date, Duration, Performance, Efficiency, Light, SWS, REM, Awake, Disturbances, Nap?. Convert all durations from ms. Latest shows sleep_needed breakdown.
- **Workout:** Table columns: Date, Sport, Strain, Duration, Avg HR, Max HR, Calories, Distance. Latest shows HR zone breakdown with bar chart visualization.
- **Cycle:** Table columns: ID, Start, End, Strain, Calories, Avg HR, Max HR, Status. Handle absent `end` field (current cycle).

4. **Tests (Decision #12):** Explicit edge case matrix with factory fixtures:
   - All three score states per resource
   - Optional fields present/absent (spo2, skin_temp, distance, altitude, end)
   - All output formats (table, json, csv, quiet)
   - Pagination: empty, single page, multi-page

### Phase 8: Dashboard Command
**Files:** `src/commands/dashboard.ts`

1. Fetch latest cycle (limit=1)
2. Parallel fan-out (Decision #4): `Promise.all([getCycleRecovery(cycleId), listSleeps(limit=1), listWorkouts(limit=1)])`
3. Compose the hero output:
   - Recovery: score with color emoji, HRV, RHR, SpO2, skin temp
   - Strain: today's strain, calories, HR stats
   - Sleep: duration, performance, stage breakdown, efficiency, consistency, resp rate
   - Workout: sport, strain, duration, HR stats, calories
4. Handle missing data gracefully: PENDING_SCORE, no workout today, current cycle without end
5. **Tests:** All combinations of data availability (full data, pending scores, no workout, no sleep yet)

### Phase 9: Config Commands
**Files:** `src/commands/config/set.ts`, `src/commands/config/list.ts`

1. **`config set <key> <value>`** — Validate key against known keys, coerce value types, save
2. **`config list`** — Display all config values (mask secrets)
3. **Tests:** Set/get roundtrip, invalid keys, type coercion

### Phase 10: Polish & Documentation
**Files:** `README.md`, final cleanup

1. Write README with: overview, prerequisites, installation, quick start, command reference, config options, examples, env vars, troubleshooting
2. Final pass: ensure all error messages match spec, help text is clear, --help works for all commands
3. Verify all tests pass, review coverage

---

## File Structure (Final)

```
whoop-cli/
├── bin/
│   ├── dev.js
│   └── run.js
├── src/
│   ├── commands/
│   │   ├── base.ts              # BaseCommand (global flags, auth check, formatter)
│   │   ├── base-list.ts         # BaseListCommand (pagination, date flags)
│   │   ├── auth/
│   │   │   ├── login.ts         # Browser OAuth + --no-browser headless
│   │   │   ├── token.ts         # Manual token paste
│   │   │   ├── refresh.ts       # Force token refresh
│   │   │   ├── status.ts        # Show auth state
│   │   │   └── logout.ts        # Revoke + clear
│   │   ├── config/
│   │   │   ├── set.ts           # config set <key> <value>
│   │   │   └── list.ts          # config list
│   │   ├── profile/
│   │   │   ├── index.ts         # Basic profile
│   │   │   └── body.ts          # Body measurements
│   │   ├── recovery/
│   │   │   ├── index.ts         # List recoveries
│   │   │   ├── get.ts           # Get by cycle ID
│   │   │   └── latest.ts        # Thin wrapper → get
│   │   ├── sleep/
│   │   │   ├── index.ts         # List sleeps
│   │   │   ├── get.ts           # Get by UUID
│   │   │   └── latest.ts        # Thin wrapper → get
│   │   ├── workout/
│   │   │   ├── index.ts         # List workouts
│   │   │   ├── get.ts           # Get by UUID
│   │   │   └── latest.ts        # Thin wrapper → get
│   │   ├── cycle/
│   │   │   ├── index.ts         # List cycles
│   │   │   ├── get.ts           # Get by ID
│   │   │   └── sleep.ts         # Get sleep for cycle
│   │   └── dashboard.ts         # Hero "today" command
│   ├── lib/
│   │   ├── api.ts               # WHOOP API client (axios + interceptors)
│   │   ├── auth.ts              # Token storage/refresh (chmod 600, lazy)
│   │   ├── config.ts            # Config file management (lazy)
│   │   ├── formatter.ts         # Table/JSON/CSV/quiet output
│   │   ├── pagination.ts        # Auto-pagination with streaming
│   │   ├── types.ts             # All TypeScript interfaces
│   │   └── units.ts             # Unit conversion helpers
│   └── index.ts                 # oclif entry point
├── test/
│   ├── unit/
│   │   ├── lib/
│   │   │   ├── api.test.ts
│   │   │   ├── auth.test.ts
│   │   │   ├── config.test.ts
│   │   │   ├── formatter.test.ts
│   │   │   ├── pagination.test.ts
│   │   │   └── units.test.ts
│   │   └── commands/
│   │       ├── auth/
│   │       │   └── login.test.ts
│   │       ├── dashboard.test.ts
│   │       ├── recovery/
│   │       │   ├── index.test.ts
│   │       │   ├── get.test.ts
│   │       │   └── latest.test.ts
│   │       └── ... (similar for sleep, workout, cycle, profile, config)
│   └── helpers/
│       ├── fixtures.ts          # Factory functions (makeRecovery, makeSleep, etc.)
│       └── mock-api.ts          # msw server setup + shared handlers
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
└── README.md
```

---

## Test Coverage Requirements

### Edge Case Matrix (Decision #12)

Every data command must test:
- [ ] `score_state: 'SCORED'` — normal display
- [ ] `score_state: 'PENDING_SCORE'` — shows "(Pending)"
- [ ] `score_state: 'UNSCORABLE'` — shows "(Unscorable)"
- [ ] Optional fields absent (spo2, skin_temp, distance, altitude, end)
- [ ] Empty records array (no data)
- [ ] All output formats: table, json, csv, quiet

API client must test:
- [ ] 401 → refresh → retry succeeds
- [ ] 401 → refresh fails → "Session expired" error
- [ ] 429 → parse Retry-After → wait → retry
- [ ] 404 → "Resource not found"
- [ ] 500 → "Server error"
- [ ] Network error → "Could not reach WHOOP API"

Auth must test:
- [ ] URL builder produces correct params and scopes
- [ ] State CSRF verification (match/mismatch)
- [ ] Token exchange with msw mock
- [ ] Token storage writes with correct permissions
- [ ] Auto-refresh triggers when token is within 5 min of expiry
- [ ] `WHOOP_ACCESS_TOKEN` env var overrides file-based auth

Pagination must test:
- [ ] Single page (no next_token)
- [ ] Multi-page with next_token chaining
- [ ] `--all` exhausts all pages
- [ ] `--limit N` stops at N records across pages
- [ ] `--pages N` stops at N pages
- [ ] Empty first page
