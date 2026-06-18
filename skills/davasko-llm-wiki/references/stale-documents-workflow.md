# Stale Documents Registry & Verification Workflow

This document defines the rules, formats, and procedures for working with stale documents in the **DavASko LLM Wiki** framework.

---

## 1. The Stale Status Concept

A document is marked with `status: stale` in its YAML frontmatter when one or more of its outbound links pointing to other wiki pages refer to a version that has been superseded by a newer version of the target document.

### Stale Condition:
Given Page A containing a link to Page B: `[[page-b]] (v1.0.0)`
- If Page B is updated to version `1.1.0` or `2.0.0`, the link inside Page A points to an older version.
- Page A is now considered **stale** (outdated) and must be updated to ensure its contents align with the latest version of Page B.

---

## 2. Document Frontmatter Fields for Stale Pages

When a page is detected as stale:
1. Set the page's status in the YAML frontmatter to `status: stale`.
2. Add the outdated link(s) to the `stale_links` array in the YAML frontmatter.

### Example Frontmatter for a Stale Page:
```yaml
---
title: "Player Controller Logic"
type: concept
status: stale
version: 1.0.0
source_status: source-linked
sources:
  - project-wiki/raw/docs/player-controller.md
last_updated: 2026-06-18 12:00
related:
  - "[[input-manager]] (v1.0.0)"
stale_links:
  - "[[input-manager]] (v1.0.0)"  # This link is stale because input-manager was updated to v1.1.0
---
```

---

## 3. The Stale Documents Registry File

Every layer MUST contain a registration file at the path `wiki/stale-documents.md`. This file maintains the list of all stale documents in the layer.

### Registry File Template (`stale-documents.md`):
```markdown
---
title: "Stale Documents Registry"
type: concept
status: active
version: 1.0.0
source_status: derived
sources:
  - layer-name/wiki/stale-documents.md
last_updated: YYYY-MM-DD HH:MM
related: []
---

# Stale Documents Registry

**Summary**: Реестр устаревших документов базы знаний, требующих актуализации и синхронизации версий.

## Устаревшие документы

Здесь перечислены документы, помеченные как `status: stale` из-за устаревших версий зависимостей/ссылок.

- [[player-controller]] (v1.0.0) — требует обновления ссылок на [[input-manager]] (ожидается v1.1.0)
- [[another-stale-page]] (v1.2.0) — требует проверки изменений в [[base-module]] (ожидается v2.0.0)

## Related Pages
- [[index]]
```

---

## 4. Operational Workflow for Stale Data

### Step 1: Identification & Registration
1. When you modify a wiki page, increment its version field (minor for updates, major for breaking changes).
2. Scan all other wiki pages in the layer and its dependents for links to your modified page.
3. For each page containing a link to your modified page with an outdated version (e.g. `[[your-page]] (v1.0.0)` when it is now `v1.1.0`):
   - Open the referencing page.
   - Update its frontmatter to:
     - `status: stale`
     - Add the old link `[[your-page]] (v1.0.0)` to `stale_links: [...]`.
   - Open the layer's `wiki/stale-documents.md` file and append the referencing page to the list of stale documents with a brief note describing what needs to be verified.

### Step 2: Resolution & Update
When you are tasked with resolving a stale page (updating it):
1. Review the changes made to the target document that triggered the stale state.
2. Verify that the stale page's content is still accurate or update it to reflect the new logic/principles in the target document.
3. Update the stale page's frontmatter:
   - Change `status: stale` back to `status: active`.
   - Update the link to the target document to the new version, e.g., `[[your-page]] (v1.1.0)`.
   - Remove the stale link from the `stale_links` array in the frontmatter.
   - Update `last_updated: YYYY-MM-DD HH:MM`.
4. Open the layer's `wiki/stale-documents.md` file and remove the resolved page from the list of stale documents.
