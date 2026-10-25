# syntax=docker/dockerfile:1
# One image per Corex app (SPEC.md 12, step 12). Build from the repository root:
#   docker build --build-arg APP=clinic \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
#     --build-arg NEXT_PUBLIC_DB_SCHEMA=client_x --build-arg NEXT_PUBLIC_STORAGE_BUCKET=client_x \
#     -t corex-clinic .
# APP is web, school, clinic or finance. NEXT_PUBLIC_ values are fixed at build time;
# server-only settings (SUPABASE_SERVICE_ROLE_KEY, DB_SCHEMA, EDITION, DEMO_MODE, ...)
# are passed when the container starts. See docs/deploy.md.

ARG NODE_VERSION=22.22.0

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS build
ARG APP
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_DB_SCHEMA
ARG NEXT_PUBLIC_STORAGE_BUCKET
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_ROOT_DOMAIN
# Behind an HTTP proxy, also pass --build-arg HTTPS_PROXY=... --build-arg NODE_USE_ENV_PROXY=1
# so the build can download the web fonts.
ARG NODE_USE_ENV_PROXY
RUN test -n "$APP" || (echo "Pass --build-arg APP=web|school|clinic|finance" && exit 1)
COPY . .
# Behind a proxy with its own certificate authority, pass it with
# --secret id=extra_ca,src=/path/to/ca.pem (used for downloads only, not kept in the image).
RUN --mount=type=secret,id=extra_ca,required=false \
  if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi \
  && pnpm install --frozen-lockfile --filter "@corex/${APP}..."
RUN --mount=type=secret,id=extra_ca,required=false \
  if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi \
  && NEXT_OUTPUT=standalone pnpm --filter "@corex/${APP}" build \
  && mkdir -p /out \
  && cp -r "apps/${APP}/.next/standalone/." /out/ \
  && cp -r "apps/${APP}/.next/static" "/out/apps/${APP}/.next/static" \
  && if [ -d "apps/${APP}/public" ]; then cp -r "apps/${APP}/public" "/out/apps/${APP}/public"; fi

FROM node:${NODE_VERSION}-alpine AS run
ARG APP
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 APP=${APP}
WORKDIR /app
RUN addgroup -S corex && adduser -S corex -G corex
COPY --from=build --chown=corex:corex /out ./
USER corex
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/login" || wget -q -O /dev/null "http://127.0.0.1:${PORT}/" || exit 1
CMD ["sh", "-c", "exec node apps/${APP}/server.js"]
