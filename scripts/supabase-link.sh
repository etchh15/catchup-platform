#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI not found. Install it from https://supabase.com/docs/guides/cli"
  exit 1
fi

PROJECT_REF="kwqaqotwqsfivbpljfnt"

echo "Linking local project to Supabase project ${PROJECT_REF}..."
supabase link --project-ref "$PROJECT_REF"

echo "Supabase link completed successfully."
