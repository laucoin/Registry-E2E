import type { Locator, Page } from '@playwright/test';

/** Objectif: Lire la liste des entrées et sorties d'un projet | Périmètre: lignes de mouvement | Limites: sans filtres ni actions */
export class MovementsListPage {
	public readonly rows: Locator;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('movement-row');
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/movements`);
	}
}
