import type { Locator, Page } from '@playwright/test';

/** Objectif: Lire la liste des alertes d'un projet | Périmètre: lignes | Limites: sans filtres ni actions */
export class AlertsListPage {
	public readonly rows: Locator;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('alert-row');
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/alerts`);
	}
}
