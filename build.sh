#!/bin/bash
# Package extension zip for Chrome Web Store / Edge Add-ons / Firefox AMO.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VERSION=$(grep '"version"' "$SCRIPT_DIR/extension/manifest.json" | head -1 | sed 's/.*: *"\(.*\)".*/\1/')

ZIP="$SCRIPT_DIR/chatgpt-code-wrap-v$VERSION.zip"
cd "$SCRIPT_DIR/extension"
zip -r "$ZIP" . -x ".*"
echo "Packaged $ZIP (v$VERSION)"
