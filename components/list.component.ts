import type { Locator, Page } from '@playwright/test';

/**
 * Objectif: Lire les états communs à toutes les listes | Périmètre: chargement du lot suivant, filtres actifs et leur
 * réinitialisation, liste vide, aucun résultat, erreur de chargement | Limites: les lignes sont lues par la page.
 */
export class ListArea {
	public readonly loadMore: Locator;
	public readonly activeFilters: Locator;
	public readonly resetFilters: Locator;
	public readonly empty: Locator;
	public readonly noResult: Locator;
	public readonly error: Locator;

	constructor(page: Page) {
		this.loadMore = page.getByTestId('list-load-more');
		this.activeFilters = page.getByTestId('list-active-filters-tag');
		this.resetFilters = page.getByTestId('list-reset-filters-button');
		this.empty = page.getByTestId('list-empty-callout');
		this.noResult = page.getByTestId('list-no-result-callout');
		this.error = page.getByTestId('list-error');
	}
}
