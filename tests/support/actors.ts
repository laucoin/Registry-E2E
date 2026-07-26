/**
 * The suite's IdP identities. Until this roster existed the suite held a single
 * administrator session, and a suite that is only ever allowed to do things
 * cannot assert that Registry refuses anybody — which is most of the blocking
 * scenario set (critical-scenarios.md §2). Every account is provisioned by
 * ci/authentik/blueprints/e2e-registry.yaml, derives its username from
 * E2E_USERNAME and shares E2E_PASSWORD, so adding them costs no new CI secret.
 */
export type Actor =
	'admin'
	| 'member'
	| 'fresh'
	| 'clash'
	| 'burn'
	| 'blocked'
	| 'purge'
	| 'signout'
	| 'light'
	| 'selfpurge'
	| 'unverified'

export interface ActorAccount {
	actor: Actor
	username: string
	/**
	 * Kept in step with ci/authentik/blueprints/e2e-registry.yaml, which derives
	 * each address from E2E_EMAIL. `clash` deliberately reuses the administrator's
	 * address — that collision is the scenario. `unverified` holds one of its own,
	 * but its IdP identity refuses to vouch for it, which is that scenario.
	 */
	email: string
	/**
	 * Matched against the shell after sign-in to prove the session belongs to the
	 * intended identity. Case- and whitespace-insensitive on purpose: the two
	 * targets render the name differently (divergence-log.md §1).
	 */
	displayName: RegExp
	/**
	 * Only the seeded accounts are signed in during setup. The disposable ones are
	 * driven explicitly by the journeys that consume them: signing them in up front
	 * would provision (or permanently refuse) the very identity whose first sign-in
	 * is the thing under test.
	 *
	 * ONE DISPOSABLE IDENTITY PER DESTRUCTIVE JOURNEY. Each of these is consumed —
	 * provisioned, deleted or signed out — so two journeys sharing one become
	 * order-dependent: whichever runs second finds a row the first left behind, and
	 * the suite drifts by a couple of tests between campaigns depending on timing.
	 * Adding an account is far cheaper than reasoning about that ordering.
	 */
	signInAtSetup: boolean
}

const BASE_USERNAME = process.env.E2E_USERNAME ?? ''
const BASE_EMAIL = process.env.E2E_EMAIL ?? 'e2e@example.test'

export const ACCOUNTS: ActorAccount[] = [
	{ actor: 'admin', username: BASE_USERNAME, email: BASE_EMAIL, displayName: /spike/i, signInAtSetup: true },
	{
		actor: 'member',
		username: `${BASE_USERNAME}-member`,
		email: `member-${BASE_EMAIL}`,
		displayName: /nova/i,
		signInAtSetup: true
	},
	{
		actor: 'fresh',
		username: `${BASE_USERNAME}-fresh`,
		email: `fresh-${BASE_EMAIL}`,
		displayName: /fresh/i,
		signInAtSetup: false
	},
	{
		actor: 'clash',
		username: `${BASE_USERNAME}-clash`,
		email: BASE_EMAIL,
		displayName: /clash/i,
		signInAtSetup: false
	},
	{
		actor: 'burn',
		username: `${BASE_USERNAME}-burn`,
		email: `burn-${BASE_EMAIL}`,
		displayName: /burn/i,
		signInAtSetup: false
	},
	{
		actor: 'blocked',
		username: `${BASE_USERNAME}-blocked`,
		email: `blocked-${BASE_EMAIL}`,
		displayName: /barred/i,
		signInAtSetup: false
	},
	{
		actor: 'purge',
		username: `${BASE_USERNAME}-purge`,
		email: `purge-${BASE_EMAIL}`,
		displayName: /purge/i,
		signInAtSetup: false
	},
	{
		actor: 'signout',
		username: `${BASE_USERNAME}-signout`,
		email: `signout-${BASE_EMAIL}`,
		displayName: /signing/i,
		signInAtSetup: false
	},
	{
		actor: 'light',
		username: `${BASE_USERNAME}-light`,
		email: `light-${BASE_EMAIL}`,
		displayName: /light/i,
		signInAtSetup: false
	},
	{
		actor: 'unverified',
		username: `${BASE_USERNAME}-unverified`,
		email: `unverified-${BASE_EMAIL}`,
		displayName: /unsure/i,
		signInAtSetup: false,
	},
	{
		actor: 'selfpurge',
		username: `${BASE_USERNAME}-selfpurge`,
		email: `selfpurge-${BASE_EMAIL}`,
		displayName: /selfserve/i,
		signInAtSetup: false
	},
]

export function account(actor: Actor): ActorAccount {
	const found = ACCOUNTS.find(candidate => candidate.actor === actor)
	if (!found) {
		throw new Error(`unknown actor '${actor}'`)
	}
	return found
}

export function storageStatePath(actor: Actor): string {
	return `.auth/nuxt-${actor}.json`
}
