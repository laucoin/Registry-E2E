-- Registry E2E data seed. Promotes the parity-suite test user to administrator
-- and links the lesser test account with the default global role. Idempotent:
-- safe to re-run.
--
-- psql variables (passed with -v):
--   oidc         = the admin IdP user's UUID (== the JWT `sub`, sub_mode user_uuid)
--   email        = the admin test user's email
--   oidc_member  = the member IdP user's UUID
--   email_member = the member test user's email
--   oidc_blocked  = the block/unblock target's IdP UUID
--   email_blocked = the block/unblock target's email
--   oidc_burn     = the erasure target's IdP UUID
--   oidc_fresh    = the first-sign-in target's IdP UUID
--   oidc_purge    = the purge-guard target's IdP UUID
--   oidc_signout  = the sign-out target's IdP UUID
--   oidc_light    = the light-user linking target's IdP UUID
--   oidc_selfpurge = the self-service purge target's IdP UUID
--   email_unverified = the unvouched-for address, seeded as an invitation
--
-- The `-fresh`, `-clash` and `-burn` accounts are deliberately NOT seeded here:
-- each of their scenarios asserts what happens when the backend has no row for
-- the identity (auto-provisioning, email collision, erasure). `-unverified` is
-- seeded, but as an invitation rather than a linked account — see the bottom.

-- Spike Test — administrator. Matched by OIDC id so it works whether or not the
-- user has logged in yet (the backend auto-provisions on first login otherwise).
INSERT INTO tb_user (oidc_id, type, first_name, last_name, email, role, visible)
SELECT :'oidc'::uuid, 'USER',
       'Spike',
       'Test',
       :'email', 'USER_ADMINISTRATOR',
       TRUE WHERE NOT EXISTS (SELECT 1 FROM tb_user WHERE oidc_id = :'oidc'::uuid);

UPDATE tb_user
SET role       = 'USER_ADMINISTRATOR',
    first_name = 'Spike',
    last_name  = 'Test',
    visible    = TRUE
WHERE oidc_id = :'oidc'::uuid;

-- Nova Member — the lesser actor. Holds the default global USER role, which
-- grants project creation but no access to the user directory, so it is both the
-- non-self row the users-admin journey acts on and the session every role-gating
-- refusal is asserted against. Linked to its IdP identity up front so the suite
-- can sign it in without relying on auto-provisioning order.
INSERT INTO tb_user (oidc_id, type, first_name, last_name, email, role, visible)
SELECT :'oidc_member'::uuid, 'USER',
       'Nova',
       'Member',
       :'email_member', 'USER',
       TRUE WHERE NOT EXISTS (SELECT 1 FROM tb_user WHERE oidc_id = :'oidc_member'::uuid);

-- Re-run safety: an earlier run may have blocked (visible = FALSE) or demoted
-- this account as part of a scenario, so restore it to its baseline.
UPDATE tb_user
SET role       = 'USER',
    first_name = 'Nova',
    last_name  = 'Member',
    visible    = TRUE
WHERE oidc_id = :'oidc_member'::uuid;

-- Barred Account — the block/unblock target, linked up front so the scenario can
-- block it before its first sign-in. Isolated from Nova so blocking it cannot
-- disturb the session every role-gating journey depends on.
INSERT INTO tb_user (oidc_id, type, first_name, last_name, email, role, visible)
SELECT :'oidc_blocked'::uuid, 'USER',
       'Barred',
       'Account',
       :'email_blocked', 'USER',
       TRUE WHERE NOT EXISTS (SELECT 1 FROM tb_user WHERE oidc_id = :'oidc_blocked'::uuid);

-- Load-bearing for repeatability: a run killed between block and unblock leaves
-- this account blocked, and globalTeardown does not run after a kill. The seed
-- always runs first in CI, so the reset belongs here rather than in TypeScript.
UPDATE tb_user
SET role       = 'USER',
    first_name = 'Barred',
    last_name  = 'Account',
    visible    = TRUE
WHERE oidc_id = :'oidc_blocked'::uuid;

-- Disposable identities: `burn` is consumed by the erasure journeys and `fresh`
-- by the first-sign-in one, so both must start every run with NO backend row.
-- Their teardown cannot be relied on — a killed run never reaches it — so
-- deleting by OIDC id here is the only reliable reset, and it always runs first
-- in CI. Since V1_17_0 erasure is a real DELETE rather than a "purged" flag, this
-- doubles as the reset for a completed erasure.
DELETE
FROM tb_user
WHERE oidc_id IN (
                  :'oidc_burn'::uuid, :'oidc_fresh'::uuid, :'oidc_purge'::uuid,
                  :'oidc_signout'::uuid, :'oidc_light'::uuid, :'oidc_selfpurge'::uuid
    );

-- Unsure Address — the AUTH_EMAIL_NOT_VERIFIED target. Seeded as an INVITATION
-- (oidc_id NULL) because that is the only state the refusal exists in: linking an
-- invited row to an IdP identity is what demands a verified address, and the claim
-- for this account asserts the opposite (ci/authentik/blueprints/e2e-registry.yaml
-- sets email_verified: false). The refusal happens before anything is written, so
-- the row survives the journey untouched and the next run needs no reset.
--
-- Matched on the address rather than an oidc_id like the accounts above: this one
-- has none, and the address is the key the backend looks it up by. global-cleanup
-- only sweeps light users named `e2e-light-*`, so it leaves this row alone.
INSERT INTO tb_user (oidc_id, type, first_name, last_name, email, role, visible)
SELECT NULL, 'USER',
       'Unsure',
       'Address',
       :'email_unverified', 'USER',
       TRUE WHERE NOT EXISTS (SELECT 1 FROM tb_user WHERE email = :'email_unverified');

-- Re-run safety: a campaign that ran with the light-user feature off would have
-- dropped the invitation and self-registered the identity instead, leaving a
-- LINKED row that makes the refusal unreachable. Put it back to an invitation.
UPDATE tb_user
SET oidc_id    = NULL,
    type       = 'USER',
    first_name = 'Unsure',
    last_name  = 'Address',
    role       = 'USER',
    visible    = TRUE
WHERE email = :'email_unverified';
