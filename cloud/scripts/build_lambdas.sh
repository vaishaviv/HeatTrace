#!/usr/bin/env bash
# Package each Lambda with cloud/shared/ into cloud/dist/<name>.zip for console upload.
# boto3 is provided by the Lambda Python runtime, so no dependencies are bundled.
#
#   cloud/scripts/build_lambdas.sh                 # all four
#   cloud/scripts/build_lambdas.sh process_reading # just one
set -euo pipefail

CLOUD="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$CLOUD/dist"
PY="${PYTHON:-python3}"
mkdir -p "$DIST"

names=("$@")
if [ ${#names[@]} -eq 0 ]; then
  names=(process_reading ack_handler fetch_wind escalate)
fi

for name in "${names[@]}"; do
  src="$CLOUD/lambdas/$name"
  [ -f "$src/handler.py" ] || { echo "no such lambda: $name" >&2; exit 1; }
  stage="$(mktemp -d)"
  cp "$src/handler.py" "$stage/"
  mkdir -p "$stage/shared"
  cp "$CLOUD"/shared/*.py "$stage/shared/"
  rm -f "$DIST/$name.zip"
  (cd "$stage" && "$PY" -m zipfile -c "$DIST/$name.zip" handler.py shared)
  rm -rf "$stage"
  echo "built $DIST/$name.zip  (handler: handler.handler)"
done
