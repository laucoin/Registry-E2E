---
name: cybersecurity-review
description: Evaluates operational security, secrets management, data privacy (PII), and supply chain hygiene in the Playwright E2E test repository. Enforces zero hardcoded credentials, secure CI artifact handling (traces, videos, logs), dedicated least-privilege test accounts, a ban on global SSL/TLS bypasses, and pnpm audit vulnerability scanning.
---

# Cybersecurity Review — Playwright E2E Tests

Examine the change (diff, newly added tests, fixtures, configuration files, or CI workflow scripts) against operational
security, credential protection, privacy hygiene, and supply chain integrity for the Playwright E2E test repository.
Only touched or newly added files are scored; discrepancies identified in untouched legacy code are reported as
technical debt without score deductions. Start with a baseline score of **100 points** and apply deductions: **blocker
−40**, **should-fix −10**, **nit −2.5** (minimum floor at 0).

## Evaluation Criteria

### 1. Secrets Management, Credentials & CI Configuration

* **Zero Hardcoded Credentials:**
    * **Strict and absolute ban** on plaintext passwords, API keys, session secrets, certificates, or private keys
      inside `.spec.ts` files, fixtures, Page Objects, or configuration files (`playwright.config.ts`).
    * All sensitive values must be injected through environment variables (`process.env.E2E_*`).
    * Mandatory presence of a `.env.example` file documenting all required environment keys without exposing any real
      secrets.
* **Hermetic Session Snapshots (`storageState`):**
    * Generated session state files (`auth.json`, `*.storageState.json`) contain live session tokens and cookies: they
      must be **strictly excluded from Git tracking** via `.gitignore`.

### 2. CI Artifact Confidentiality & Sensitive Data Masking

* **Data Leak Prevention in Traces and Recordings:**
    * Playwright execution traces (`trace.zip`), video recordings, and screenshots are archived as CI artifacts: they
      must not capture, expose, or log sensitive secrets in plaintext.
    * Secure credential input: password and secret token inputs must be masked or excluded from console logs during
      automated runs.
    * Network sanitization: sensitive authentication headers (`Authorization: Bearer ...`, session cookies) captured
      within trace archives must be sanitized or redacted if test reports are shared or hosted.

### 3. Data Privacy & Hygiene (Anti-PII)

* **Ban on Production Personal Identifiable Information:**
    * Zero real personal identifiable information (PII: real user names, real email addresses, personal phone numbers,
      production financial or healthcare records) in test fixtures, mocks, or assertion checks.
    * Exclusive use of synthetic, fictitious, or dynamically generated data (e.g., Faker libraries, RFC 2606 reserved
      domains like `@example.com`).

### 4. Principle of Least Privilege & Test Account Isolation

* **Dedicated E2E Service Accounts:**
    * Automated E2E runs must use dedicated test/service accounts provisioned specifically for CI or staging
      environments.
    * Absolute ban on running tests using shared global production super-admin credentials or individual team members'
      personal login accounts.
* **Environment Confinement:**
    * Tests must strictly target designated staging, local, or isolated test environments.
    * Ensure explicit safeguards verifying that `baseURL` cannot inadvertently point directly to an active production
      environment during write-heavy test runs.

### 5. Network Security, SSL & Supply Chain Auditing

* **Strict Transport Security (SSL/TLS Enforcement):**
    * **Global activation of `ignoreHTTPSErrors: true` in `playwright.config.ts` is strictly prohibited.** Disabling TLS
      certificate validation hides transport vulnerabilities and misconfigurations. Any local self-signed certificate
      exception must be strictly scoped to local development environments.
* **Dependency Auditing & Package Integrity:**
    * Strict adherence to package lockfile integrity (`pnpm-lock.yaml`).
    * Zero critical or high-severity vulnerabilities reported when running `pnpm audit`.

## Output Format

1. **Partial Score:** Start at 100, apply deductions (**blocker −40**, **should-fix −10**, **nit −2.5**), and display
   the score (e.g., `Cybersecurity: 100/100`).
2. **List of Vulnerabilities & Anomalies:** Grouped by severity with exact locations (`file:line`), explanation of the
   risk (credential leak, unmasked trace artifact, PII usage, global SSL bypass), and concrete remediation code.
3. **Security Debt:** Informative findings in untouched pre-existing code (no score deduction).
