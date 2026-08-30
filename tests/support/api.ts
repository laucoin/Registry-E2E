import { type APIRequestContext, type APIResponse, expect, type Page } from '@playwright/test'

/**
 * Every mutating call through the BFF carries the CSRF token the session mints.
 * It is per-session and stable, so it is fetched once per helper and
 * reused rather than re-read before every write.
 *
 * The asserting/raw split is what makes refusal journeys writable at all: `get`,
 * `post`, `patch` and `remove` fail on a non-2xx so a broken seed reports at its
 * own line, while `raw` hands back the untouched response — a scenario whose
 * whole point is a 403 or a 409 cannot be expressed through an asserting helper.
 */
export interface RegistryApi {
	readonly request: APIRequestContext
	get: <T>(url: string) => Promise<T>
	post: <T>(url: string, data?: unknown) => Promise<T>
	patch: <T>(url: string, data?: unknown) => Promise<T>
	remove: (url: string) => Promise<void>
	raw: (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, data?: unknown) => Promise<APIResponse>
	/**
	 * Deletes without asserting: a teardown may be cleaning up something the test
	 * already removed, or something it has just lost access to.
	 */
	discard: (url: string) => Promise<void>
}

export async function csrf(request: APIRequestContext): Promise<string> {
	const me = await request.get('/auth/me')
	return (await me.json()).csrf
}

export function registryApi(source: Page | APIRequestContext): RegistryApi {
	const request = 'request' in source ? source.request : source
	let token: string | undefined

	async function headers(): Promise<Record<string, string>> {
		token ??= await csrf(request)
		return { 'x-csrf-token': token }
	}

	async function raw(
		method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
		url: string,
		data?: unknown,
	): Promise<APIResponse> {
		if (method === 'GET') {
			return request.get(url)
		}
		const options = { headers: await headers(), ...(data === undefined ? {} : { data }) }
		if (method === 'POST') {
			return request.post(url, options)
		}
		if (method === 'PATCH') {
			return request.patch(url, options)
		}
		return request.delete(url, options)
	}

	async function ok(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, data?: unknown): Promise<APIResponse> {
		const response = await raw(method, url, data)
		expect(response.ok(), `${method} ${url} (${response.status()})`).toBeTruthy()
		return response
	}

	/**
	 * Several v2 verbs (disable, enable, accept, block, …) answer 204 with no
	 * body, so the payload is parsed defensively rather than assumed.
	 */
	async function body<T>(response: APIResponse): Promise<T> {
		const text = await response.text()
		return (text ? JSON.parse(text) : undefined) as T
	}

	return {
		request,
		raw,
		get: async <T>(url: string) => body<T>(await ok('GET', url)),
		post: async <T>(url: string, data?: unknown) => body<T>(await ok('POST', url, data)),
		patch: async <T>(url: string, data?: unknown) => body<T>(await ok('PATCH', url, data)),
		remove: async (url: string) => {
			await ok('DELETE', url)
		},
		discard: async (url: string) => {
			await raw('DELETE', url).catch(() => undefined)
		},
	}
}
