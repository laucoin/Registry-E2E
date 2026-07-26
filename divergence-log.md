# Parity divergence log (ADR 021)

Every intended difference between the Angular app and the Nuxt rewrite that
required a parity assertion to change is recorded here — an assertion is never
silently loosened.

| Date | Journey / assertion | Divergence | Reason |
| ---- | ------------------- | ---------- | ------ |
| 2026-07-25 | Unauthenticated visit to `/` | Angular auto-redirects to the IdP; the Nuxt rewrite shows a public landing page with a login button | Deliberate UX change in the rewrite (public landing, ADR 022 login flow); the journey assertion accepts both paths to the IdP sign-in |
| 2026-07-25 | Project lifecycle journey | ~~v1 crashes post-create (account lockout)~~ **Resolved**: the shared-mapper null-safety fix landed (see README findings); the journey runs against both targets | Crash fix approved as a narrow exception to the v1 freeze — no divergence remains |
| 2026-07-26 | Project wizard date/time fields | Rewrite exposes labelled textboxes (`Date de début`, …); Angular exposes anonymous comboboxes targeted positionally | Deliberate a11y improvement (ADR 015); the spec prefers labels and keeps the positional fallback for the legacy target |
