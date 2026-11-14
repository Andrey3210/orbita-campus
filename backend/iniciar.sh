#!/bin/sh
set -eu

java -jar /app/campus.jar --server.address=127.0.0.1 --server.port=8081 &
java_pid=$!
caddy run --config /app/Caddyfile --adapter caddyfile &
caddy_pid=$!

detener() {
    kill "$java_pid" "$caddy_pid" 2>/dev/null || true
    wait "$java_pid" 2>/dev/null || true
    wait "$caddy_pid" 2>/dev/null || true
}
trap 'detener; exit 0' TERM INT
while kill -0 "$java_pid" 2>/dev/null && kill -0 "$caddy_pid" 2>/dev/null; do
    sleep 1
done
detener
exit 1
