import type { Locator, Page } from '@playwright/test';

import { CommunicationsDrawer } from '@components/communications-drawer.component';
import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { DateTimePicker } from '@components/date-time-picker.component';
import { ElementRow, type RowAction } from '@components/element-row.component';
import { Toasts } from '@components/toasts.component';

/** Objectif: Parcourir la liste des alertes d'un projet et agir sur une alerte | Périmètre: statistiques, filtres, lignes, statut, menu d'actions | Limites: sans le tri */
export class AlertsListPage {
	public readonly rows: Locator;
	public readonly confirmation: ConfirmationDialog;
	public readonly toasts: Toasts;
	/** Les statistiques du projet, dont le contenu se lit dans l'arbre d'accessibilité (leur texte est dans le shadow DOM). */
	public readonly resolutionStat: Locator;
	public readonly rateStat: Locator;
	/** Le filtre « Après le ». */
	public readonly after: DateTimePicker;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('alert-row');
		this.confirmation = new ConfirmationDialog(_page);
		this.toasts = new Toasts(_page);
		this.resolutionStat = _page.getByRole('group', { name: 'Temps moyen de résolution' });
		this.rateStat = _page.getByRole('group', { name: 'Taux d’alertes réelles' });
		this.after = new DateTimePicker(_page.getByTestId('alerts-search-fields-from-picker'));
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/alerts`);
	}

	/** Filtre sur le titre ; la recherche part à la validation du champ. */
	public async search(text: string): Promise<void> {
		const input = this._page.getByTestId('alerts-search-fields-q-input').getByRole('textbox');
		await input.fill(text);
		await input.press('Enter');
	}

	/** Ne garde que les alertes du statut donné (« En cours », « Résolue », « Annulée »). */
	public async filterStatus(label: string): Promise<void> {
		const select = this._page.getByTestId('alerts-search-fields-status-select');
		await select.click();
		await select.getByRole('option', { name: label, exact: true }).click();
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
