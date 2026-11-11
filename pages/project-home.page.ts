import type { Locator, Page } from '@playwright/test';

import { AlertFormPage } from '@pages/alert-form.page';

/** Objectif: Lire le tableau de bord d'un projet | Périmètre: titre, statut des participants, alertes en cours et création d'alerte | Limites: les autres widgets viendront avec leurs tests */
export class ProjectHomePage {
	/** La ligne des trois compteurs (inscrits présents, inscrits en sortie, invités présents), dont le nom accessible porte les valeurs. */
	public readonly participantStats: Locator;
	public readonly title: Locator;
	/** Les alertes en cours affichées sur l'accueil. */
	public readonly activeAlerts: Locator;
	public readonly alertDrawer: Locator;
	public readonly alertForm: AlertFormPage;
	private readonly _newAlert: Locator;

	constructor(private readonly _page: Page) {
		this.title = _page.getByTestId('project-home-title');
		this.activeAlerts = _page.getByTestId('project-active-alert-cards');
		this.alertDrawer = _page.getByTestId('project-home-alert-drawer');
		this.alertForm = AlertFormPage.in(_page, 'project-home-alert-form');
		this._newAlert = _page.getByTestId('project-home-alert-button');
		this.participantStats = _page
			.getByTestId('project-participant-overview-card')
			.getByRole('row', { name: /Inscrits présents/ });
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}`);
	}

	public async openAlertCreation(): Promise<void> {
		await this._newAlert.click();
	}
}
