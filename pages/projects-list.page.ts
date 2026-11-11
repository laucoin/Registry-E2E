import type { Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { DateTimePicker } from '@components/date-time-picker.component';
import { ElementRow, type RowAction } from '@components/element-row.component';

/**
 * Objectif: Parcourir la liste des projets et agir sur un projet | Périmètre: filtres, lignes, favoris, options, actions,
 * profil de support et avis de projet supprimé | Limites: sans le tri.
 */
export class ProjectsListPage {
	public readonly rows: Locator;
	public readonly confirmation: ConfirmationDialog;
	/** La dialog qui explique pourquoi un projet supprimé ne peut pas être rejoint. */
	public readonly hiddenNotice: Locator;
	/** Le filtre « Profil », que l'administrateur de la plateforme est seul à voir. */
	public readonly withProfile: Locator;
	/** L'encart affiché quand les filtres ne trouvent aucun projet. */
	public readonly noResult: Locator;
	/** Le filtre « Date & Heure » : les projets actifs à cet instant. */
	public readonly activeAt: DateTimePicker;
	/** Les options listées par la dialog qu'ouvre le bouton « Options » d'une ligne. */
	public readonly optionItems: Locator;
	private readonly _favorites: Locator;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('project-row');
		this.confirmation = new ConfirmationDialog(_page);
		this.hiddenNotice = _page.getByTestId('projects-list-hidden-dialog');
		this.withProfile = _page.getByTestId('projects-search-fields-with-profile-select');
		this.noResult = _page.getByTestId('list-no-result-callout');
		this.activeAt = new DateTimePicker(_page.getByTestId('projects-search-fields-at-picker'));
		this.optionItems = _page.getByTestId('projects-list-option-item');
		this._favorites = _page.getByTestId('projects-search-fields-is-favorite-select');
	}

	/** Ouvre la liste filtrée sur le texte donné, pour ne pas dépendre des projets créés par les autres scénarios. */
	public async goto(query: string): Promise<void> {
		await this._page.goto(`/projects?q=${encodeURIComponent(query)}`);
	}

	/** Élargit la liste aux projets dans lesquels le compte n'a pas de profil. */
	public async showAllProjects(): Promise<void> {
		await this.withProfile.click();
		await this.withProfile.getByRole('option', { name: 'Tous les projets' }).click();
	}

	public async showFavoritesOnly(): Promise<void> {
		await this._favorites.click();
		await this._favorites.getByRole('option', { name: 'Favoris', exact: true }).click();
	}

	/** L'étoile d'un projet, dont `aria-pressed` dit s'il est en favori. */
	public star(name: string): Locator {
		return this.row(name).root.getByTestId('favorite-toggle-toggled-button');
	}

	/** Le bouton « Options » d'un projet qui en a plusieurs. */
	public optionsButton(name: string): Locator {
		return this.row(name).root.getByTestId('project-row-status-options-button');
	}

	/** Le bouton « Profil support », proposé à l'administrateur de la plateforme sur un projet sans profil. */
	public supportButton(name: string): Locator {
		return this.row(name).root.getByTestId('project-row-status-create-support-button');
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
