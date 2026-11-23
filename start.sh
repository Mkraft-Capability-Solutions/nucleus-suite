#!/usr/bin/env bash

# ==============================================================================
# Nucleus Suite - One-command local startup
#
# Database modes:
#   default   Uses DATABASE_URL from .env.local (Next.js loads it). The script
#             does not read the URL, print it, create databases or run migrations.
#   --local   Pins DATABASE_URL to a local PostgreSQL (NUCLEUS_LOCAL_DATABASE_URL,
#             default postgresql://localhost:5432/nucleus_hrms), creates the
#             database if missing and applies migrations to an empty one.
#
# Usage:
#   ./start.sh                  Dev server on port 9000, database from .env.local
#   ./start.sh --local          Dev server on the local PostgreSQL copy
#   ./start.sh --port 3100      Another port (also: PORT=3100 ./start.sh)
#   ./start.sh --seed           Also load demo tenants (npm run seed:demo-tenants)
#   ./start.sh --check          Preflight only, then exit
#   ./start.sh --prod           Build and run the production server
#   ./start.sh --build          Production build only
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Node/npm from common install locations (nvm, Homebrew).
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -n 1)/bin:$PATH"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${BLUE}▶${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail()  { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ---- arguments ----------------------------------------------------------------
PORT="${PORT:-9000}"
MODE="dev"
DB_MODE="env"
SEED=0
CHECK_ONLY=0
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --port|-p)           [[ -n "${2:-}" ]] || fail "--port needs a number"; PORT="$2"; shift ;;
    --local)             DB_MODE="local" ;;
    --prod|--production) MODE="prod" ;;
    --build)             MODE="build" ;;
    --seed)              SEED=1 ;;
    --check)             CHECK_ONLY=1 ;;
    --help|-h)
      sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) fail "Unknown option: $1 (try --help)" ;;
  esac
  shift
done
[[ "$PORT" =~ ^[0-9]+$ ]] || fail "Port must be a number, got: $PORT"

echo ""
echo -e "${CYAN}Nucleus Suite — local start${NC}"
echo ""

# ---- 1. Node and npm ----------------------------------------------------------
command -v node >/dev/null 2>&1 || fail "Node.js not found in PATH."
command -v npm  >/dev/null 2>&1 || fail "npm not found in PATH."
info "Environment: Node $(node -v) | npm $(npm -v)"

# ---- 2. Database --------------------------------------------------------------
if [[ "$DB_MODE" == "env" ]]; then
  # The URL stays in .env.local. Next.js and check-env load it in-process; nothing here prints it.
  ok "Database: DATABASE_URL from .env.local (not printed). No database setup or migrations run."
  warn "Shared database: writes from this session land in the database named in .env.local."
else
  LOCAL_DB_URL="${NUCLEUS_LOCAL_DATABASE_URL:-postgresql://localhost:5432/nucleus_hrms}"
  DB_RE='^postgres(ql)?://([^@/]+@)?(localhost|127\.0\.0\.1)(:([0-9]+))?/([^/?]+)'
  [[ "$LOCAL_DB_URL" =~ $DB_RE ]] || fail "NUCLEUS_LOCAL_DATABASE_URL must point to localhost or 127.0.0.1."
  DB_HOST="127.0.0.1"
  DB_PORT="${BASH_REMATCH[5]:-5432}"
  DB_NAME="${BASH_REMATCH[6]}"
  export DATABASE_URL="$LOCAL_DB_URL"
  ok "Database: local PostgreSQL ${DB_HOST}:${DB_PORT}/${DB_NAME} (DATABASE_URL pinned for this run)"

  command -v pg_isready >/dev/null 2>&1 || fail "pg_isready not found. Install PostgreSQL client tools (brew install libpq)."
  command -v psql >/dev/null 2>&1       || fail "psql not found. Install PostgreSQL client tools (brew install libpq)."
  pg_isready -q -h "$DB_HOST" -p "$DB_PORT" || fail "PostgreSQL is not accepting connections on ${DB_HOST}:${DB_PORT}."
  ok "PostgreSQL is accepting connections"

  PSQL=(psql -w -X -q -h "$DB_HOST" -p "$DB_PORT")
  exists="$("${PSQL[@]}" -d postgres -Atc "select 1 from pg_database where datname = '${DB_NAME}'")"
  if [[ "$exists" != "1" ]]; then
    info "Database ${DB_NAME} does not exist. Creating it."
    createdb -w -h "$DB_HOST" -p "$DB_PORT" "$DB_NAME" || fail "Could not create database ${DB_NAME}."
    ok "Created ${DB_NAME}"
  fi
  tables="$("${PSQL[@]}" -d "$DB_NAME" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")"
  if [[ "$tables" == "0" ]]; then
    info "Empty database. Applying migrations (npm run db:migrate)."
    npm run db:migrate --silent || fail "Migrations failed. Fix the migration error above, then re-run."
    ok "Migrations applied"
  else
    ok "Database has ${tables} public tables. Migrations are not re-run automatically."
    warn "db/migrations do not create every table the server code writes to (docs/plans/V1.0/UI-AUDIT-AND-COMPONENT-DESIGN.html, section 2, finding 2)."
  fi
fi

# ---- 3. Environment validation ------------------------------------------------
if [[ ! -f .env.local && ! -f .env ]]; then
  if [[ -f .env.example ]]; then
    warn "No .env.local or .env found. Creating .env.local from .env.example."
    cp .env.example .env.local
  fi
fi
info "Validating environment (no credentials printed)"
npm run env:check --silent || fail "Environment check failed. See the messages above."

if [[ "$CHECK_ONLY" -eq 1 ]]; then
  ok "Preflight passed (database mode: ${DB_MODE}). Exiting (--check)."
  exit 0
fi

if [[ "$SEED" -eq 1 ]]; then
  info "Loading demo tenants (npm run seed:demo-tenants)"
  npm run seed:demo-tenants || fail "Seeding failed."
fi

echo ""
ok "Ready"
echo -e "  • App:        ${CYAN}http://localhost:${PORT}${NC}"
echo -e "  • Workspace:  ${CYAN}http://localhost:${PORT}/workspace${NC}"
echo -e "  • API docs:   ${CYAN}http://localhost:${PORT}/api-docs${NC}"
echo ""

# ---- 4. Launch ----------------------------------------------------------------
case "$MODE" in
  prod)
    info "Building and starting production server on port ${PORT}"
    npm run build
    exec npx next start -p "$PORT"
    ;;
  build)
    info "Production build"
    exec npm run build
    ;;
  *)
    info "Starting Next.js dev server (Turbopack) on port ${PORT}"
    exec npx next dev --turbopack -p "$PORT"
    ;;
esac
