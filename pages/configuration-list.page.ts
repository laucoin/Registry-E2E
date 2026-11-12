import type { Download, Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { downloadOf } from '@components/download.component';
import { ElementRow, type RowAction } from '@components/element-row.component';
import { ListArea } from '@components/list.component';
import { Toasts } from '@components/toasts.component';

/** Les listes de la configuration d'un projet : la section de l'URL et le préfixe des data-test-id de ses lignes. */
const SECTIONS = {
	participants: 'participant',
	groups: 'group',
	vehicles: 'vehicle',
	activities: 'activity',
} as const;
export type ConfigurationSection = keyof typeof SECTIONS;

/**
 * Objectif: Parcourir une liste de la configuration et agir sur ses lignes | Périmètre: participants, groupes, véhicules,
 * activités | Limites: sans recherche ni filtres.
 */
export class ConfigurationListPage {
	public readonly rows: Locator;
	public readonly confirmation: ConfirmationDialog;
	public readonly toasts: Toasts;
	public readonly list: ListArea;
	private readonly _create: Locator;

	constructor(
		private readonly _page: Page,
		private readonly _section: ConfigurationSection,
	) {
		this.rows = _page.getByTestId(`${SECTIONS[_section]}-row`);
		this._create = _page.getByTestId(`${_section}-list-create-button`);
		this.confirmation = new ConfirmationDialog(_page);
		this.toasts = new Toasts(_page);
		this.list = new ListArea(_page);
	}

	/** Ouvre la liste, avec les filtres donnés dans l'URL (`q`, `sort`…). */
	public async goto(projectId: string, query = ''): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/${this._section}${query}`);
	}

	public async reload(): Promise<void> {
		await this._page.reload();
	}

	/** Le champ de recherche textuelle ; la recherche part au changement, et tout de suite à Entrée. */
	public get search(): Locator {
		return this._page.getByTestId(`${this._section}-search-fields-q-input`).getByRole('textbox');
	}

	/** Le filtre de visibilité, proposé seulement à ceux qui peuvent restaurer. */
	public get visibilityFilter(): Locator {
		return this._page.getByTestId(`${this._section}-search-fields-is-visible-select`);
	}

	public get createButton(): Locator {
		return this._create;
	}

	/** Fait échouer le prochain chargement de la liste avec l'erreur donnée par le backend. */
	public async failNextLoad(status: number, detail: string): Promise<void> {
		await this._failNext(`**/api/v2/projects/*/${this._section}?**`, status, detail);
	}

	/** Fait échouer la prochaine suppression d'un élément de la liste avec l'erreur donnée par le backend. */
	public async failNextSoftDelete(status: number, detail: string): Promise<void> {
		await this._failNext(`**/api/v2/projects/*/${this._section}/*/disable`, status, detail);
	}

	public async openCreation(): Promise<void> {
		await this._create.click();
	}

	/** La ligne qui contient le texte donné (nom, plaque…). */
	public row(text: string): ElementRow {
		return new ElementRow(this.rows.filter({ hasText: text }));
	}

	/** L'action principale d'une ligne, affichée à côté du menu (p. ex. les membres d'un groupe). */
	public primaryAction(text: string): Locator {
		return this.row(text).root.getByTestId('element-primary-action-button');
	}

	/** Le statut d'une ligne (présence d'un participant, disponibilité d'un véhicule…). */
	public statusTag(text: string): Locator {
		return this.row(text).root.getByTestId(`${SECTIONS[this._section]}-row-status-tag`);
	}

	/** Lance une commande qui télécharge un fichier et renvoie ce fichier. */
	public async download(text: string, action: RowAction): Promise<Download> {
		return downloadOf(this._page, () => this.run(text, action));
	}

	/** Le tag « supprimé » d'une ligne. */
	public hiddenTag(text: string): Locator {
		return this.row(text).root.getByTestId(`${SECTIONS[this._section]}-row-hidden-tag`);
	}

	public async run(text: string, action: RowAction): Promise<void> {
		await this.row(text).run(action);
	}

	/** Lance la commande puis la confirme, avec la phrase à saisir pour une suppression définitive. */
	public async runConfirmed(text: string, action: RowAction, phrase?: string): Promise<void> {
		await this.run(text, action);
		await this.confirmation.confirm(phrase);
	}

	private async _failNext(url: string, status: number, detail: string): Promise<void> {
		await this._page.route(
			url,
			(route) =>
				route.fulfill({
					status,
					contentType: 'application/problem+json',
					body: JSON.stringify({ type: 'about:blank', status, title: 'Erreur', detail }),
				}),
			{ times: 1 },
		);
	}
}
