#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
web_dir="$repo_dir/artifacts/google-signin"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
cd "$repo_dir"
# Match Vite's deduplication; shared workspace hooks must use the same
# React and QueryClient context as the test's renderer/provider.
pnpm --filter @workspace/api-server exec esbuild "$web_dir"/tests/*.test.tsx \
  --bundle --platform=node --format=cjs --jsx=automatic \
  --alias:react="$(realpath "$web_dir/node_modules/react")" \
  --alias:react-dom="$(realpath "$web_dir/node_modules/react-dom")" \
  --alias:@tanstack/react-query="$(realpath "$web_dir/node_modules/@tanstack/react-query")" \
  --outdir="$tmp_dir" --out-extension:.js=.cjs
node --test "$tmp_dir"/*.cjs
