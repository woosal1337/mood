#!/usr/bin/env bash
# Pushes public/media to the R2 bucket behind media.chele.bi.
#
#     npm run media:push
#
# Needs rclone and four variables. Keep them out of this repo — read them from
# your secret store and export them for the one command:
#
#     R2_ACCOUNT_ID  R2_ACCESS_KEY_ID  R2_SECRET_ACCESS_KEY  R2_BUCKET
#
# The copy is incremental, so re-running after adding a few images moves only
# those images.
set -euo pipefail

: "${R2_ACCOUNT_ID:?set R2_ACCOUNT_ID}"
: "${R2_ACCESS_KEY_ID:?set R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?set R2_SECRET_ACCESS_KEY}"
BUCKET="${R2_BUCKET:-mood-media}"

cd "$(dirname "$0")/.."

export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true

echo "▸ pushing public/media → r2:${BUCKET}/media"
rclone copy public/media "r2:${BUCKET}/media" \
  --transfers 48 --checkers 48 --s3-chunk-size 16M \
  --stats 20s --stats-one-line

echo "▸ verifying"
rclone check public/media "r2:${BUCKET}/media" --size-only --one-way 2>&1 | tail -2
