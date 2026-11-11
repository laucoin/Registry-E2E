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
		// Le même menu est repris dans le tiroir de détail d'une ligne : seul celui affiché est utilisé.
		this._trigger = root.getByTestId('element-actions-button').filter({ visible: true });
	}

	public action(id: RowAction): Locator {
		return this.root.locator(`[data-test-id="element-actions-item"][data-id="${id}"]`).filter({ visible: true });
	}

	/** Ouvre le menu, pour lire quelles commandes sont proposées ou grisées. */
	public async openMenu(): Promise<void> {
		await this._trigger.click();
	}

	public async run(id: RowAction): Promise<void> {
		await this.openMenu();
		await this.action(id).click();
	}
}
