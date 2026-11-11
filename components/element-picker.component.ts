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
	/** Les éléments déjà choisis, affichés sous le champ. */
	public readonly chosen: Locator;
	/** Le message affiché quand la recherche ne trouve rien. */
	public readonly noResult: Locator;

	constructor(private readonly _root: Locator) {
		this._combobox = _root.getByRole('combobox');
		this._search = _root.getByRole('searchbox');
		this.chosen = _root.getByTestId('select-elements-field-row');
		this.noResult = _root.getByText('Aucune personne ou groupe trouvé');
	}

	public async choose(name: string): Promise<void> {
		await (await this.search(name)).click();
		await expect(this.chosen.filter({ hasText: name })).toBeVisible();
	}

	/** Recherche le texte et renvoie les propositions qui portent ce nom, pour vérifier ce que le champ propose. */
	public async search(name: string): Promise<Locator> {
		await this._combobox.click();
		await this._search.fill(name);
		return this._root.getByRole('option', { name });
	}
}
