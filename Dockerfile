# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# E-Vigilance - single image serving the API and the built PWA on one origin.
#
#   docker build -t e-vigilance .
#   docker run --env-file server/.env -p 5050:5050 e-vigilance
# ---------------------------------------------------------------------------

# 1. Build the PWA -----------------------------------------------------------
FROM node:22-alpine AS web-build
WORKDIR /app/web

# Install with the lockfile first so this layer caches across source edits.
COPY web/package.json web/package-lock.json ./
RUN npm ci

COPY web/ ./
RUN npm run build


# 2. Production dependencies for the API -------------------------------------
FROM node:22-alpine AS server-deps
WORKDIR /app/server

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force


# 3. Runtime image -----------------------------------------------------------
FROM node:22-alpine AS runtime

# tini reaps zombies and forwards signals, so the container stops cleanly.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=5050

WORKDIR /app

COPY --chown=node:node server/server.js ./server/server.js
COPY --chown=node:node server/package.json ./server/package.json
COPY --chown=node:node server/src ./server/src
COPY --from=server-deps --chown=node:node /app/server/node_modules ./server/node_modules

# server.js serves ../web/dist when it exists, giving one origin for API + PWA.
COPY --from=web-build --chown=node:node /app/web/dist ./web/dist

USER node
WORKDIR /app/server

EXPOSE 5050

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5050)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
