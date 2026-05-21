#!/bin/bash
# Sync personal Claude Code skills from this repo into the cloud session's
# ~/.claude/skills/ so they survive the ephemeral container. Local PC sessions
# don't need this — skills already persist there. No-op outside Claude Code on
# the web.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

src_dir="${CLAUDE_PROJECT_DIR:-.}/claude-skills"
dest_dir="${HOME}/.claude/skills"

if [ ! -d "$src_dir" ]; then
  exit 0
fi

mkdir -p "$dest_dir"

# Copy every skill folder under claude-skills/. Overwrite-in-place is
# idempotent: re-running just refreshes the files. We never delete from the
# destination — other personal skills the user has set up elsewhere stay put.
for skill in "$src_dir"/*/; do
  [ -d "$skill" ] || continue
  name="$(basename "$skill")"
  mkdir -p "$dest_dir/$name"
  cp -r "$skill"/. "$dest_dir/$name/"
done
