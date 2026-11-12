import type { Locator, Page } from '@playwright/test';

/**
 * Objectif: Suivre la présence des participants d'un projet | Périmètre: onglet individuel, statut et retard de chaque
 * participant, filtre de présence | Limites: sans les onglets par groupe.
 */
export class ParticipantsMonitoringPage {
	public readonly rows: Locator;
	private readonly _statusFilter: Locator;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('participants-monitoring-individual-list').getByTestId('participant-row');
		this._statusFilter = _page.getByTestId('participants-search-fields-status-select');
	}

	/** Ouvre le suivi sur l'onglet de chaque participant pris individuellement. */
	public async gotoIndividuals(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/participants`);
		await this._page
			.getByTestId('participants-monitoring-tab')
			.and(this._page.locator('[data-id="individual"]'))
			.click();
	}

	public row(name: string): Locator {
		return this.rows.filter({ hasText: name });
	}

	public status(name: string): Locator {
		return this.row(name).getByTestId('monitoring-row-status');
	}

	/** L'indication de retard d'un participant censé être revenu. */
	public overdue(name: string): Locator {
		return this.row(name).getByTestId('monitoring-row-overdue');
	}

	public async filterStatus(label: string): Promise<void> {
		await this._statusFilter.click();
		await this._statusFilter.getByRole('option', { name: label, exact: true }).click();
	}
}
