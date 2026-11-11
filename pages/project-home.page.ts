import type { Locator, Page } from '@playwright/test';

/** Objectif: Lire le tableau de bord d'un projet | Périmètre: statut des participants | Limites: les autres widgets viendront avec leurs tests */
export class ProjectHomePage {
	/** La ligne des trois compteurs (inscrits présents, inscrits en sortie, invités présents), dont le nom accessible porte les valeurs. */
	public readonly participantStats: Locator;

	constructor(private readonly _page: Page) {
		this.participantStats = _page
			.getByTestId('project-participant-overview-card')
			.getByRole('row', { name: /Inscrits présents/ });
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}`);
	}
}
