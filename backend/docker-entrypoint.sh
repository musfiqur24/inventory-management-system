#!/bin/sh
set -eu

# Apply the Prisma schema before starting so the configured database is ready.
npx prisma db push

exec node dist/server.js
