#!/usr/bin/env bash
# Usage: retry.sh <attempts> <command...>
# Re-runs the command with a growing pause (20 s, 40 s, ...) until it succeeds.
set -uo pipefail

attempts=$1
shift

for ((attempt = 1; attempt <= attempts; attempt++)); do
  if "$@"; then
    exit 0
  fi
  if ((attempt < attempts)); then
    echo "::warning::attempt $attempt of $attempts failed; retrying in $((attempt * 20)) s"
    sleep $((attempt * 20))
  fi
done

echo "::error::all $attempts attempts failed"
exit 1
