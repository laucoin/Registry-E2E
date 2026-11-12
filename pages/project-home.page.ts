import type { Locator, Page } from '@playwright/test';

import { CommunicationsDrawer } from '@components/communications-drawer.component';
import { AlertFormPage } from '@pages/alert-form.page';

/**
 * Objectif: Lire et utiliser le tableau de bord d'un projet | Périmètre: titre et favori, actions rapides, statuts des
 * participants et des véhicules, présences à régulariser, alertes en cours, arrivées et départs du jour, activités en
 * cours | Limites: sans les anniversaires.
 */
export class ProjectHomePage {
	/** La ligne des trois compteurs (inscrits présents, inscrits en sortie, invités présents), dont le nom accessible porte les valeurs. */
	public readonly participantStats: Locator;
	public readonly title: Locator;
	/** Les alertes en cours affichées sur l'accueil. */
	public readonly activeAlerts: Locator;
	public readonly alertDrawer: Locator;
	public readonly alertForm: AlertFormPage;
	/** Les arrivées et départs prévus aujourd'hui ; un clic sur une ligne ouvre le formulaire de mouvement prérempli. */
	public readonly plannedArrivals: Locator;
	public readonly plannedDepartures: Locator;
	/** Les sorties en activité encore en cours (onglet « Activités en cours »). */
	public readonly activityRows: Locator;
	private readonly _newAlert: Locator;

	constructor(private readonly _page: Page) {
		this.title = _page.getByTestId('project-home-title');
		this.activeAlerts = _page.getByTestId('project-active-alert-cards');
		this.alertDrawer = _page.getByTestId('project-home-alert-drawer');
		this.alertForm = AlertFormPage.in(_page, 'project-home-alert-form');
		this._newAlert = _page.getByTestId('project-home-alert-button');
		this.activityRows = _page.getByRole('list', { name: 'Activités en cours' }).getByTestId('movement-row');
		this.plannedArrivals = _page
			.getByRole('list', { name: 'Arrivées du jour' })
			.getByTestId('planned-movement-card-row');
		this.plannedDepartures = _page
			.getByRole('list', { name: 'Départs du jour' })
			.getByTestId('planned-movement-card-row');
		this.participantStats = _page
			.getByTestId('project-participant-overview-card')
			.getByRole('row', { name: /Inscrits présents/ });
	}

	public get vehicleCard(): Locator {
		return this._page.getByTestId('project-vehicle-overview-card');
	}

	/** La ligne des compteurs de véhicules (présents, en sortie), dont le nom accessible porte les valeurs. */
	public get vehicleStats(): Locator {
		return this.vehicleCard.getByRole('row', { name: /Présents/ });
	}

	/** Les participants à régulariser (départ prévu dépassé sans sortie définitive). */
	public get regularizationRows(): Locator {
		return this._page.getByRole('list', { name: 'Présences à régulariser' }).getByTestId('participant-row');
	}

	public get regularizationSeeAll(): Locator {
		return this._page.getByTestId('project-participant-regularization-see-all-button');
	}

	/** L'étoile du titre, dont `aria-pressed` dit si le projet est en favori. */
	public get favorite(): Locator {
		return this._page.getByTestId('project-home-favorite-toggle').getByTestId('favorite-toggle-toggled-button');
	}

	public get registeredMovementButton(): Locator {
		return this._page.getByTestId('project-home-registered-movement-button');
	}

	public get guestMovementButton(): Locator {
		return this._page.getByTestId('project-home-guest-movement-button');
	}

	/** Le bouton « Communiquer » des cartes d'alerte, et le tiroir qu'il ouvre. */
	public get communicateButtons(): Locator {
		return this._page.getByTestId('active-alert-card-communicate-button');
	}

	public get communicationDrawer(): Locator {
		return this._page.getByTestId('project-active-alert-drawer');
	}

	/** Les autres entrées et sorties en cours (sans activité quand l'option est active). */
	public get otherMovementRows(): Locator {
		return this._page.getByRole('list', { name: 'Autres entrées/sorties en cours' }).getByTestId('movement-row');
	}

	/** Ouvre les communications d'un mouvement en cours depuis sa ligne. */
	public async openCommunications(row: Locator): Promise<CommunicationsDrawer> {
		await row.getByTestId('movement-element-communications-button').click();
		return new CommunicationsDrawer(row.getByTestId('movement-element-communications-drawer'));
	}

	/** Ouvre l'onglet des autres entrées et sorties, présent quand l'option activités sépare les deux listes. */
	public async openOtherMovementsTab(): Promise<void> {
		await this._page
			.getByTestId('project-operational-monitoring-tab')
			.and(this._page.locator('[data-id="otherMovements"]'))
			.click();
	}

	/** La ligne à régulariser d'un participant, par son identifiant. */
	public regularizationRow(participantId: string): Locator {
		return this.regularizationRows.and(this._page.locator(`[data-id="${participantId}"]`));
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}`);
	}

	/** Ouvre l'accueil et descend jusqu'au suivi opérationnel, chargé seulement quand il entre dans la fenêtre. */
	public async gotoMonitoring(projectId: string): Promise<void> {
		await this.goto(projectId);
		await this.participantStats.waitFor();
		await this._page.keyboard.press('End');
	}

	/** Ouvre la liste des participants d'une activité en cours depuis son compteur, et la renvoie. */
	public async openActivityParticipants(activity: string): Promise<Locator> {
		const row = this.activityRows.filter({ hasText: activity });
		await row.getByTestId('movement-details-participants-button').click();
		return row.getByTestId('movement-element-participants-drawer');
	}

	/** « Faire rentrer » : ouvre l'entrée préremplie avec les participants de l'activité encore dehors. */
	public async bringBack(activity: string): Promise<void> {
		await this.activityRows.filter({ hasText: activity }).getByTestId('movement-element-reverse-button').click();
	}

	public async openAlertCreation(): Promise<void> {
		await this._newAlert.click();
	}
}
