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

VPS_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Deploy concluído!                                      ║"
echo "║                                                         ║"
echo "║  Acesse: http://$VPS_IP                                 ║"
echo "║                                                         ║"
echo "║  Logs: cd /opt/beacon &&                                ║"
echo "║    docker compose -f docker-compose.prod.yml logs -f    ║"
echo "║                                                         ║"
echo "║  Quando tiver domínio, atualize o docker-compose.prod   ║"
echo "║  para usar Traefik com HTTPS.                           ║"
echo "╚══════════════════════════════════════════════════════════╝"
