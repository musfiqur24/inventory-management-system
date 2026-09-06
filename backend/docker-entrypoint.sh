#!/bin/sh
set -eu

# This project currently has no committed Prisma migrations. Apply schema changes
# before starting so a new Compose database is ready to use.
npx prisma db push

exec node dist/server.js
