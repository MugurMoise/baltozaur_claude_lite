#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  exit 0
fi

blocked=0

for file in "$@"; do
  [ -f "$file" ] || continue

  case "$(basename "$file")" in
    20260517000200_add_prod_contact_and_rain_fields.sql|\
    20260517000700_remove_duplicate_corata.sql|\
    20260517000900_import_popular_romanian_lakes.sql|\
    push_subscriptions.sql)
      continue
      ;;
  esac

  if ! grep -Eiq '\bdev_' "$file"; then
    echo "::error file=$file::Dev-branch migrations must target dev_* tables/views."
    blocked=1
  fi

  if grep -Eiq '\b(create|alter|drop|truncate)\s+(table|view)?\s*(if\s+(not\s+)?exists\s+)?(public\.)?(lakes|lake_scores|latest_lake_scores|push_subscriptions)\b' "$file"; then
    echo "::error file=$file::Dev-branch migrations must not create/alter/drop/truncate production tables/views."
    blocked=1
  fi

  if grep -Eiq '\b(insert\s+into|update|delete\s+from)\s+(public\.)?(lakes|lake_scores|latest_lake_scores|push_subscriptions)\b' "$file"; then
    echo "::error file=$file::Dev-branch migrations must not write production tables."
    blocked=1
  fi
done

exit "$blocked"
