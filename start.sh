#!/usr/bin/env bash

# ==============================================================================
# Nucleus Suite - Unified One-Command Startup Script
# ==============================================================================
set -e

# Resolve script directory (nucleus-suite root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure common Node/NPM paths are in PATH
export PATH="/usr/local/bin:/opt/homebrew/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$PATH"

# Color constants
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                     NUCLEUS SUITE PLATFORM                     ║${NC}"
echo -e "${CYAN}║          Intelligent Workforce Operating System                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# 1. Check Node and NPM availability
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] Node.js is not found in PATH. Please ensure Node.js is installed.${NC}"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}[ERROR] npm is not found in PATH.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${BLUE}▶ Environment:${NC} Node ${NODE_VERSION} | npm $(npm -v)"

# 2. Check for environment file
if [ ! -f .env.local ] && [ ! -f .env ]; then
    echo -e "${YELLOW}[WARN] Neither .env.local nor .env found. Copying .env.example to .env.local...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo -e "${GREEN}[OK] Created .env.local from .env.example${NC}"
    fi
fi

# 3. Environment check
echo -e "${BLUE}▶ Verifying environment configuration...${NC}"
npm run env:check --silent

# 4. Parse custom port or mode arguments
PORT="${PORT:-3000}"
MODE="dev"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --port|-p) PORT="$2"; shift ;;
        --prod|--production) MODE="prod" ;;
        --build) MODE="build" ;;
        --help|-h)
            echo "Usage: ./start.sh [options]"
            echo ""
            echo "Options:"
            echo "  --port, -p <number>   Set port (default: 3000)"
            echo "  --prod, --production  Build and launch production server"
            echo "  --build               Run production build only"
            echo "  --help, -h            Show this help message"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

echo ""
echo -e "${GREEN}✓ Ready to start Nucleus Suite${NC}"
echo -e "  • Local URL:      ${CYAN}http://localhost:${PORT}${NC}"
echo -e "  • Workspace:      ${CYAN}http://localhost:${PORT}/workspace${NC}"
echo -e "  • API Docs:       ${CYAN}http://localhost:${PORT}/api-docs${NC}"
echo -e "  • Default Admin:  ${YELLOW}admin@nucleus.internal${NC}"
echo ""

# 5. Launch according to selected mode
if [ "$MODE" = "prod" ]; then
    echo -e "${BLUE}▶ Building and starting production server on port ${PORT}...${NC}"
    npm run build
    exec npm run start -- -p "$PORT"
elif [ "$MODE" = "build" ]; then
    echo -e "${BLUE}▶ Running production build...${NC}"
    exec npm run build
else
    echo -e "${BLUE}▶ Starting Next.js Turbopack development server on port ${PORT}...${NC}"
    exec npx next dev --turbopack -p "$PORT"
fi
