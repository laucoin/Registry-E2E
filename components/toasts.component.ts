import type { Locator, Page } from '@playwright/test';

/** Objectif: Lire les toasts de l'application | Périmètre: toasts d'erreur | Limites: ne les ferme pas */
export class Toasts {
	/** Les toasts sont créés par le web component `sgdf-toast`, sans data-test-id ni rôle : seule sa variante les distingue. */
	public readonly error: Locator;

	constructor(page: Page) {
		this.error = page.locator('sgdf-toast-item[variant="danger"]');
	}
}
