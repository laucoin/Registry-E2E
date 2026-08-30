import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'

/**
 * Minimal .env loader (no dotenv dependency); a missing file is fine — the
 * suite then relies on the ambient environment.
 */
try {
	for (const line of readFileSync('.env', 'utf8').split('\n')) {
		const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
		if (match) {
			const [, key, value = ''] = match
			if (key && !process.env[key]) {
				process.env[key] = value
			}
		}
	}
} catch {
}

const NUXT_URL = process.env.E2E_NUXT_URL ?? 'http://localhost:3000'
/**
 * A second Nuxt instance whose session lifetimes are seconds rather than hours
 * (ci/compose.e2e.yml). Only the session-lifetime journeys target it, and they
 * are the only journeys that can observe an idle timeout without idling for the
 * production 30 minutes.
 */
const NUXT_SESSION_URL = process.env.E2E_NUXT_SESSION_URL ?? 'http://localhost:3001'
const SESSION_SPEC = /session-lifetime\.spec\.ts/

/**
 * The parity suite, now single-target: the Angular app it was
 * authored against is retired, so `--project=nuxt` is the only app target and
 * every journey runs against the rewrite. The assertions still speak in
 * user-visible outcomes, which is what kept them portable in the first place.
 * The suite drives ONE shared backend database, so data-mutating journeys
 * (project create/delete) must never run concurrently with state-asserting
 * ones (the zero-projects welcome) — hence one worker, no parallelism.
 * Global setup/teardown clean stray lifecycle data before AND after the run,
 * so an interrupted previous run can't fail the zero-projects welcome journey.
 */
export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	/**
	 * The same purge on both hooks: as teardown so a run leaves nothing behind,
	 * as setup so a run never inherits the debris of one killed before it.
	 */
	globalSetup: './tests/global-cleanup.ts',
	globalTeardown: './tests/global-cleanup.ts',
	use: {
		trace: 'retain-on-failure',
		video: 'retain-on-failure',
	},
	projects: [
		{
			name: 'nuxt-setup',
			testMatch: /auth\.setup\.ts/,
			use: { baseURL: NUXT_URL },
		},
		{
			name: 'nuxt',
			testIgnore: [/auth\.setup\.ts/, SESSION_SPEC],
			dependencies: ['nuxt-setup'],
			use: {
				...devices['Desktop Chrome'],
				baseURL: NUXT_URL,
				storageState: '.auth/nuxt-admin.json',
			},
		},
		/**
		 * The session-lifetime journeys sign in themselves — they are about how a
		 * session begins and ends, so they must not inherit a persisted one.
		 */
		{
			name: 'nuxt-session',
			testMatch: SESSION_SPEC,
			use: {
				...devices['Desktop Chrome'],
				baseURL: NUXT_SESSION_URL,
				storageState: { cookies: [], origins: [] },
			},
		},
	],
})
