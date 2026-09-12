#!/bin/sh
set -eu

# Apply the Prisma schema before starting so the configured database is ready.
node prisma/upgrade-stores.mjs
npx prisma db push
node prisma/upgrade-stores.mjs --history

exec node dist/server.js
