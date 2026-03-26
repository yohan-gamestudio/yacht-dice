#!/bin/sh
# Start game server in background
pnpm --filter server start &

# Start Next.js production server on 0.0.0.0
pnpm --filter web start -- -H 0.0.0.0 -p 3000
