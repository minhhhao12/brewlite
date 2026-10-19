#!/bin/sh
set -eu

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo '{"level":"info","service":"brewlite-api","message":"running prisma migrate deploy"}'
  ./apps/api/node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
fi

exec node apps/api/dist/main.js
