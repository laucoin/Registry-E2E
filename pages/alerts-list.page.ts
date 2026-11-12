import type { Locator, Page } from '@playwright/test';

import { CommunicationsDrawer } from '@components/communications-drawer.component';
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

	/**
	 * Fait comme si l'auteur des communications des alertes avait été supprimé : l'API répond sans créateur ni dernier
	 * éditeur, ce qu'aucune requête ne permet de produire autrement que par la suppression d'un compte.
	 */
	public async withoutCommunicationAuthors(): Promise<void> {
		await this._page.route('**/api/v2/projects/*/alerts/*/communications**', async (route) => {
			const response = await route.fetch();
			const page = (await response.json()) as { content: Record<string, unknown>[] };
			const content = page.content.map((communication) => ({
				...communication,
				creation: null,
				lastEdition: null,
			}));
			await route.fulfill({ response, json: { ...page, content } });
		});
	}

	/** Ouvre les communications d'une alerte depuis sa ligne. */
	public async openCommunications(title: string): Promise<CommunicationsDrawer> {
		const row = this.row(title).root;
		await row.getByTestId('alert-element-communications-button').click();
		return new CommunicationsDrawer(row.getByTestId('alert-element-communications-drawer'));
	}

	/** Lance la commande puis la confirme. */
	public async runConfirmed(title: string, action: RowAction): Promise<void> {
		await this.row(title).run(action);
		await this.confirmation.confirm();
	}
}
