#!/usr/bin/env bash
# setup-vps.sh — provision a fresh Ubuntu/Debian VPS with Docker + Paperclip
#
# Run from your Mac. Connects to the VPS via SSH, installs Docker, clones the
# MadeByAdem paperclipai-docker repo, generates secrets, and starts Paperclip.
# After this script, run onboard-customer.sh to finish customer configuration.
#
# Usage:
#   ./scripts/setup-vps.sh <ssh-host> <domain> [anthropic-api-key]
#
# Arguments:
#   ssh-host           SSH alias or user@ip for the target VPS (must have key-based auth)
#   domain             Public domain pointing to the VPS, e.g. paperclip.acme-corp.com
#   anthropic-api-key  Optional — sk-ant-... key for Claude (can be set later in UI)
#
# Prerequisites:
#   - VPS running Ubuntu 22.04+ or Debian 12+
#   - Your SSH public key already installed on the VPS (root or sudo user)
#   - DNS A record for <domain> pointing to the VPS IP
#   - Caddy will be installed for automatic HTTPS (port 80/443 must be open)
#
# After success:
#   1. Create SSH alias in ~/.ssh/config pointing to this VPS
#   2. Run: ./scripts/onboard-customer.sh <customer-slug>
#   3. The Paperclip admin URL will be https://<domain>

set -euo pipefail

SSH_HOST="${1:?Usage: $0 <ssh-host> <domain> [anthropic-api-key]}"
DOMAIN="${2:?Usage: $0 <ssh-host> <domain> [anthropic-api-key]}"
ANTHROPIC_API_KEY="${3:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()    { echo -e "  ${CYAN}→${NC} $*"; }
ok()      { echo -e "  ${GREEN}✅${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠️ ${NC} $*"; }
die()     { echo -e "\n  ${RED}❌ $*${NC}" >&2; exit 1; }
section() { echo -e "\n${CYAN}── $* ──${NC}"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   Paperclip VPS Setup — Gearloose        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo "  SSH host: $SSH_HOST"
echo "  Domain:   $DOMAIN"
[[ -n "$ANTHROPIC_API_KEY" ]] && echo "  Anthropic key: provided"

# ── verify SSH ────────────────────────────────────────────────────────────────

section "Step 1: Verify SSH connectivity"

ssh -o ConnectTimeout=10 -o BatchMode=yes "$SSH_HOST" "echo ok" 2>/dev/null \
  | grep -q ok || die "Cannot SSH to $SSH_HOST. Check your ~/.ssh/config and key-based auth."
ok "SSH to $SSH_HOST works"

OS=$(ssh "$SSH_HOST" "lsb_release -si 2>/dev/null || cat /etc/os-release | grep ^ID= | cut -d= -f2" | tr -d '"')
VERSION=$(ssh "$SSH_HOST" "lsb_release -sr 2>/dev/null || cat /etc/os-release | grep ^VERSION_ID= | cut -d= -f2" | tr -d '"')
info "OS: $OS $VERSION"
[[ "$OS" =~ Ubuntu|Debian|debian|ubuntu ]] || warn "Untested OS: $OS. Script is designed for Ubuntu/Debian."

# ── install Docker ────────────────────────────────────────────────────────────

section "Step 2: Install Docker"

DOCKER_INSTALLED=$(ssh "$SSH_HOST" "command -v docker >/dev/null 2>&1 && echo yes || echo no")
if [[ "$DOCKER_INSTALLED" == "yes" ]]; then
  DOCKER_VERSION=$(ssh "$SSH_HOST" "docker --version")
  ok "Docker already installed: $DOCKER_VERSION"
else
  info "Installing Docker via official install script..."
  ssh "$SSH_HOST" "curl -fsSL https://get.docker.com | sh" \
    || die "Docker install failed"
  ok "Docker installed"
fi

# Ensure Docker starts on boot
ssh "$SSH_HOST" "sudo systemctl enable docker --now 2>/dev/null || true"
ok "Docker service enabled"

# Add current user to docker group (non-root access)
CURRENT_USER=$(ssh "$SSH_HOST" "whoami")
ssh "$SSH_HOST" "sudo usermod -aG docker $CURRENT_USER 2>/dev/null || true"
info "User $CURRENT_USER added to docker group (takes effect on next login)"

# ── install Caddy ─────────────────────────────────────────────────────────────

section "Step 3: Install Caddy (HTTPS reverse proxy)"

CADDY_INSTALLED=$(ssh "$SSH_HOST" "command -v caddy >/dev/null 2>&1 && echo yes || echo no")
if [[ "$CADDY_INSTALLED" == "yes" ]]; then
  ok "Caddy already installed"
else
  info "Installing Caddy..."
  ssh "$SSH_HOST" "
    sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl 2>/dev/null || true
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
    sudo apt-get update -qq
    sudo apt-get install -y caddy
  " || die "Caddy install failed"
  ok "Caddy installed"
fi

# ── write Caddyfile ───────────────────────────────────────────────────────────

section "Step 4: Configure Caddy for $DOMAIN"

ssh "$SSH_HOST" "sudo tee /etc/caddy/Caddyfile > /dev/null" << CADDYEOF
$DOMAIN {
    reverse_proxy 127.0.0.1:3100
}
CADDYEOF

ssh "$SSH_HOST" "sudo systemctl reload caddy 2>/dev/null || sudo systemctl start caddy"
ok "Caddy configured for https://$DOMAIN → localhost:3100"

# ── clone paperclipai-docker ──────────────────────────────────────────────────

section "Step 5: Clone Paperclip Docker setup"

DEPLOY_DIR="/opt/paperclip-deploy"

ALREADY_CLONED=$(ssh "$SSH_HOST" "test -d $DEPLOY_DIR && echo yes || echo no")
if [[ "$ALREADY_CLONED" == "yes" ]]; then
  info "Deploy dir already exists at $DEPLOY_DIR — pulling latest..."
  ssh "$SSH_HOST" "cd $DEPLOY_DIR && git pull --ff-only 2>/dev/null || true"
  ok "Repo up to date"
else
  info "Cloning paperclipai-docker..."
  ssh "$SSH_HOST" "sudo git clone https://github.com/MadeByAdem/paperclipai-docker.git $DEPLOY_DIR && sudo chown -R $CURRENT_USER:$CURRENT_USER $DEPLOY_DIR"
  ok "Cloned to $DEPLOY_DIR"
fi

# ── generate secrets and write .env ──────────────────────────────────────────

section "Step 6: Generate secrets and write .env"

ENV_EXISTS=$(ssh "$SSH_HOST" "test -f $DEPLOY_DIR/.env && echo yes || echo no")
if [[ "$ENV_EXISTS" == "yes" ]]; then
  warn ".env already exists at $DEPLOY_DIR/.env — not overwriting (secrets preserved)"
else
  info "Generating BETTER_AUTH_SECRET and POSTGRES_PASSWORD..."

  BETTER_AUTH_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)

  ENV_CONTENT="# Paperclip Docker — generated by setup-vps.sh $(date -u +%Y-%m-%dT%H:%M:%SZ)
BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
PAPERCLIP_PUBLIC_URL=https://$DOMAIN
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
OPENAI_API_KEY=
"
  echo "$ENV_CONTENT" | ssh "$SSH_HOST" "cat > $DEPLOY_DIR/.env && chmod 600 $DEPLOY_DIR/.env"
  ok "Written: $DEPLOY_DIR/.env (chmod 600)"
fi

# ── build and start Paperclip ─────────────────────────────────────────────────

section "Step 7: Build and start Paperclip"

# Build from source (MadeByAdem builds from paperclipai/paperclip source)
info "Building Paperclip Docker image (this takes 3–8 minutes on first run)..."
ssh "$SSH_HOST" "cd $DEPLOY_DIR && docker compose build 2>&1 | tail -5" \
  || die "docker compose build failed — check logs on VPS: cd $DEPLOY_DIR && docker compose build"
ok "Build complete"

info "Starting Paperclip in detached mode..."
ssh "$SSH_HOST" "cd $DEPLOY_DIR && docker compose up -d" \
  || die "docker compose up failed"
ok "Paperclip started"

# ── wait for health ───────────────────────────────────────────────────────────

section "Step 8: Wait for Paperclip to be healthy"

info "Polling http://localhost:3100/api/health (up to 90s)..."
ATTEMPTS=0
MAX_ATTEMPTS=30
until ssh "$SSH_HOST" "curl -sf http://localhost:3100/api/health > /dev/null 2>&1" \
    || [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  echo -n "."
  sleep 3
done
echo ""

if [[ $ATTEMPTS -ge $MAX_ATTEMPTS ]]; then
  warn "Paperclip not healthy after 90s."
  echo "  Debug: ssh $SSH_HOST 'cd $DEPLOY_DIR && docker compose logs --tail 30'"
  die "Health check timed out"
fi
ok "Paperclip is healthy at http://localhost:3100"

# ── onboard (create first admin user) ─────────────────────────────────────────

section "Step 9: Run Paperclip onboarding wizard"

CONTAINER_NAME=$(ssh "$SSH_HOST" "cd $DEPLOY_DIR && docker compose ps --format json 2>/dev/null | python3 -c \"import sys,json; [print(c.get('Name','')) for c in [json.loads(l) for l in sys.stdin] if 'paperclip' in c.get('Service','').lower()]\" 2>/dev/null | head -1 || echo ''")

if [[ -z "$CONTAINER_NAME" ]]; then
  CONTAINER_NAME="paperclip-deploy-server-1"
  warn "Could not detect container name — assuming: $CONTAINER_NAME"
fi

info "Container name: $CONTAINER_NAME"
echo ""
echo -e "  ${YELLOW}ACTION REQUIRED:${NC} Create the first admin account interactively."
echo ""
echo "  Run this command to complete setup:"
echo ""
echo -e "    ${CYAN}ssh $SSH_HOST \"docker exec -it $CONTAINER_NAME pnpm paperclipai onboard\"${NC}"
echo ""
echo "  This creates the admin user and initial company."
echo "  (If pnpm not available inside container, try: node /app/dist/cli onboard)"
echo ""

# ── done ─────────────────────────────────────────────────────────────────────

section "Done"

echo ""
echo -e "  ${GREEN}Paperclip is running at:${NC}"
echo "    https://$DOMAIN  (via Caddy HTTPS)"
echo "    http://localhost:3100  (internal, via SSH tunnel)"
echo ""
echo "  Container: $CONTAINER_NAME"
echo "  Deploy dir: $DEPLOY_DIR"
echo "  Logs: ssh $SSH_HOST 'cd $DEPLOY_DIR && docker compose logs -f'"
echo ""
echo -e "  ${CYAN}Next steps:${NC}"
echo "  1. Add SSH alias to ~/.ssh/config if not already done:"
echo "       Host <customer-slug>"
echo "         HostName <vps-ip>"
echo "         User root"
echo "  2. Run the onboard command above to create the admin user"
echo "  3. Note down: company UUID (from Paperclip Settings → General)"
echo "  4. Run: ./scripts/onboard-customer.sh <customer-slug>"
echo ""
echo "  Upgrade Paperclip later:"
echo "    ssh $SSH_HOST 'cd $DEPLOY_DIR && git pull && docker compose build && docker compose up -d'"
echo "    PC_PASSWORD=<pw> ./scripts/post-upgrade.sh <customer-slug>"
echo ""
