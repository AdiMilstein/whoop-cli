# whoop-cli

A command-line interface for the [WHOOP Developer API v2](https://developer.whoop.com/). View recovery scores, sleep data, workouts, cycles, and profile info from your terminal.

## Prerequisites

- **Node.js** >= 20
- A **WHOOP account** with an active membership
- A registered app at the [WHOOP Developer Dashboard](https://developer-dashboard.whoop.com) to get your `client_id` and `client_secret`

## Installation

```bash
npm install -g whoop-cli
```

Or run locally:

```bash
git clone <repo-url>
cd whoop-cli
npm install
npm run build
npm link
```

## Quick Start

### 1. Set your OAuth credentials

```bash
whoop config set client_id YOUR_CLIENT_ID
whoop config set client_secret YOUR_CLIENT_SECRET
```

Or use environment variables:

```bash
export WHOOP_CLIENT_ID=your_client_id
export WHOOP_CLIENT_SECRET=your_client_secret
```

### 2. Authenticate

```bash
whoop auth login
```

This opens your browser for the OAuth flow. For headless/SSH environments:

```bash
whoop auth login --no-browser
```

### 3. Check your dashboard

```bash
whoop dashboard
```

## Commands

### Dashboard

| Command | Description |
|---------|-------------|
| `whoop dashboard` | Today's overview: recovery, strain, sleep, workout |

### Authentication

| Command | Description |
|---------|-------------|
| `whoop auth login` | Browser-based OAuth flow |
| `whoop auth login --no-browser` | Print auth URL (for headless envs) |
| `whoop auth token` | Paste an access token directly |
| `whoop auth status` | Show current auth state |
| `whoop auth refresh` | Force token refresh |
| `whoop auth logout` | Revoke and clear tokens |

### Recovery

| Command | Description |
|---------|-------------|
| `whoop recovery` | List recent recoveries |
| `whoop recovery latest` | Latest recovery score |
| `whoop recovery get <cycleId>` | Recovery for a specific cycle |

### Sleep

| Command | Description |
|---------|-------------|
| `whoop sleep` | List recent sleep sessions |
| `whoop sleep latest` | Latest sleep details |
| `whoop sleep get <sleepId>` | Specific sleep by UUID |

### Workout

| Command | Description |
|---------|-------------|
| `whoop workout` | List recent workouts |
| `whoop workout latest` | Latest workout with HR zones |
| `whoop workout get <workoutId>` | Specific workout by UUID |

### Cycle

| Command | Description |
|---------|-------------|
| `whoop cycle` | List physiological cycles |
| `whoop cycle get <cycleId>` | Specific cycle by ID |
| `whoop cycle sleep <cycleId>` | Sleep data for a cycle |

### Profile

| Command | Description |
|---------|-------------|
| `whoop profile` | Basic profile info |
| `whoop profile body` | Body measurements (metric + imperial) |

### Configuration

| Command | Description |
|---------|-------------|
| `whoop config set <key> <value>` | Set a config value |
| `whoop config list` | Show all config values |

## Global Flags

All data commands support:

| Flag | Description |
|------|-------------|
| `--json` | Output raw JSON |
| `--csv` | Output as CSV |
| `--format table\|json\|csv` | Explicit format |
| `--no-color` | Disable colored output |
| `-q, --quiet` | Minimal output (just the key value) |
| `--units metric\|imperial` | Unit system |

List commands additionally support:

| Flag | Description |
|------|-------------|
| `--start <date>` | Start date filter |
| `--end <date>` | End date filter |
| `-l, --limit <n>` | Number of records |
| `--all` | Fetch all pages |
| `--pages <n>` | Number of pages to fetch |

### Date Formats

The `--start` and `--end` flags accept:

- **Relative**: `7d` (7 days ago), `2w` (2 weeks), `1m` (1 month), `today`, `yesterday`
- **ISO 8601**: `2024-01-15` or `2024-01-15T00:00:00Z`

## Configuration

Config file: `~/.config/whoop-cli/config.json`

| Key | Values | Default |
|-----|--------|---------|
| `units` | `metric`, `imperial` | `metric` |
| `default_format` | `table`, `json`, `csv` | `table` |
| `default_limit` | `1`-`25` | `10` |
| `color` | `true`, `false` | `true` |
| `client_id` | string | — |
| `client_secret` | string | — |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `WHOOP_CLIENT_ID` | OAuth client ID (overrides config) |
| `WHOOP_CLIENT_SECRET` | OAuth client secret (overrides config) |
| `WHOOP_ACCESS_TOKEN` | Skip OAuth entirely; use this token |
| `WHOOP_CONFIG_DIR` | Override config directory |

## Examples

### Check today's recovery

```bash
whoop recovery latest
```

### Export last 30 days of recovery to CSV

```bash
whoop recovery --start 30d --all --csv > recovery.csv
```

### Script: alert if recovery is low

```bash
RECOVERY=$(whoop recovery latest -q)
if [ "$RECOVERY" -lt 34 ]; then
  echo "Recovery is red ($RECOVERY%). Take it easy today."
fi
```

### Get all workouts for a date range

```bash
whoop workout --start 2024-01-01 --end 2024-01-31 --all --json | jq '.[].sport_name'
```

### Filter workouts by sport

```bash
whoop workout --sport Running --start 30d
```

## Troubleshooting

**"Not authenticated"** — Run `whoop auth login` to authenticate.

**"Session expired"** — Your tokens have expired. Run `whoop auth login` again, or ensure you authenticated with the `offline` scope for refresh tokens.

**"Missing client_id or client_secret"** — Set your OAuth credentials via `whoop config set` or environment variables. Register an app at [developer-dashboard.whoop.com](https://developer-dashboard.whoop.com).

**"Rate limited"** — The CLI will auto-retry with backoff. If persistent, reduce request frequency or wait a few minutes.

**"Could not reach WHOOP API"** — Check your internet connection. The API base URL is `api.prod.whoop.com`.

## License

MIT
