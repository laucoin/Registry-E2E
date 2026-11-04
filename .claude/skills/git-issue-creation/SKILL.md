---
name: git-issue-creation
description: Manages issue creation on GitHub or GitLab via MCP using repository templates (or proposing to initialize them if missing), either upon explicit user request or when a missing ticket number is detected during branch creation, subject to mandatory prior user approval.
---

# Git Issue Creation

This skill manages issue creation on GitHub or GitLab while strictly adhering to repository templates, either upon
explicit user request or when a ticket number is missing during branch creation. Explicit user validation is mandatory
before any remote write action.

## Operational Instructions

### 1. Triggers

- Explicit user request to create a ticket or issue.
- Branch creation request (`git-branch-creation`) without a valid ticket identifier.

### 2. Repository Template Detection & Initialization

1. Inspect the repository to locate existing issue templates:
    - On **GitHub**: `.github/ISSUE_TEMPLATE/` (`.yml` or `.md` files).
    - On **GitLab**: `.gitlab/issue_templates/` (`.md` files).
2. **If no templates are present:**
    - Prompt the user to generate platform-adapted standard cross-functional templates (*frontend*, *backend*, *docs*,
      *e2e*):
        - `feature` (✨ Feature Request)
        - `bug` (🐛 Bug Report)
        - `debt` (🧹 Tech Debt & Refactoring)
        - `testing` (🧪 Tests & E2E Quality Assurance)
        - `documentation` (📚 Documentation)
        - `ops` (🚀 Ops & Infrastructure)
        - `security` (🔒 Security & Vulnerability)
3. **Template Selection:**
    - Select the template matching the user's need and gather the required information.
    - Adjust requirements to user profile: for non-purely technical issues (`feature`, `bug`, `documentation`), never
      block creation if technical sections (*technical impacts*, *test scope*, logs) are left empty; these remain
      optional and can be filled in later by engineering.

### 3. Strict Writing & Style Rules

- **Language:** All issue titles and bodies must be written in French.
- **Grammar & Spelling:** Zero tolerance for agreement errors (particularly past participle agreement with the auxiliary
  *avoir* and pronominal verbs) as well as infinitive vs. past participle distinction (-er / -é).
- **Tenses & Moods:** Consistently use the present indicative tense to describe expected behaviors and functional rules.
  Avoid systematic future tense and unjustified conditional phrasing.
- **Technical Anglicisms:** Preserve recognized industry technical Anglicisms (*frontend*, *backend*, *pipeline*,
  *middleware*, *hook*, *payload*, *token*, *build*, *setup*, *fixtures*, *mocks*).

### 4. Mandatory User Validation

- Present the prepared issue to the user:
    - Formatted title (with the conventional prefix and appropriate emoji, e.g., `✨ feat: ...`, `🐛 bug: ...`).
    - Applied labels.
    - Complete issue body formatted according to the selected template.
- **Blocking condition:** Wait for explicit user approval before executing any remote write operation.
- If MCP remote write tools are unavailable or denied, provide the full formatted Markdown text directly in the chat for
  manual copy-pasting.

### 5. MCP Integration & Branch Chaining

- Execute issue creation through the appropriate MCP tool (GitHub or GitLab).
- Retrieve and provide the generated ticket ID and URL to the user.
- If the original context was a branch creation flow, inject this new ticket ID into the branch naming convention:
  `<username_git>/<type>/<ticket_number>`.

---

## Cross-Functional Template Reference

### Naming Conventions & Prefixes

| Type          | Emoji | Title Prefix    | Default Label   | GitHub File         | GitLab File        |
|:--------------|:-----:|:----------------|:----------------|:--------------------|:-------------------|
| Feature       |  ✨   | `✨ feat: `     | `enhancement`   | `feature.yml`       | `feature.md`       |
| Bug           |  🐛   | `🐛 bug: `      | `bug`           | `bug.yml`           | `bug.md`           |
| Tech Debt     |  🧹   | `🧹 refactor: ` | `tech-debt`     | `debt.yml`          | `debt.md`          |
| Tests & E2E   |  🧪   | `🧪 test: `     | `testing`       | `testing.yml`       | `testing.md`       |
| Documentation |  📚   | `📚 docs: `     | `documentation` | `documentation.yml` | `documentation.md` |
| Ops / Infra   |  🚀   | `🚀 ops: `      | `operations`    | `ops.yml`           | `ops.md`           |
| Security      |  🔒   | `🔒 sec: `      | `security`      | `security.yml`      | `security.md`      |

### Critical Field Specifics

- **Bugs:** When relevant, collect environment (Production, Staging, Local), frontend application version, incident
  timestamp, as well as UI screenshots and DevTools Console / Network tab (F12) captures.
- **Features:** Prioritize user/business framing ("As a... I want to... so that...") and isolate cross-cutting technical
  impacts (*frontend*, *backend*, API contracts, database) within a dedicated non-mandatory technical section.
