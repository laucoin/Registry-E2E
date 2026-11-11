import type { Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { ElementRow, type RowAction } from '@components/element-row.component';

/** Objectif: Parcourir la liste des projets et agir sur un projet | Périmètre: lignes, actions et avis de projet supprimé | Limites: sans filtres autres que le texte */
export class ProjectsListPage {
	public readonly rows: Locator;
	public readonly confirmation: ConfirmationDialog;
	/** La dialog qui explique pourquoi un projet supprimé ne peut pas être rejoint. */
	public readonly hiddenNotice: Locator;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('project-row');
		this.confirmation = new ConfirmationDialog(_page);
		this.hiddenNotice = _page.getByTestId('projects-list-hidden-dialog');
	}

	/** Ouvre la liste filtrée sur le texte donné, pour ne pas dépendre des projets créés par les autres scénarios. */
	public async goto(query: string): Promise<void> {
		await this._page.goto(`/projects?q=${encodeURIComponent(query)}`);
	}

	public row(name: string): ElementRow {
		return new ElementRow(this.rows.filter({ hasText: name }));
	}

	public hiddenTag(name: string): Locator {
		return this.row(name).root.getByTestId('project-row-status-hidden-tag');
	}

	/** Le bouton « Rejoindre » d'un projet, grisé quand le projet est supprimé. */
	public join(name: string): Locator {
		return this.row(name).root.getByTestId('project-row-status-select-button');
	}

	/** Lance la commande puis la confirme, avec la phrase à saisir pour une suppression définitive. */
	public async runConfirmed(name: string, action: RowAction, phrase?: string): Promise<void> {
		await this.row(name).run(action);
		await this.confirmation.confirm(phrase);
	}
}
