#!/bin/sh
set -e

echo "📦 Running Prisma generate"

# Print current directory
echo "📂 Current directory: $(pwd)"
echo "📂 Directory contents:"
ls -la

# Print node_modules/.prisma directory
echo "📂 Checking .prisma directory:"
ls -la node_modules/.prisma/ || echo "⚠️ .prisma directory not found"
ls -la node_modules/.prisma/client/ 2>/dev/null || echo "⚠️ .prisma/client directory not found"

# Print prisma directory
echo "📂 Checking prisma directory:"
ls -la prisma/ || echo "⚠️ prisma directory not found"

# Print src directory
echo "📂 Checking src directory:"
ls -la src/ || echo "⚠️ src directory not found"

bunx prisma generate

# Check again after prisma generate
echo "📂 After prisma generate - Checking .prisma directory:"
ls -la node_modules/.prisma/ 2>/dev/null || echo "⚠️ .prisma directory not found after generate"
ls -la node_modules/.prisma/client/ 2>/dev/null || echo "⚠️ .prisma/client directory not found after generate"

echo "🗄️ Running database migrations"
bunx prisma migrate deploy

# echo "🌱 Running database seed"
# bunx prisma db seed || echo "⚠️ Seed skipped (already seeded)"

# Print final directory structure before starting
echo "📂 Final directory structure:"
ls -la
echo "📂 dist directory:"
ls -la dist/ 2>/dev/null || echo "⚠️ dist directory not found"

echo "🚀 Starting app"
exec bun run start
