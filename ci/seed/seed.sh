#!/usr/bin/env bash
# Seed the parity-suite test-account data into the backend: promote the IdP test
# user to administrator and link the lesser `-member` account with the default
# global role (both matched by their OIDC UUID). Run after the stack is up and
# the backend has migrated, before the suite.
#
# The `-fresh`, `-clash` and `-burn` accounts are intentionally left unseeded —
# their scenarios assert what the backend does with an identity it has no row for.
# `-unverified` needs no OIDC lookup: it is seeded as an email-only invitation,
# which is the state its refusal lives in, so only its address is passed through.
#
# Env: E2E_USERNAME, E2E_EMAIL, PG_PASS, PG_REGISTRY_DB (default registry),
#      COMPOSE_FILE (default ci/compose.e2e.yml).
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-ci/compose.e2e.yml}"
DB="${PG_REGISTRY_DB:-registry}"
EMAIL="${E2E_EMAIL:-e2e@example.test}"
DC=(docker compose -f "$COMPOSE_FILE")
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Resolve an Authentik username to its UUID — it is the JWT `sub` (provider
# sub_mode is user_uuid), which is how the backend keys the account.
resolve_oidc() {
	"${DC[@]}" exec -T registry-authentik-server \
		ak shell -c "from authentik.core.models import User; print(User.objects.get(username='$1').uuid)" \
		2>/dev/null | grep -Eio '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | tail -1
}

oidc="$(resolve_oidc "${E2E_USERNAME}")"
if [ -z "${oidc}" ]; then
	echo "seed: could not resolve OIDC UUID for '${E2E_USERNAME}'" >&2
	exit 1
fi
echo "seed: ${E2E_USERNAME} -> oidc_id=${oidc}"

oidc_member="$(resolve_oidc "${E2E_USERNAME}-member")"
if [ -z "${oidc_member}" ]; then
	echo "seed: could not resolve OIDC UUID for '${E2E_USERNAME}-member'" >&2
	exit 1
fi
echo "seed: ${E2E_USERNAME}-member -> oidc_id=${oidc_member}"

oidc_blocked="$(resolve_oidc "${E2E_USERNAME}-blocked")"
if [ -z "${oidc_blocked}" ]; then
	echo "seed: could not resolve OIDC UUID for '${E2E_USERNAME}-blocked'" >&2
	exit 1
fi
echo "seed: ${E2E_USERNAME}-blocked -> oidc_id=${oidc_blocked}"

# Disposable identities — resolved only so the SQL can clear any row they left
# behind; they are deliberately never inserted.
oidc_burn="$(resolve_oidc "${E2E_USERNAME}-burn")"
oidc_fresh="$(resolve_oidc "${E2E_USERNAME}-fresh")"
oidc_purge="$(resolve_oidc "${E2E_USERNAME}-purge")"
oidc_signout="$(resolve_oidc "${E2E_USERNAME}-signout")"
oidc_light="$(resolve_oidc "${E2E_USERNAME}-light")"
oidc_selfpurge="$(resolve_oidc "${E2E_USERNAME}-selfpurge")"

"${DC[@]}" exec -T -e PGPASSWORD="${PG_PASS}" registry-postgresql \
	psql -v ON_ERROR_STOP=1 -U "${DB}" -d "${DB}" \
	-v oidc="${oidc}" -v email="${EMAIL}" \
	-v oidc_member="${oidc_member}" -v email_member="member-${EMAIL}" \
	-v oidc_blocked="${oidc_blocked}" -v email_blocked="blocked-${EMAIL}" \
	-v oidc_burn="${oidc_burn}" -v oidc_fresh="${oidc_fresh}" -v oidc_purge="${oidc_purge}" \
	-v oidc_signout="${oidc_signout}" -v oidc_light="${oidc_light}" \
	-v oidc_selfpurge="${oidc_selfpurge}" -v email_unverified="unverified-${EMAIL}" < "${HERE}/seed.sql"

echo "seed: done"
