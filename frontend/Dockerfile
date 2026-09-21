# ════════════════════════════════════════════════════════════
#  ConnectBé — Frontend
#  Deux cibles :
#    • dev   → serveur Vite + HMR (docker-compose.dev.yml)
#    • prod  → build statique servi par nginx (cible par défaut)
# ════════════════════════════════════════════════════════════

# ── Base commune : dépendances npm ──────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

# ── Cible dev : serveur Vite ────────────────────────────────
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# ── Build de production ─────────────────────────────────────
# Les variables VITE_* sont injectées à la COMPILATION (Vite les
# inline dans le bundle). Les passer en `environment:` n'a aucun
# effet ici : il faut des build args.
FROM deps AS build
ARG VITE_CARTO_API_KEY=""
ARG VITE_HOTEL_LAT=""
ARG VITE_HOTEL_LNG=""
ARG VITE_HOTEL_NAME=""
ARG VITE_IDLE_TIMEOUT_MS=""
ENV VITE_CARTO_API_KEY=$VITE_CARTO_API_KEY \
    VITE_HOTEL_LAT=$VITE_HOTEL_LAT \
    VITE_HOTEL_LNG=$VITE_HOTEL_LNG \
    VITE_HOTEL_NAME=$VITE_HOTEL_NAME \
    VITE_IDLE_TIMEOUT_MS=$VITE_IDLE_TIMEOUT_MS
COPY . .
RUN npm run build

# ── Cible prod : nginx sert dist/ et proxifie l'API ─────────
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
