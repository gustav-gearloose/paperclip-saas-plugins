#!/usr/bin/env bash
# setup-vps.sh — provision a fresh Ubuntu/Debian VPS with bare-metal Paperclip
#
# Paperclip runs as a systemd service directly on the host (no Docker).
# Caddy handles HTTPS termination (auto Let's Encrypt).
# PostgreSQL runs as a native systemd service — data survives everything.
#
# Run from your Mac. Connects to the VPS via SSH.
# After this script, run onboard-customer.sh to finish customer configuration.
#
# Usage:
#   ./scripts/setup-vps.sh <ssh-host> <domain> [anthropic-api-key]
#
# Arguments:
#   ssh-host           SSH alias or user@ip for the target VPS (key-based auth)
#   domain             Public domain pointing to the VPS, e.g. paperclip.acme-corp.com
#   anthropic-api-key  Optional — sk-ant-... key for Claude (can be set later in UI)
#
# Prerequisites:
#   - Ubuntu 22.04+ or Debian 12+
#   - Your SSH public key installed on the VPS (root or sudo user)
#   - DNS A record for <domain> already pointing to the VPS IP
#   - Ports 80 and 443 open (Caddy needs them for Let's Encrypt)
#
# After success:
#   1. Open https://<domain> in your browser to complete Paperclip onboarding
#   2. Run: ./scripts/onboard-customer.sh <customer-slug>

set -euo pipefail

SSH_HOST="${1:?Usage: $0 <ssh-host> <domain> [anthropic-api-key]}"
DOMAIN="${2:?Usage: $0 <ssh-host> <domain> [anthropic-api-key]}"
ANTHROPIC_API_KEY="${3:-}"

# If domain is an IP address or "local", skip Caddy and use HTTP directly
IS_LOCAL=false
if [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$DOMAIN" == "local" ]]; then
  IS_LOCAL=true
fi

PAPERCLIP_REPO="https://github.com/gustav-gearloose/paperclip.git"
PAPERCLIP_DIR="/opt/paperclip"
PAPERCLIP_DATA="/paperclip-data"
PAPERCLIP_PORT=3100

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "  ${CYAN}→${NC} $*"; }
ok()      { echo -e "  ${GREEN}✅${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠️ ${NC} $*"; }
die()     { echo -e "\n  ${RED}❌ $*${NC}" >&2; exit 1; }
section() { echo -e "\n${CYAN}── $* ──${NC}"; }

