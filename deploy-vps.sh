#!/bin/bash
# ============================================================
# Deploy Carolina Beacon — VPS com Docker
# Executar como root na VPS: bash deploy-vps.sh
# ============================================================

set -e

APP_DIR="/opt/beacon"
REPO="https://github.com/juliocaldeiraa/carolina-beacon-main.git"

echo "=== 1. Verificando pré-requisitos ==="
docker --version || { echo "Docker não instalado!"; exit 1; }
docker compose version 2>/dev/null || { echo "Docker Compose v2 não encontrado!"; exit 1; }

echo "=== 2. Clonando/atualizando repositório ==="
if [ -d "$APP_DIR" ]; then
  echo "Diretório $APP_DIR já existe — atualizando..."
  cd "$APP_DIR"
  git pull origin main
else
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "=== 3. Configurando .env.production ==="
ENV_FILE="$APP_DIR/apps/backend/.env.production"
if [ ! -f "$ENV_FILE" ]; then
  cp "$APP_DIR/apps/backend/.env.production.example" "$ENV_FILE"
  echo ""
  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║  ATENÇÃO: Edite o .env.production antes de continuar!   ║"
  echo "║                                                         ║"
  echo "║  nano $ENV_FILE   ║"
  echo "║                                                         ║"
  echo "║  Preencha: DATABASE_URL, REDIS_URL, JWT_SECRET,         ║"
  echo "║  JWT_REFRESH_SECRET, DEFAULT_TENANT_ID                  ║"
  echo "║                                                         ║"
  echo "║  Depois rode: bash deploy-vps.sh                        ║"
  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""
  exit 0
else
  echo ".env.production já existe — mantendo."
fi

echo "=== 4. Build das imagens ==="
docker compose -f docker-compose.prod.yml build --no-cache

echo "=== 5. Subindo containers ==="
docker compose -f docker-compose.prod.yml down 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d

echo "=== 6. Verificando ==="
sleep 5
docker compose -f docker-compose.prod.yml ps

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Deploy concluído!                                      ║"
echo "║                                                         ║"
echo "║  Acesse: https://beacon.escolatocha.com.br              ║"
echo "║                                                         ║"
echo "║  Logs:   docker compose -f docker-compose.prod.yml logs ║"
echo "║  Certs:  docker compose -f docker-compose.prod.yml \\    ║"
echo "║          logs traefik | grep -i acme                    ║"
echo "║                                                         ║"
echo "║  Firewall: portas 80 e 443 abertas (Let's Encrypt       ║"
echo "║  exige 80 pra HTTP-01 challenge).                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
