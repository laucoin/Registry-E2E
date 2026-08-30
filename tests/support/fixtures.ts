import { type BrowserContext, type Page, test as base } from '@playwright/test'
import { account, type Actor, storageStatePath } from './actors'
import { registryApi, type RegistryApi } from './api'
import {
	type AccessWindow,
	createProject,
	deleteProject,
	inviteAndAccept,
	type ProjectOption,
	type ProjectRole,
	uniqueName,
} from './domain'

export interface ProjectHandle {
	id: string
	name: string
}

export interface ProjectFactory {
	create: (options?: { name?: string, options?: ProjectOption[], as?: Actor }) => Promise<ProjectHandle>
}

export interface RegistryFixtures {
	actor: Actor
	api: RegistryApi
	projects: ProjectFactory
	project: ProjectHandle
	pageAs: (who: Actor) => Promise<Page>
	apiAs: (who: Actor) => Promise<RegistryApi>
	grantRole: (projectId: string, who: Actor, role: ProjectRole, access?: AccessWindow) => Promise<string>
}

export const test = base.extend<RegistryFixtures>({
	/**
	 * Which account the default `page` carries. Overridden per file with
	 * `test.use(actAs('member'))`; `api` follows it automatically, so the actor
	 * and its session can never drift apart.
	 */
	actor: ['admin', { option: true }],

	api: async ({ page }, use) => {
		await use(registryApi(page))
	},

	/**
	 * `apiAs` is destructured here on purpose even though `create` reaches it
	 * through a closure: Playwright tears a fixture down before the fixtures it
	 * declares a dependency on, and the dependency is read from the SIGNATURE.
	 * Without it, a context opened by `pageAs` could be closed before this
	 * teardown tries to delete a project created through it.
	 */
	projects: async ({ api, apiAs }, use, testInfo) => {
		const created: Array<{ id: string, owner: RegistryApi }> = []
		await use({
			async create(options = {}) {
				const owner = options.as ? await apiAs(options.as) : api
				const name = uniqueName(options.name ?? testInfo.title)
				const id = await createProject(owner, name, options.options ?? [])
				created.push({ id, owner })
				return { id, name }
			},
		})
		for (const { id, owner } of created.reverse()) {
			await deleteProject(owner, id)
		}
	},

	/**
	 * A project per test, deleted on teardown whatever the test did. This
	 * replaces both lifecycle shapes the suite used to carry — the module-level
	 * `let projectId` with its `if (projectId)` guard, and the inline
	 * try/finally — and closes the leak where a throwing seed skipped the
	 * finally because the project was created outside it.
	 */
	project: async ({ projects }, use) => {
		await use(await projects.create())
	},

	/**
	 * Playwright's `page` is bound to ONE storageState, so a second identity
	 * needs its own context. Contexts are built lazily and cached per account:
	 * two live contexts for the same account would each hold a copy of the same
	 * sealed session, and whichever refreshed its token first would invalidate
	 * the other's.
	 *
	 * Tracing is NOT started here — `use.trace` in playwright.config.ts already
	 * instruments every context made from the `browser` fixture, and calling
	 * tracing.start() on top of that throws "Tracing has been already started".
	 */
	pageAs: async ({ browser, baseURL, actor }, use) => {
		const opened = new Map<Actor, { context: BrowserContext, page: Page }>()
		await use(async (who) => {
			if (who === actor) {
				throw new Error(`pageAs('${who}') is the active actor — use the \`page\` fixture`)
			}
			const cached = opened.get(who)
			if (cached) {
				return cached.page
			}
			const context = await browser.newContext({
				baseURL,
				storageState: storageStatePath(who),
			})
			const page = await context.newPage()
			opened.set(who, { context, page })
			return page
		})
		for (const { context } of opened.values()) {
			await context.close()
		}
	},

	apiAs: async ({ api, actor, pageAs }, use) => {
		await use(async who => who === actor ? api : registryApi(await pageAs(who)))
	},

	/**
	 * The membership handshake, plus the rule that keeps role journeys stable:
	 * an INVITED profile grants nothing until accepted, and the Nuxt session
	 * resolves a project's scoped authorities during SSR — so the invitee's page
	 * must make a FRESH goto after this returns, never reload a page rendered
	 * before the grant.
	 */
	grantRole: async ({ api, apiAs }, use) => {
		await use(async (projectId, who, role, access = {}) => {
			const invitee = await apiAs(who)
			return inviteAndAccept(api, invitee, projectId, account(who).email, role, access)
		})
	},
})

export { expect } from '@playwright/test'

/**
 * Run a whole describe as another identity: the default `page` then carries that
 * account's session, with Playwright's own trace, video and screenshot handling,
 * and `api` addresses the BFF as them.
 */
export function actAs(who: Actor) {
	return { actor: who, storageState: storageStatePath(who) }
}

export { account }
