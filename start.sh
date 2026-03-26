#!/bin/sh
# Start game server in background
pnpm --filter server start &

# Start Next.js production server
pnpm --filter web start