# Run a command on the remote host
r() { ssh "$SSH_HOST" "$@"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Paperclip VPS Setup — Gearloose        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  SSH host:  $SSH_HOST"
echo "  Domain:    $DOMAIN"
echo "  Paperclip: $PAPERCLIP_REPO"
[[ -n "$ANTHROPIC_API_KEY" ]] && echo "  Anthropic key: provided"

# ── step 1: verify SSH ────────────────────────────────────────────────────────

section "Step 1: Verify SSH connectivity"

ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSH_HOST" "echo ok" 2>/dev/null \
  | grep -q ok || die "Cannot SSH to $SSH_HOST. Check ~/.ssh/config and key-based auth."
ok "SSH to $SSH_HOST works"

OS=$(r "lsb_release -si 2>/dev/null || cat /etc/os-release | grep ^ID= | cut -d= -f2" | tr -d '"')
info "OS: $OS"
[[ "$OS" =~ Ubuntu|Debian|debian|ubuntu ]] || warn "Untested OS: $OS"

# ── step 2: install system packages ──────────────────────────────────────────

section "Step 2: Install Node.js 22, pnpm, PostgreSQL 16, Caddy"

r "export DEBIAN_FRONTEND=noninteractive && sudo apt-get update -qq"

# Node.js 22 via NodeSource
NODE_VERSION=$(r "node --version 2>/dev/null | cut -c2- | cut -d. -f1 || echo 0")
if [[ "$NODE_VERSION" -ge 22 ]]; then
  ok "Node.js $NODE_VERSION already installed"
else
  info "Installing Node.js 22..."
  r "curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - 2>/dev/null"
  r "sudo apt-get install -y nodejs"
  ok "Node.js $(r 'node --version') installed"
fi

# pnpm
if r "command -v pnpm >/dev/null 2>&1"; then
  ok "pnpm already installed"
else
  info "Installing pnpm..."
  r "sudo npm install -g pnpm"
  ok "pnpm $(r 'pnpm --version') installed"
fi

# PostgreSQL — prefer 16, fall back to whatever is available
PG_INSTALLED=$(r "command -v psql >/dev/null 2>&1 && echo yes || echo no")
if [[ "$PG_INSTALLED" == "yes" ]]; then
  ok "PostgreSQL already installed ($(r 'psql --version 2>/dev/null | head -1'))"
else
  info "Installing PostgreSQL..."
  # Try pg 16 first; fall back to distro default
  PG_PKG=$(r "apt-cache show postgresql-16 >/dev/null 2>&1 && echo postgresql-16 || echo postgresql")
  r "sudo apt-get install -y $PG_PKG"
  r "sudo systemctl enable postgresql --now"
  ok "PostgreSQL installed ($PG_PKG)"
fi

# Caddy
CADDY_INSTALLED=$(r "command -v caddy >/dev/null 2>&1 && echo yes || echo no")
if [[ "$CADDY_INSTALLED" == "yes" ]]; then
  ok "Caddy already installed"
else
  info "Installing Caddy..."
  r "sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https 2>/dev/null || true"
  r "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg"
  r "curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list"
  r "sudo apt-get update -qq && sudo apt-get install -y caddy"
  ok "Caddy installed"
fi

# ── step 3: set up PostgreSQL database ───────────────────────────────────────

section "Step 3: Set up PostgreSQL database"

DB_EXISTS=$(r "sudo -u postgres psql -tAc \"SELECT 1 FROM pg_database WHERE datname='paperclip'\" 2>/dev/null || echo ''")
if [[ "$DB_EXISTS" == "1" ]]; then
  ok "Database 'paperclip' already exists"
else
  info "Creating database and user..."
  PG_PASSWORD=$(openssl rand -hex 24)
  r "sudo -u postgres psql -c \"CREATE USER paperclip WITH PASSWORD '$PG_PASSWORD';\" 2>/dev/null || true"
  r "sudo -u postgres psql -c \"CREATE DATABASE paperclip OWNER paperclip;\" 2>/dev/null || true"
  # pgcrypto needed for gen_random_uuid() on PostgreSQL < 13
  r "sudo -u postgres psql -d paperclip -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;' 2>/dev/null || true"
  # Store password for use in systemd unit
  r "echo 'PG_PASSWORD=$PG_PASSWORD' | sudo tee $PAPERCLIP_DATA/.pg_password > /dev/null 2>/dev/null || \
     (sudo mkdir -p $PAPERCLIP_DATA && echo 'PG_PASSWORD=$PG_PASSWORD' | sudo tee $PAPERCLIP_DATA/.pg_password > /dev/null)"
  ok "Database 'paperclip' created"
fi

# Read the stored PG password
PG_PASSWORD=$(r "sudo cat $PAPERCLIP_DATA/.pg_password 2>/dev/null | grep PG_PASSWORD | cut -d= -f2" || echo "")
[[ -n "$PG_PASSWORD" ]] || die "Could not read PG_PASSWORD from $PAPERCLIP_DATA/.pg_password"
DATABASE_URL="postgresql://paperclip:${PG_PASSWORD}@localhost:5432/paperclip"

# ── step 4: clone Paperclip ───────────────────────────────────────────────────

section "Step 4: Clone Paperclip from $PAPERCLIP_REPO"

CURRENT_USER=$(r "whoami")

ALREADY_CLONED=$(r "test -d $PAPERCLIP_DIR/.git && echo yes || echo no")
if [[ "$ALREADY_CLONED" == "yes" ]]; then
  info "$PAPERCLIP_DIR already exists — pulling latest..."
  r "cd $PAPERCLIP_DIR && sudo git pull --ff-only 2>/dev/null || true"
  ok "Up to date"
else
  info "Cloning to $PAPERCLIP_DIR (this may take a moment)..."
  r "sudo git clone $PAPERCLIP_REPO $PAPERCLIP_DIR"
  r "sudo chown -R $CURRENT_USER:$CURRENT_USER $PAPERCLIP_DIR"
  ok "Cloned"
fi

# ── step 5: install dependencies and build ────────────────────────────────────

section "Step 5: Install dependencies and build Paperclip (~5-10 min)"

BUILD_SENTINEL="$PAPERCLIP_DIR/.gearloose-build-ok"
ALREADY_BUILT=$(r "test -f $BUILD_SENTINEL && echo yes || echo no")

if [[ "$ALREADY_BUILT" == "yes" ]]; then
  info "Build already done (delete $BUILD_SENTINEL to force rebuild)"
else
  info "Running pnpm install..."
  r "cd $PAPERCLIP_DIR && pnpm install 2>&1 | tail -3"
  info "Running pnpm build..."
  r "cd $PAPERCLIP_DIR && pnpm build 2>&1 | tail -5" \
    || die "pnpm build failed — SSH in and check: cd $PAPERCLIP_DIR && pnpm build"
  r "touch $BUILD_SENTINEL"
  ok "Build complete"
fi

# ── step 6: generate secrets ──────────────────────────────────────────────────

section "Step 6: Generate secrets"

SECRETS_FILE="$PAPERCLIP_DATA/.secrets"
r "sudo mkdir -p $PAPERCLIP_DATA && sudo chown $CURRENT_USER:$CURRENT_USER $PAPERCLIP_DATA"

SECRETS_EXIST=$(r "test -f $SECRETS_FILE && echo yes || echo no")
if [[ "$SECRETS_EXIST" == "yes" ]]; then
  warn "$SECRETS_FILE already exists — not overwriting (secrets preserved)"
else
  BETTER_AUTH_SECRET=$(openssl rand -hex 32)
  if [[ "$IS_LOCAL" == "true" ]]; then
    PUBLIC_URL="http://$DOMAIN:$PAPERCLIP_PORT"
  else
    PUBLIC_URL="https://$DOMAIN"
  fi
  r "cat > $SECRETS_FILE" << SECRETSEOF
BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
DATABASE_URL=$DATABASE_URL
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
PAPERCLIP_PUBLIC_URL=$PUBLIC_URL
PAPERCLIP_DEPLOYMENT_MODE=authenticated
SECRETSEOF
  r "chmod 600 $SECRETS_FILE"
  ok "Secrets written to $SECRETS_FILE"
fi

# ── step 7: write systemd unit ────────────────────────────────────────────────

section "Step 7: Install Paperclip systemd service"

r "sudo tee /etc/systemd/system/paperclip.service > /dev/null" << UNITEOF
[Unit]
Description=Paperclip AI
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PAPERCLIP_DIR
EnvironmentFile=$SECRETS_FILE
Environment=NODE_ENV=production
Environment=PAPERCLIP_HOME=$PAPERCLIP_DATA
Environment=PORT=$PAPERCLIP_PORT
Environment=HOST=0.0.0.0

ExecStart=/usr/bin/node \
  --import $PAPERCLIP_DIR/server/node_modules/tsx/dist/loader.mjs \
  $PAPERCLIP_DIR/server/dist/index.js

Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=paperclip

[Install]
WantedBy=multi-user.target
UNITEOF

r "sudo systemctl daemon-reload"
r "sudo systemctl enable paperclip"
ok "paperclip.service installed and enabled"

# ── step 8: configure Caddy ───────────────────────────────────────────────────

section "Step 8: Configure Caddy for https://$DOMAIN"

if [[ "$IS_LOCAL" == "true" ]]; then
  warn "Local/IP domain — skipping Caddy (Paperclip accessible at http://$DOMAIN:$PAPERCLIP_PORT)"
  r "sudo systemctl disable caddy --now 2>/dev/null || true"
else
  r "sudo tee /etc/caddy/Caddyfile > /dev/null" << CADDYEOF
$DOMAIN {
    reverse_proxy 127.0.0.1:$PAPERCLIP_PORT
}
CADDYEOF
  r "sudo systemctl enable caddy"
  ok "Caddyfile written for $DOMAIN"
fi

# ── step 9: set up backups ────────────────────────────────────────────────────

section "Step 9: Set up hourly database backups"

BACKUP_DIR="$PAPERCLIP_DATA/backups"
r "mkdir -p $BACKUP_DIR"

# Write backup script
r "cat > $PAPERCLIP_DATA/backup.sh" << 'BACKUPEOF'
#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/.secrets"
BACKUP_DIR="$(dirname "$0")/backups"
mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/paperclip-$(date +%Y%m%d-%H%M).sql.gz"
pg_dump "$DATABASE_URL" | gzip > "$FILE"
# Keep last 7 days (168 hourly backups)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
echo "Backup: $FILE"
BACKUPEOF
r "chmod +x $PAPERCLIP_DATA/backup.sh"

# Install cron job (idempotent)
r "(crontab -l 2>/dev/null | grep -v 'paperclip/backup.sh'; echo '0 * * * * $PAPERCLIP_DATA/backup.sh >> $PAPERCLIP_DATA/backups/backup.log 2>&1') | crontab -"
ok "Hourly backups to $BACKUP_DIR (7-day retention)"

# ── step 10: start services ───────────────────────────────────────────────────

section "Step 10: Start all services"

info "Starting PostgreSQL..."
r "sudo systemctl start postgresql"

info "Starting Paperclip..."
r "sudo systemctl start paperclip"

if [[ "$IS_LOCAL" != "true" ]]; then
  info "Reloading Caddy..."
  r "sudo systemctl reload caddy 2>/dev/null || sudo systemctl start caddy"
fi

ok "All services started"

# ── step 11: wait for health ──────────────────────────────────────────────────

section "Step 11: Wait for Paperclip to be healthy"

info "Polling http://localhost:$PAPERCLIP_PORT/api/health (up to 120s)..."
ATTEMPTS=0
MAX_ATTEMPTS=40
until r "curl -sf http://localhost:$PAPERCLIP_PORT/api/health > /dev/null 2>&1" \
    || [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  echo -n "."
  sleep 3
done
echo ""

if [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; then
  warn "Paperclip not healthy after 120s"
  info "Check logs: ssh $SSH_HOST 'journalctl -u paperclip --no-pager -n 50'"
  die "Health check timed out"
fi

HEALTH=$(r "curl -s http://localhost:$PAPERCLIP_PORT/api/health")
ok "Paperclip is healthy: $HEALTH"

# ── done ─────────────────────────────────────────────────────────────────────

section "Done"

echo ""
echo -e "  ${GREEN}Paperclip is running at:${NC}"
if [[ "$IS_LOCAL" == "true" ]]; then
  echo "    http://$DOMAIN:$PAPERCLIP_PORT  (direct, no TLS)"
else
  echo "    https://$DOMAIN  (Caddy HTTPS — cert auto-issued)"
fi
echo "    http://localhost:$PAPERCLIP_PORT  (internal)"
echo ""
echo -e "  ${CYAN}Service management:${NC}"
echo "    Status:  ssh $SSH_HOST 'systemctl status paperclip postgresql caddy'"
echo "    Logs:    ssh $SSH_HOST 'journalctl -u paperclip -f'"
echo "    Upgrade: ssh $SSH_HOST 'cd $PAPERCLIP_DIR && git pull && pnpm build && sudo systemctl restart paperclip'"
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
if [[ "$IS_LOCAL" == "true" ]]; then
  echo "  1. Open http://$DOMAIN:$PAPERCLIP_PORT in your browser to complete Paperclip onboarding"
else
  echo "  1. Open https://$DOMAIN in your browser to complete Paperclip onboarding"
fi
echo "     (create your company and first admin user)"
echo "  2. Add SSH alias to ~/.ssh/config if not already:"
echo "       Host <customer-slug>"
echo "         HostName <vps-ip>"
echo "         User $CURRENT_USER"
echo "  3. Run: ./scripts/onboard-customer.sh <customer-slug>"
echo ""
echo "  Backup: $BACKUP_DIR (hourly, 7-day retention)"
echo "  Secrets: $SECRETS_FILE"
echo ""
