---
name: git-branch-creation
description: Governs the procedure for creating local Git branches. Requires verifying and requesting the push of commits from the previous branch (including the count and title of each commit), strictly prohibits automatic pushing, and enforces the branch naming convention <username_git>/<type>/<ticket_number>.
---

# Git Branch Creation Guidelines

Rules and procedures for creating and switching Git branches within the repository.

## Rules & Strict Constraints

### 1. Prohibition of Automatic Push

- **Never `git push` automatically:** Never execute commands that push code to the remote repository (`remote`). Pushing
  to remote is strictly reserved for the user.

### 2. Transitioning Between Branches

- **Prior Check:** Before creating a new local branch, verify the status of the current branch.
- **Request User Push:** If there are unpushed local commits on the current branch, explicitly ask the user to push
  them, detailing:
    - The **exact number of commits** concerned.
    - The **list of their names/messages** (e.g., short summary or `git log`).

### 3. Branch Naming Convention

The local branch name must strictly adhere to the following structure:

`<username_git>/<type>/<ticket_number>`

- **`<username_git>`:** The locally configured Git username (`git config user.name` or account name), not an AI
  identifier.
- **`<type>`:** The type formatted according to *Conventional Commits* (`feat`, `fix`, `refactor`, `chore`, `docs`,
  `test`, `style`, `perf`).
- **`<ticket_number>`:** The associated ticket number (e.g., `1234` or `PROJECT-123`).

*Note: If no ticket number is available, refer to the issue creation skill (`git-issue-creation`) to generate one before
creating the branch.*

## Execution Workflow

1. **List unpushed commits:** Retrieve the exact count and titles of local commits on the current branch relative to
   `remote`.
2. **Notify the user:** If the count is > 0, state:
   > *"The current branch contains X unpushed commit(s):"*
   > - `<commit_1_sha>` `<commit_1_title>`
   > - `<commit_2_sha>` `<commit_2_title>`
       > *"Please push these commits before switching to a new branch."*
3. **Retrieve details:** Get the local `<username_git>`, validate `<type>`, and `<ticket_number>`.
4. **Create the branch:** Execute local branch creation (`git checkout -b <username_git>/<type>/<ticket_number>`).
