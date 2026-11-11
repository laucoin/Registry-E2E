import type { APIResponse } from '@playwright/test';

/** Le code d'erreur d'une réponse refusée par le backend (champ `code` du corps RFC 7807), précédé de son statut. */
export async function rejection(response: APIResponse): Promise<string> {
	const body = (await response.json()) as { code?: string };
	return `${response.status()} ${body.code ?? ''}`.trim();
}
