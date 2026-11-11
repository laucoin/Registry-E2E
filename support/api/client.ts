import { type APIRequestContext, type APIResponse, request } from '@playwright/test';

import { type Account, authFile } from '@support/accounts';

const API_PREFIX = '/api/v2';
const CSRF_HEADER = 'X-XSRF-TOKEN';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/** Client d'API authentifié d'un compte, qui réutilise les cookies de session stockés par le global setup. */
export class ApiClient {
	private _csrfToken?: string;

	private constructor(private readonly _context: APIRequestContext) {}

	public static async as(account: Account): Promise<ApiClient> {
		const context = await request.newContext({
			baseURL: process.env.API_URL ?? 'http://localhost:8081',
			storageState: authFile(account),
		});
		return new ApiClient(context);
	}

	/** Envoie la requête et renvoie le corps analysé ; lève une erreur avec le corps de la réponse pour un statut non 2xx. */
	public async send<T = unknown>(method: Method, path: string, data?: unknown): Promise<T> {
		const response = await this.raw(method, path, data);
		if (!response.ok()) {
			throw new Error(`${method} ${path} -> ${response.status()}: ${await response.text()}`);
		}
		const text = await response.text();
		return (text ? JSON.parse(text) : undefined) as T;
	}

	/** Envoie la requête et renvoie la réponse telle quelle, pour les scénarios qui attendent une erreur. */
	public async raw(
		method: Method,
		path: string,
		data?: unknown,
		extraHeaders: Record<string, string> = {},
	): Promise<APIResponse> {
		const headers = method === 'GET' ? extraHeaders : { [CSRF_HEADER]: await this._token(), ...extraHeaders };
		return this._context.fetch(`${API_PREFIX}${path}`, { method, data, headers });
	}

	/** Le backend dérive un jeton CSRF sans état du jeton d'accès et le renvoie à chaque réponse. */
	private async _token(): Promise<string> {
		if (!this._csrfToken) {
			const response = await this._context.get(`${API_PREFIX}/authentication/user/current`);
			this._csrfToken = response.headers()[CSRF_HEADER.toLowerCase()];
			if (!this._csrfToken) throw new Error(`No ${CSRF_HEADER} header returned (status ${response.status()})`);
		}
		return this._csrfToken;
	}

	public dispose(): Promise<void> {
		return this._context.dispose();
	}
}
