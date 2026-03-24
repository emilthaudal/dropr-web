# AGENTS.md — dropr-web Coding Agent Guide

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Project Overview

**dropr-web** is the companion web tool for the [Dropr](../Dropr) WoW addon. It is a
Next.js 16 App Router application deployed to Vercel (free tier).

**Purpose:** User pastes a Raidbots droptimizer URL → app fetches the public `data.json`
endpoint → parses DPS gains and dungeon attribution → generates a base64-encoded JSON
import string → user copies the string and runs `/dropr import <string>` in WoW.

**No backend.** Everything is client-side. No API routes, no server components for data
fetching. The Raidbots endpoint is public and CORS-accessible.

---

## Architecture

```
app/
  layout.tsx       — Minimal layout (no Geist fonts). Title: "Dropr — Raidbots Droptimizer Import"
  page.tsx         — Single client component: URL input → generate → copy + dungeon preview
  globals.css      — Bare @import "tailwindcss"; all page styles are inline <style> in page.tsx
lib/
  raidbots.ts      — Pure functions: extractReportId, fetchAndParse, generateImportString
```

---

## Raidbots Data Pipeline (lib/raidbots.ts)

```
URL → extractReportId (regex) → fetch data.json
  → baseline = sim.players[0].collected_data.dps.mean
  → for each sim.profilesets.results[]:
      parts = name.split("/")
      itemId = parts[3], slot = parts[6]
      dpsGain = result.mean - baseline
      item = itemLibrary.find(id == itemId)
      for src in item.sources where src.instanceId > 0:
          dungeon = instanceLibrary.find(id == src.instanceId)
          boss = dungeon.encounters.find(id == src.encounterId)
          accumulate: keep highest dpsGain per itemId per dungeon
  → per dungeon: top 3 items by dpsGain desc
  → encode: btoa(JSON.stringify(payload))
```

**Import string payload shape:**
```json
{
  "char": "Jetskis",
  "spec": "unholy",
  "importedAt": 1234567890,
  "dungeons": {
    "1315": {
      "name": "Maisara Caverns",
      "items": [
        { "id": 251168, "name": "Liferipper's Cutlass", "slot": "main_hand",
          "dpsGain": 2788, "boss": "Rak'tul, Vessel of Souls", "icon": "inv_..." }
      ]
    }
  }
}
```

The addon decodes with: `json.decode(Base64Decode(str))` using rxi/json.lua.

---

## Build & Deploy

```bash
npm run build    # Must pass with zero errors before committing
npm run dev      # Local dev server at http://localhost:3000
```

**Vercel:** Zero-config. Connect repo, Vercel auto-detects Next.js. No environment
variables needed. Deploy: push to main branch or `vercel --prod`.

---

## Style Conventions

- All page styles live as a `<style>` block inside `page.tsx` (CSS custom properties, no Tailwind classes on elements)
- Dark WoW-adjacent aesthetic: `#0a0b0d` background, Cinzel (display) + Rajdhani (body) fonts
- Item icons fetched from `wow.zamimg.com/images/wow/icons/medium/{icon}.jpg`
- No external component libraries

---

## Quality Gates

Before committing any code change:
```bash
npm run build   # Must succeed with zero TypeScript errors
```

There are no unit tests. Manual browser testing against a real Raidbots report URL.

<!-- BEGIN BEADS INTEGRATION v:1 profile:full hash:f65d5d33 -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Quality
- Use `--acceptance` and `--design` fields when creating issues
- Use `--validate` to check description completeness

### Lifecycle
- `bd defer <id>` / `bd supersede <id>` for issue management
- `bd stale` / `bd orphans` / `bd lint` for hygiene
- `bd human <id>` to flag for human decisions
- `bd formula list` / `bd mol pour <name>` for structured workflows

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->
