#!/bin/sh
set -e

echo "🗄️ Running database migrations"
bun ./node_modules/prisma/build/index.js migrate deploy

echo "🌱 Running database seed"
bun ./node_modules/prisma/build/index.js db seed || echo "⚠️ Seed skipped (already seeded)"

echo "🚀 Starting app"
exec bun run start

