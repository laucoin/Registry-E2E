import { expect, type Locator } from '@playwright/test';

/**
 * Objectif: Choisir des éléments (participants, groupes) dans un champ de sélection avec recherche | Périmètre: tout
 * `app-select-elements-field` du frontend | Limites: ne retire pas d'élément déjà choisi.
 *
 * La recherche est saisie plutôt que de parcourir la liste ouverte : la liste ne propose que ce qui correspond au texte tapé,
 * ce qui rend le choix indépendant du nombre d'éléments du projet.
 */
export class ElementPicker {
	private readonly _combobox: Locator;
	private readonly _search: Locator;
	private readonly _chosen: Locator;

	constructor(private readonly _root: Locator) {
		this._combobox = _root.getByRole('combobox');
		this._search = _root.getByRole('searchbox');
		this._chosen = _root.getByTestId('select-elements-field-row');
	}

	public async choose(name: string): Promise<void> {
		await this._combobox.click();
		await this._search.fill(name);
		await this._root.getByRole('option', { name }).click();
		await expect(this._chosen.filter({ hasText: name })).toBeVisible();
	}
}
