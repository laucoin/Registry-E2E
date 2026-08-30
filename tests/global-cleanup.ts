import { type APIRequestContext, request } from '@playwright/test'

const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://localhost:8081'
const ISSUER = process.env.E2E_ISSUER ?? 'http://localhost:9000/application/o/registry'
/**
 * Authentik exposes a single OAuth2 token endpoint at the server root, not
 * under the application slug — derive it from the issuer's origin.
 */
const TOKEN_URL = process.env.E2E_TOKEN_URL ?? new URL('/application/o/token/', ISSUER).href
/**
 * The token is minted by the `registry` provider the backend trusts — the only
 * OAuth2 provider ci/authentik/blueprints/e2e-registry.yaml declares. The former
 * default named a `registry-test-cli` client that exists in no environment, so
 * the token exchange answered 400 invalid_client and the purge never ran, in CI
 * or locally.
 *
 * The fallbacks are the backend's own credentials for that provider
 * (Registry-Backend application.yml), not the OIDC_NUXT_* names, which exist
 * only as compose-level plumbing in ci/compose.e2e.yml and are absent from both
 * applications. The Nuxt equivalents (NUXT_IDP_CLIENT_*) address the same
 * provider and serve as a second fallback for environments that only expose the
 * frontend's configuration.
 */
const TEST_CLIENT = process.env.E2E_TEST_CLIENT
	?? process.env.IDP_PRIVATE_CLIENT_ID
	?? process.env.NUXT_IDP_CLIENT_ID
	?? 'registry'
/**
 * That provider is confidential, so the exchange must carry its secret.
 */
const TEST_CLIENT_SECRET = process.env.E2E_TEST_CLIENT_SECRET
	?? process.env.IDP_PRIVATE_CLIENT_SECRET
	?? process.env.NUXT_IDP_CLIENT_SECRET
/**
 * Authentik's password grant is not classic ROPC: the `password` field is an
 * App-password token (intent app_password) issued for the user, so the login
 * password will not work here — a dedicated cleanup token is required.
 */
const CLEANUP_TOKEN = process.env.E2E_CLEANUP_TOKEN

const PAGE_SIZE = 200
const MAX_PASSES = 20
/**
 * Light users are minted by inviting an unknown address (membership /
 * users-admin-mutations build it from `uniqueName('light')`), so every run that
 * exercises those journeys leaves rows behind. 88 had piled up before this swept
 * them: harmless individually, but they pollute the directory the count
 * assertions read.
 */
const LIGHT_USER_PREFIX = 'e2e-light-'

/**
 * The suite must leave the environment as it found it. The domain
 * journeys create data; if a run is interrupted between create and delete, a
 * stray "E2E …" project would linger and break the zero-projects welcome
 * journey on the next run. Every test project carries the "E2E " prefix
 * (createProject / E2E_PROJECT_PREFIX), so this deletes any such leftover
 * directly against the backend (test IdP + v2 API), independent of the app
 * under test.
 *
 * Registered as BOTH globalSetup and globalTeardown on purpose: as teardown so
 * a run leaves nothing behind, and as setup so a run never inherits the debris
 * of one that was killed before its teardown could run.
 *
 * Deliberately NOT here: resetting a global account's role or blocked flag after
 * a users-administration journey. This hook does not run when a process is
 * killed, so that normalisation belongs in ci/seed/seed.sql, which always runs
 * first in CI.
 * Every failure here is announced, never swallowed. A purge that cannot run is
 * indistinguishable from one that found nothing to do, and that silence is what
 * let 82 stray projects accumulate unnoticed across several campaigns until the
 * zero-projects and list-count journeys started failing for reasons that looked
 * like product defects.
 */
function warn(reason: string): void {
	console.warn(`[global-cleanup] stray E2E data was NOT purged: ${reason}`)
}

interface StrayRow {
	id: string
	name?: string
	email?: string
}

interface SweepTarget {
	label: string
	collection: string
	listUrl: string
	isStray: (row: StrayRow) => boolean
	describe: (row: StrayRow) => string
}

/**
 * Re-read rather than a single size=200 sweep: the purge must not silently stop
 * at the first page once the suite outgrows it. Deleting shrinks the result set,
 * so page 0 is re-read until it comes back clean — bounded by a pass limit, and
 * stopped early if a pass deletes nothing, so a row the backend refuses to
 * delete cannot spin here forever.
 */
async function sweep(
	api: APIRequestContext,
	auth: Record<string, string>,
	target: SweepTarget,
): Promise<void> {
	for (let pass = 0; pass < MAX_PASSES; pass += 1) {
		const listResponse = await api.get(target.listUrl, { headers: auth })
		if (!listResponse.ok()) {
			warn(`the ${target.label} list could not be read (${listResponse.status()})`)
			return
		}
		const stray = ((await listResponse.json()).content as StrayRow[]).filter(target.isStray)
		if (stray.length === 0) {
			return
		}
		let deleted = 0
		const refusals: string[] = []
		for (const row of stray) {
			const response = await api.delete(
				`${BACKEND}/api/v2/${target.collection}/${row.id}`,
				{ headers: auth },
			)
			if (response.ok()) {
				deleted += 1
			} else {
				refusals.push(`${target.describe(row)} (${response.status()})`)
			}
		}
		if (deleted === 0) {
			warn(`${stray.length} ${target.label}(s) survived every delete: ${refusals.join(', ')}`)
			return
		}
	}
	warn(
		`${target.label}s still not drained after ${MAX_PASSES} passes of ${PAGE_SIZE} `
		+ '— raise MAX_PASSES or purge manually',
	)
}

export default async function purgeStrayProjects(): Promise<void> {
	const username = process.env.E2E_USERNAME
	if (!username || !CLEANUP_TOKEN) {
		warn(
			`missing ${!username ? 'E2E_USERNAME' : 'E2E_CLEANUP_TOKEN'}. `
			+ 'E2E_CLEANUP_TOKEN is an Authentik app-password (intent app_password) for '
			+ 'E2E_USERNAME — the sign-in password will not work. Without it the suite '
			+ 'leaks a project per interrupted journey.',
		)
		return
	}

	const api = await request.newContext()
	try {
		const form: Record<string, string> = {
			client_id: TEST_CLIENT, grant_type: 'password', scope: 'openid email profile',
			username, password: CLEANUP_TOKEN,
		}
		if (TEST_CLIENT_SECRET) {
			form.client_secret = TEST_CLIENT_SECRET
		}
		const tokenResponse = await api.post(TOKEN_URL, { form })
		if (!tokenResponse.ok()) {
			warn(`the cleanup token was refused (${tokenResponse.status()} from ${TOKEN_URL})`)
			return
		}
		const accessToken = (await tokenResponse.json()).access_token as string
		const auth = { Authorization: `Bearer ${accessToken}` }

		await sweep(api, auth, {
			label: 'project',
			collection: 'projects',
			listUrl: `${BACKEND}/api/v2/projects?page=0&size=${PAGE_SIZE}&q=E2E`,
			isStray: row => Boolean(row.name?.startsWith('E2E ')),
			describe: row => row.name ?? row.id,
		})
		await sweep(api, auth, {
			label: 'light user',
			collection: 'users',
			listUrl: `${BACKEND}/api/v2/users?page=0&size=${PAGE_SIZE}`,
			isStray: row => Boolean(row.email?.startsWith(LIGHT_USER_PREFIX)),
			describe: row => row.email ?? row.id,
		})
	} finally {
		await api.dispose()
	}
}
