#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BIN_DIR="${HOME}/.local/bin"
TARGET="$BIN_DIR/review-tour"
SOURCE="$ROOT_DIR/bin/review-tour.js"

mkdir -p "$BIN_DIR"
if [ -e "$TARGET" ] && [ ! -L "$TARGET" ]; then
  printf 'Refusing to replace existing non-symlink: %s\n' "$TARGET" >&2
  exit 1
fi

chmod +x "$SOURCE"
ln -sfn "$SOURCE" "$TARGET"

printf 'Installed review-tour -> %s/review-tour\n' "$BIN_DIR"
