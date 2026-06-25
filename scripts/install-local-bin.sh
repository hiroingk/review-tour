#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BIN_DIR="${HOME}/.local/bin"
TARGET="$BIN_DIR/review-tour"
SOURCE="$ROOT_DIR/bin/review-tour"

mkdir -p "$BIN_DIR"
if [ -e "$TARGET" ] && [ ! -L "$TARGET" ]; then
  printf 'Refusing to replace existing non-symlink: %s\n' "$TARGET" >&2
  exit 1
fi

ln -sfn "$SOURCE" "$TARGET"

printf 'Installed review-tour -> %s/review-tour\n' "$BIN_DIR"
if command -v review-tour >/dev/null 2>&1; then
  printf 'Resolved review-tour at %s\n' "$(command -v review-tour)"
else
  printf 'Add %s to PATH before using review-tour from other repositories.\n' "$BIN_DIR" >&2
fi
