#!/bin/bash

PID_FILE=".easai.pid"
WORKER_PID_FILE=".easai-worker.pid"

# Kill any process holding port 1455 (OAuth callback server)
AUTH_PID=$(lsof -ti tcp:1455 2>/dev/null)
if [ -n "$AUTH_PID" ]; then
  kill -9 $AUTH_PID 2>/dev/null
  echo "Auth server op poort 1455 gestopt (PID $AUTH_PID)"
fi

if [ ! -f "$PID_FILE" ]; then
  echo "Geen PID-bestand gevonden — easai lijkt niet te draaien."
else
  PID=$(cat "$PID_FILE")

  if kill -0 "$PID" 2>/dev/null; then
    kill "$PID"
    rm -f "$PID_FILE"
    echo "easai web gestopt (PID $PID)"
  else
    echo "Web proces $PID bestaat niet meer."
    rm -f "$PID_FILE"
  fi
fi

if [ -f "$WORKER_PID_FILE" ]; then
  WORKER_PID=$(cat "$WORKER_PID_FILE")
  if kill -0 "$WORKER_PID" 2>/dev/null; then
    kill "$WORKER_PID"
    echo "easai worker gestopt (PID $WORKER_PID)"
  else
    echo "Worker proces $WORKER_PID bestaat niet meer."
  fi
  rm -f "$WORKER_PID_FILE"
fi
