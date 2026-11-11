import type { Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { ElementRow, type RowAction } from '@components/element-row.component';

/** Objectif: Parcourir la liste des entrées et sorties d'un projet et agir sur ses lignes | Périmètre: lignes et menu d'actions | Limites: sans filtres */
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

	/** Lance la commande sur la ligne puis la confirme. */
	public async runConfirmed(action: RowAction): Promise<void> {
		await this.only.run(action);
		await this.confirmation.confirm();
	}
}
