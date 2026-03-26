#!/bin/sh
# Start game server in background (port 3001)
pnpm --filter server start &

# Wait for server to bind port before starting Next.js
sleep 2

# Start Next.js production server (port 3000)
pnpm --filter web start
