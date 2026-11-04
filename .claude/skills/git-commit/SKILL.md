---
name: git-commit
description: Manages local git commits respecting naming conventions, atomicity, no Co-Author, push prohibition, and scope verification against the branch ticket.
---

# Git Commit Management

Use this skill to structure, write, and validate local git commits while strictly adhering to atomicity, formatting, and
security rules.

## Core Rules

1. **No Push:**
    - Never push (`git push`) to remote under any circumstances. All commit operations must remain strictly local.

2. **No Co-Author:**
    - Never include `Co-Authored-by:` tags or equivalents in commit messages.

3. **Atomicity and Readability:**
    - Each commit must be individually testable.
    - The commit scope must be neither too small nor too large, keeping it perfectly readable and coherent.
    - **Multiple commits per ticket:** Allowed (and often encouraged for breaking down changes), but not strictly
      required.

4. **Scope Verification (Branch Ticket):**
    - Before committing, verify whether the commit contents fall within the scope of the ticket specified in the current
      branch name.
    - **If the contents fall outside the ticket scope:** Invoke the `git-branch-creation` skill to switch to an
      appropriate new branch before committing.

5. **Pre-commit Gate:**
    - The build must be green and coverage must not drop before committing (command and thresholds: `AGENTS.md` §7).

6. **Commit Message Formatting:**
    - The commit message must be a simple sentence describing the change, **starting with a lowercase letter**.
    - You may include the type (conventional commit: `feat`, `fix`, `chore`, etc.) and ticket number at the beginning in
      the format: `<type>(<ticket_number>): <description>` (e.g., `feat(123): add search filter support`).
    - **Breaking Changes:** If the commit introduces a breaking change, indicate it with an exclamation mark `!` (e.g.,
      `feat(123)!: update user api format`) and explicitly include a `BREAKING CHANGE: <explanation>` mention in the
      commit description.
    - If the branch carries no ticket number, the scope is the functional domain touched (e.g., `groups`, `profiles`).
    - *(Note: The commit may be automatically formatted with the branch name via a hook if configured).*
