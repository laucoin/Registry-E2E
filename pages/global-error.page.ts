import type { Locator, Page } from '@playwright/test';

/** Le corps d'erreur que le backend renvoie (RFC 7807), dont le frontend affiche le titre et le détail. */
export interface Problem {
	title: string;
	detail: string;
}

/**
 * Objectif: Provoquer et lire la page d'erreur globale | Périmètre: échec du chargement de l'utilisateur courant, bouton
 * « Réessayer » | Limites: l'échec est simulé une seule fois, au premier appel.
 */
export class GlobalErrorPage {
	public readonly callout: Locator;
	private readonly _retry: Locator;

	constructor(private readonly _page: Page) {
		this.callout = _page.getByTestId('global-error-callout');
		this._retry = _page.getByTestId('global-error-retry-button');
	}

	/** Fait échouer le prochain chargement de l'utilisateur courant avec l'erreur donnée ; les suivants passent. */
	public async failNextUserLoad(status: number, problem: Problem): Promise<void> {
		await this._page.route(
			'**/api/v2/authentication/user/current',
			(route) =>
				route.fulfill({
					status,
					contentType: 'application/problem+json',
					body: JSON.stringify({ type: 'about:blank', status, ...problem }),
				}),
			{ times: 1 },
		);
	}

	public async retry(): Promise<void> {
		await this._retry.click();
	}
}
