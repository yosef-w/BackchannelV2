#!/usr/bin/env bash
# Final residual-literal sweep across the giant screen files. Run after
# scripts/migrate-colors.sh has already done the first pass — this picks up
# the long tail (status colours, light surface variants, faint text greys,
# placeholderTextColor patterns).
#
# Usage: scripts/sweep-residuals.sh path/to/File.tsx [more.tsx ...]

set -euo pipefail

for FILE in "$@"; do
  if [ ! -f "$FILE" ]; then
    echo "skip: $FILE not found" >&2
    continue
  fi

  # JSX prop contexts
  sed -i '' \
    -e 's/color="#AAA"/color={tokens.colors.textFaint}/g' \
    -e 's/color="#BBB"/color={tokens.colors.textFaint}/g' \
    -e 's/color="#CCC"/color={tokens.colors.textFaint}/g' \
    -e 's/color="#DDD"/color={tokens.colors.textFaint}/g' \
    -e 's/color="#999"/color={tokens.colors.textMuted}/g' \
    -e 's/color="#666"/color={tokens.colors.textBody}/g' \
    -e 's/color="#374151"/color={tokens.colors.textBody}/g' \
    -e 's/color="#DC2626"/color={tokens.colors.dangerFg}/g' \
    -e 's/color="#00CB54"/color={tokens.colors.successFg}/g' \
    -e 's/placeholderTextColor="#999"/placeholderTextColor={tokens.colors.textFaint}/g' \
    -e 's/placeholderTextColor="#BBB"/placeholderTextColor={tokens.colors.textFaint}/g' \
    -e 's/placeholderTextColor="#AAA"/placeholderTextColor={tokens.colors.textFaint}/g' \
    -e 's/placeholderTextColor="#CCC"/placeholderTextColor={tokens.colors.textFaint}/g' \
    -e 's/placeholderTextColor="#666"/placeholderTextColor={tokens.colors.textMuted}/g' \
    -e 's/fill="#DC2626"/fill={tokens.colors.dangerFg}/g' \
    -e 's/fill="#00CB54"/fill={tokens.colors.successFg}/g' \
    "$FILE"

  # Style-key contexts — status colours
  sed -i '' \
    -e 's/: "#DC2626"/: tokens.colors.dangerFg/g' \
    -e 's/: "#FEF2F2"/: tokens.colors.dangerBg/g' \
    -e 's/: "#FECACA"/: tokens.colors.dangerBorder/g' \
    -e 's/: "#F0FFF4"/: tokens.colors.successBg/g' \
    -e 's/: "#E8FBEF"/: tokens.colors.successBg/g' \
    -e 's/: "#00CB54"/: tokens.colors.successFg/g' \
    "$FILE"

  # Style-key contexts — neutrals (carefully scoped so JSX prop contexts
  # already handled above don't double-match)
  sed -i '' \
    -e 's/color: "#AAA"/color: tokens.colors.textFaint/g' \
    -e 's/color: "#BBB"/color: tokens.colors.textFaint/g' \
    -e 's/color: "#CCC"/color: tokens.colors.textFaint/g' \
    -e 's/color: "#DDD"/color: tokens.colors.textFaint/g' \
    -e 's/color: "#999"/color: tokens.colors.textMuted/g' \
    -e 's/color: "#666"/color: tokens.colors.textBody/g' \
    -e 's/color: "#374151"/color: tokens.colors.textBody/g' \
    -e 's/backgroundColor: "#F3F4F6"/backgroundColor: tokens.colors.bgSurface/g' \
    -e 's/backgroundColor: "#F8F9FA"/backgroundColor: tokens.colors.bgOffWhite/g' \
    -e 's/backgroundColor: "#F5F6F8"/backgroundColor: tokens.colors.bgOffWhite/g' \
    -e 's/backgroundColor: "#F4F4F5"/backgroundColor: tokens.colors.bgSurface/g' \
    -e 's/backgroundColor: "#EEEEEE"/backgroundColor: tokens.colors.border/g' \
    -e 's/backgroundColor: "#ECECEC"/backgroundColor: tokens.colors.border/g' \
    -e 's/backgroundColor: "#EFEFEF"/backgroundColor: tokens.colors.border/g' \
    -e 's/backgroundColor: "#E0E0E0"/backgroundColor: tokens.colors.borderStrong/g' \
    -e 's/borderColor: "#F3F4F6"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#F8F9FA"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#F4F4F5"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#E5E7EB"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#E0E0E0"/borderColor: tokens.colors.borderStrong/g' \
    -e 's/borderColor: "#D1D5DB"/borderColor: tokens.colors.borderStrong/g' \
    -e 's/borderColor: "#EEEEEE"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#ECECEC"/borderColor: tokens.colors.border/g' \
    -e 's/borderColor: "#EFEFEF"/borderColor: tokens.colors.border/g' \
    "$FILE"

  echo "swept: $FILE"
done
