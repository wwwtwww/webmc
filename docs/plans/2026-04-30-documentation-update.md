# Documentation Update Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update all documentation in the `docs/` directory to reflect the current state of the codebase and then sync to GitHub.

**Architecture:** Systematic update of markdown files based on source code analysis (main.js, CommandParser.js, CraftingManager.js, MobManager.js, etc.).

**Tech Stack:** Markdown, Git.

---

### Task 1: Update requirements.md

**Files:**
- Modify: `docs/requirements.md`

**Step 1: Add new commands and mob details**
Update the "开发者工具" and "核心玩法" sections to include `/clear-mobs`, `/spawn`, and details about zombies/pigs.

### Task 2: Update api.md

**Files:**
- Modify: `docs/api.md`

**Step 1: Detail CommandParser and MobManager**
List all available commands and explain the mob spawning/AI logic briefly.

### Task 3: Update plan.md

**Files:**
- Modify: `docs/plan.md`

**Step 1: Sync completed items**
Update the "已完成事项" section with recent features (HUD, Tool system, extensive bug fixes).

### Task 4: Update troubleshooting.md

**Files:**
- Modify: `docs/troubleshooting.md`

**Step 1: Add recent critical bug fixes as troubleshooting items**
Incorporate items from `buglist.md` (e.g., DDA deadlocks, persistence issues, physics jitter) into the troubleshooting guide.

### Task 5: Sync to GitHub

**Files:**
- Shell commands only.

**Step 1: Stage, commit, and push**
```bash
git add docs/*.md
git commit -m "docs: update documentation to reflect current codebase state"
git push
```
