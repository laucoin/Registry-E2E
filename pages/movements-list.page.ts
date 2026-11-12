import type { Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { ElementRow, type RowAction } from '@components/element-row.component';

/** Objectif: Parcourir la liste des entrées et sorties d'un projet et agir sur ses lignes | Périmètre: filtres de type et de visibilité, lignes, compteurs et menu d'actions | Limites: sans les dates */
export class MovementsListPage {
	public readonly rows: Locator;
	public readonly confirmation: ConfirmationDialog;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('movement-row');
		this.confirmation = new ConfirmationDialog(_page);
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/movements`);
	}

	/** La seule ligne de la liste : les scénarios qui agissent sur un mouvement n'en créent qu'un. */
	public get only(): ElementRow {
		return new ElementRow(this.rows);
	}

	public get hiddenTag(): Locator {
		return this.rows.getByTestId('movement-element-hidden-tag');
	}

	/** Le filtre de visibilité, proposé seulement à ceux qui peuvent restaurer un mouvement. */
	public get visibilityFilter(): Locator {
		return this._page.getByTestId('movements-search-fields-is-visible-select');
	}

	/** Ne garde que les mouvements du type donné (« Entrée » ou « Sortie »). */
	public async filterType(label: string): Promise<void> {
		const select = this._page.getByTestId('movements-search-fields-type-select');
		await select.click();
		await select.getByRole('option', { name: label, exact: true }).click();
	}

	/** Ouvre la liste des participants d'un mouvement depuis son compteur, et la renvoie. */
	public async openParticipants(row: Locator): Promise<Locator> {
		await row.getByTestId('movement-details-participants-button').click();
		return row.getByTestId('movement-element-participants-drawer');
	}

	/** Ouvre les véhicules d'un mouvement depuis son compteur, et renvoie le tiroir. */
	public async openVehicles(row: Locator): Promise<Locator> {
		await row.getByTestId('movement-details-vehicles-button').click();
		return row.getByTestId('movement-element-vehicles-drawer');
	}

	/** Lance la commande sur la ligne puis la confirme. */
	public async runConfirmed(action: RowAction): Promise<void> {
		await this.only.run(action);
		await this.confirmation.confirm();
	}
}
