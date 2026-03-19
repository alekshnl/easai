#!/bin/bash

PID_FILE=".easai.pid"

# Kill any process holding port 1455 (OAuth callback server)
AUTH_PID=$(lsof -ti tcp:1455 2>/dev/null)
if [ -n "$AUTH_PID" ]; then
  kill -9 $AUTH_PID 2>/dev/null
  echo "Auth server op poort 1455 gestopt (PID $AUTH_PID)"
fi

if [ ! -f "$PID_FILE" ]; then
  echo "Geen PID-bestand gevonden — easai lijkt niet te draaien."
  exit 0
fi

PID=$(cat "$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
  kill "$PID"
  rm -f "$PID_FILE"
  echo "easai gestopt (PID $PID)"
else
  echo "Proces $PID bestaat niet meer."
  rm -f "$PID_FILE"
fi
