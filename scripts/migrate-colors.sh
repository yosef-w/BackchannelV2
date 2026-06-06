#!/usr/bin/env bash
# Bulk colour-literal → tokens.colors.* migration for the giant screen files.
#
# Usage: scripts/migrate-colors.sh path/to/File.tsx [more.tsx ...]
#
# Adds `import { tokens } from "@/constants/theme";` after the last existing
# import line, then runs pattern-aware sed substitutions for the most common
# colour literals in BackChannel screens. JSX prop contexts (color="#000")
# and style contexts (color: "#000") are handled separately.
#
# Run after committing so you can review the diff per file.

set -euo pipefail

for FILE in "$@"; do
  if [ ! -f "$FILE" ]; then
    echo "skip: $FILE not found" >&2
    continue
  fi

  # Add tokens import if not already present
  if ! grep -q 'from "@/constants/theme"' "$FILE"; then
    # Insert after the last import block. Use a marker: find the line number of
    # the LAST `from "...";` line in the first 200 lines and insert below it.
    LAST_IMPORT=$(grep -nE '^from |^import |^} from ' "$FILE" | head -200 | tail -1 | cut -d: -f1)
    if [ -n "$LAST_IMPORT" ]; then
      sed -i '' "${LAST_IMPORT}a\\
import { tokens } from \"@/constants/theme\";
" "$FILE"
    fi
  fi

  # JSX prop contexts
  sed -i '' \
    -e 's/color="#000"/color={tokens.colors.text}/g' \
    -e 's/color="#000000"/color={tokens.colors.text}/g' \
    -e 's/color="#FFF"/color={tokens.colors.brandText}/g' \
    -e 's/color="#FFFFFF"/color={tokens.colors.brandText}/g' \
    -e 's/color="#666"/color={tokens.colors.textBody}/g' \
    -e 's/color="#999"/color={tokens.colors.textMuted}/g' \
    -e 's/color="#444"/color={tokens.colors.textBody}/g' \
    -e 's/color="#555"/color={tokens.colors.textBody}/g' \
    -e 's/color="#888"/color={tokens.colors.textMuted}/g' \
    -e 's/color="#777"/color={tokens.colors.textMuted}/g' \
    -e 's/color="#333"/color={tokens.colors.text}/g' \
    -e 's/color="#222"/color={tokens.colors.text}/g' \
    -e 's/color="#111"/color={tokens.colors.text}/g' \
    -e 's/color="#BBB"/color={tokens.colors.textFaint}/g' \
    -e 's/color="#CCC"/color={tokens.colors.textFaint}/g' \
    -e 's/fill="#FFF"/fill={tokens.colors.brandText}/g' \
    -e 's/fill="#FFFFFF"/fill={tokens.colors.brandText}/g' \
    -e 's/fill="#000"/fill={tokens.colors.text}/g' \
    "$FILE"

  # Style-key contexts
  sed -i '' \
    -e 's/color: "#000"/color: tokens.colors.text/g' \
    -e 's/color: "#000000"/color: tokens.colors.text/g' \
    -e 's/color: "#FFF"/color: tokens.colors.brandText/g' \
    -e 's/color: "#FFFFFF"/color: tokens.colors.brandText/g' \
    -e 's/color: "#1A1A1A"/color: tokens.colors.text/g' \
    -e 's/color: "#666"/color: tokens.colors.textBody/g' \
    -e 's/color: "#999"/color: tokens.colors.textMuted/g' \
    -e 's/color: "#444"/color: tokens.colors.textBody/g' \
    -e 's/color: "#555"/color: tokens.colors.textBody/g' \
    -e 's/color: "#888"/color: tokens.colors.textMuted/g' \
    -e 's/color: "#777"/color: tokens.colors.textMuted/g' \
    -e 's/color: "#333"/color: tokens.colors.text/g' \
    -e 's/color: "#222"/color: tokens.colors.text/g' \
    -e 's/color: "#111"/color: tokens.colors.text/g' \
    -e 's/color: "#BBB"/color: tokens.colors.textFaint/g' \
    -e 's/color: "#CCC"/color: tokens.colors.textFaint/g' \
    -e 's/backgroundColor: "#000"/backgroundColor: tokens.colors.brand/g' \
    -e 's/backgroundColor: "#000000"/backgroundColor: tokens.colors.brand/g' \
    -e 's/backgroundColor: "#1A1A1A"/backgroundColor: tokens.colors.brand/g' \
    -e 's/backgroundColor: "#0F0F11"/backgroundColor: tokens.colors.brand/g' \
    -e 's/backgroundColor: "#FFF"/backgroundColor: tokens.colors.bg/g' \
    -e 's/backgroundColor: "#FFFFFF"/backgroundColor: tokens.colors.bg/g' \
    -e 's/backgroundColor: "#FAFAFA"/backgroundColor: tokens.colors.bgOffWhite/g' \
    -e 's/backgroundColor: "#FBFBFB"/backgroundColor: tokens.colors.bgOffWhite/g' \
    -e 's/backgroundColor: "#F9F9F9"/backgroundColor: tokens.colors.bgOffWhite/g' \
    -e 's/backgroundColor: "#F8F9FB"/backgroundColor: tokens.colors.bgOffWhite/g' \
    -e 's/backgroundColor: "#F4F4F5"/backgroundColor: tokens.colors.bgSurface/g' \
    -e 's/backgroundColor: "#F5F5F5"/backgroundColor: tokens.colors.bgSurface/g' \
    -e 's/backgroundColor: "#F6F6F6"/backgroundColor: tokens.colors.bgSurface/g' \
    -e 's/backgroundColor: "#F2F2F2"/backgroundColor: tokens.colors.bgSurface/g' \
    -e 's/backgroundColor: "#EFEFEF"/backgroundColor: tokens.colors.bgSurface/g' \
    -e 's/backgroundColor: "#EBEBEB"/backgroundColor: tokens.colors.bgSurface/g' \
    -e 's/backgroundColor: "#EAEAEA"/backgroundColor: tokens.colors.bgSurface/g' \
    -e 's/backgroundColor: "#F0F0F0"/backgroundColor: tokens.colors.border/g' \
    -e 's/backgroundColor: "#E8E8E8"/backgroundColor: tokens.colors.border/g' \
    -e 's/backgroundColor: "#E5E5E5"/backgroundColor: tokens.colors.border/g' \
    -e 's/backgroundColor: "#EEE"/backgroundColor: tokens.colors.border/g' \
    -e 's/borderColor: "#000"/borderColor: tokens.colors.brand/g' \
    -e 's/borderColor: "#000000"/borderColor: tokens.colors.brand/g' \
    -e 's/borderColor: "#F0F0F0"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#E8E8E8"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#E5E5E5"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#EEE"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#EFEFEF"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#EBEBEB"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#EAEAEA"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#E0E0E0"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#D9D9D9"/borderColor: tokens.colors.borderStrong/g' \
    -e 's/borderColor: "#D0D0D0"/borderColor: tokens.colors.borderStrong/g' \
    -e 's/borderColor: "#C0C0C0"/borderColor: tokens.colors.borderStrong/g' \
    -e 's/borderColor: "#F5F5F5"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#F4F4F5"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#FFF"/borderColor: tokens.colors.bg/g' \
    -e 's/borderColor: "#DC2626"/borderColor: tokens.colors.dangerFg/g' \
    -e 's/shadowColor: "#000"/shadowColor: tokens.colors.brand/g' \
    "$FILE"

  echo "migrated: $FILE"
done
