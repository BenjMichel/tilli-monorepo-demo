# syntax=docker/dockerfile:1

# Build: install the workspace packages the API needs, then bundle it into a single file.
FROM node:24-slim AS build
RUN npm install --global pnpm@12.4.2
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@tilli/api..." \
  && pnpm --filter @tilli/api build

# Runtime: distroless Node (no shell, no package manager) and one JavaScript file, as a non-root user.
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS runtime
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=8080
WORKDIR /app
COPY --from=build /repo/apps/api/dist/server.mjs ./server.mjs
USER nonroot
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["server.mjs"]
