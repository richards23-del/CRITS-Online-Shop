FROM node:22-bookworm-slim AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.18.3 --activate
COPY . .
RUN pnpm install --frozen-lockfile

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
RUN pnpm run build

FROM build AS migrator
CMD ["pnpm", "--filter", "@workspace/db", "run", "migrate"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    PORT=8080 \
    SERVE_WEB=true \
    WEB_DIST_DIR=/app/public \
    MEDIA_DIR=/var/lib/crits/media

WORKDIR /app
COPY --from=build --chown=node:node /workspace/artifacts/api-server/dist/ ./
COPY --from=build --chown=node:node /workspace/artifacts/crits-shop/dist/public ./public
RUN mkdir -p /var/lib/crits/media && chown -R node:node /var/lib/crits

USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/healthz').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "--enable-source-maps", "./index.mjs"]
