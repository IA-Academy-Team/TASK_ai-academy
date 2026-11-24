#!/usr/bin/env bash
# =============================================================================
#  Despliegue de Task Ai Academy en el VPS (vmi2746051).
#  Corre como `iaagent` dentro del clon del repo en el servidor:
#      /opt/services/tasks/centro-control/deploy/deploy.sh [git-ref]
#  Sin argumento despliega origin/main. Con un SHA hace rollback a ese commit.
#  Pasos: fetch -> checkout -> build -> migrate -> up -d -> health check.
#  Registra cada despliegue en deploy/.deploy-history (SHA anterior y nuevo).
# =============================================================================
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -f "$APP_DIR/docker-compose.production.yml")
HEALTH_URL="http://127.0.0.1:3012/health"
HEALTH_RETRIES=30
HISTORY="$APP_DIR/deploy/.deploy-history"
REF="${1:-origin/main}"

log() { printf '[%s] %s\n' "$(date -Is)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

cd "$APP_DIR"
[[ -f .env ]] || die "falta $APP_DIR/.env (copiar de deploy/production.env.example)"
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || die "el clon tiene cambios locales; revisar a mano"

exec 9>"$APP_DIR/deploy/.deploy.lock"
flock -n 9 || die "hay otro despliegue en curso"

previous="$(git rev-parse HEAD)"
git fetch --prune origin
target="$(git rev-parse --verify "$REF^{commit}")" || die "ref inválida: $REF"
log "anterior=${previous:0:10} objetivo=${target:0:10}"

git checkout --detach "$target"

log "build de la imagen"
"${COMPOSE[@]}" build app

log "migraciones (drizzle-kit migrate)"
"${COMPOSE[@]}" up -d --wait db
"${COMPOSE[@]}" run --rm -v "$APP_DIR/src:/app/src:ro" app npx drizzle-kit migrate

log "levantando app"
"${COMPOSE[@]}" up -d app

for ((i = 1; i <= HEALTH_RETRIES; i++)); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    printf '%s %s -> %s ok\n' "$(date -Is)" "$previous" "$target" >>"$HISTORY"
    log "desplegado ${target:0:10} (health OK)"
    exit 0
  fi
  sleep 2
done

printf '%s %s -> %s FALLO_HEALTH\n' "$(date -Is)" "$previous" "$target" >>"$HISTORY"
die "health check falló; rollback: deploy/deploy.sh $previous"
