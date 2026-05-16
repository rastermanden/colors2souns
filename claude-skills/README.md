# claude-skills

Personal Claude Code skills checked in here so they can be installed on any
machine (cloud session, laptop, etc.) without re-creating them.

## Install on your machine

Skills live in `~/.claude/skills/<name>/`. Copy the folder over:

```sh
cp -r claude-skills/make-pwa-installable ~/.claude/skills/
```

Or symlink so updates flow with `git pull`:

```sh
ln -s "$PWD/claude-skills/make-pwa-installable" ~/.claude/skills/make-pwa-installable
```

Next Claude Code session will pick it up automatically — the skill description
appears in `/help` / the available-skills list.

## Skills here

- **make-pwa-installable** — turn a static web project into an installable
  PWA with a custom icon, manifest, service worker, head tags, and an
  install banner with iOS Add-to-Home-Screen instructions. Asks the user
  for the source image and the app name.
