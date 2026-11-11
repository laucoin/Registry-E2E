import type { Locator } from '@playwright/test';

/** Les commandes du menu d'une ligne, identifiées comme dans le frontend (`data-id` des entrées du menu). */
export type RowAction = 'edit' | 'softDelete' | 'restore' | 'hardDelete' | 'movements-history' | 'members';

/**
 * Objectif: Lancer une commande du menu d'actions d'une ligne de liste | Périmètre: tout `app-element-actions` | Limites:
 * l'action principale affichée à côté du menu n'y figure pas.
 */
export class ElementRow {
	private readonly _trigger: Locator;

	constructor(public readonly root: Locator) {
		this._trigger = root.getByTestId('element-actions-button');
	}

	public action(id: RowAction): Locator {
		return this.root.locator(`[data-test-id="element-actions-item"][data-id="${id}"]`);
	}

	public async run(id: RowAction): Promise<void> {
		await this._trigger.click();
		await this.action(id).click();
	}
}
