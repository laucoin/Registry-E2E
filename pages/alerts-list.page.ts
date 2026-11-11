import type { Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { ElementRow, type RowAction } from '@components/element-row.component';
import { Toasts } from '@components/toasts.component';

/** Objectif: Parcourir la liste des alertes d'un projet et agir sur une alerte | Périmètre: lignes, statut, menu d'actions | Limites: sans filtres */
export class AlertsListPage {
	public readonly rows: Locator;
	public readonly confirmation: ConfirmationDialog;
	public readonly toasts: Toasts;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('alert-row');
		this.confirmation = new ConfirmationDialog(_page);
		this.toasts = new Toasts(_page);
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/alerts`);
	}

	/** La ligne de l'alerte qui porte ce titre. */
	public row(title: string): ElementRow {
		return new ElementRow(this.rows.filter({ hasText: title }));
	}

	public status(title: string): Locator {
		return this.row(title).root.getByTestId('alert-element-status');
	}

	public hiddenTag(title: string): Locator {
		return this.row(title).root.getByTestId('alert-element-hidden-tag');
	}

	/** Lance la commande puis la confirme. */
	public async runConfirmed(title: string, action: RowAction): Promise<void> {
		await this.row(title).run(action);
		await this.confirmation.confirm();
	}
}
