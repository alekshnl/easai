#!/bin/bash

PID_FILE=".easai.pid"
LOG_FILE=".easai.log"
WORKER_PID_FILE=".easai-worker.pid"
WORKER_LOG_FILE=".easai-worker.log"
PORT=3000

# Check if already running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    echo "easai draait al (PID $PID) op http://localhost:$PORT"
    exit 0
  else
    rm -f "$PID_FILE"
  fi
fi

echo "easai starten..."

# Start dev server in background
pnpm dev > "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"

# Start background chat worker
pnpm worker:chat > "$WORKER_LOG_FILE" 2>&1 &
WORKER_PID=$!
echo $WORKER_PID > "$WORKER_PID_FILE"

# Wait until the server is ready
for i in $(seq 1 20); do
  sleep 0.5
  if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    echo "easai draait op http://localhost:$PORT (web PID $PID, worker PID $WORKER_PID)"
    open "http://localhost:$PORT"
    exit 0
  fi
done

echo "easai gestart (web PID $PID, worker PID $WORKER_PID) — wacht op http://localhost:$PORT"
echo "Logs: tail -f $LOG_FILE | tail -f $WORKER_LOG_FILE"
