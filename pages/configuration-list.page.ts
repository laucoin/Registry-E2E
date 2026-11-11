import type { Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { ElementRow, type RowAction } from '@components/element-row.component';
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
	private readonly _create: Locator;

	constructor(
		private readonly _page: Page,
		private readonly _section: ConfigurationSection,
	) {
		this.rows = _page.getByTestId(`${SECTIONS[_section]}-row`);
		this._create = _page.getByTestId(`${_section}-list-create-button`);
		this.confirmation = new ConfirmationDialog(_page);
		this.toasts = new Toasts(_page);
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/${this._section}`);
	}

	public async openCreation(): Promise<void> {
		await this._create.click();
	}

	/** La ligne qui contient le texte donné (nom, plaque…). */
	public row(text: string): ElementRow {
		return new ElementRow(this.rows.filter({ hasText: text }));
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
}
