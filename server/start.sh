#!/bin/sh
# Start Redis server in the background
redis-server --daemonize yes

# Start background worker
node worker.js &

# Start main Express API server
node index.js
