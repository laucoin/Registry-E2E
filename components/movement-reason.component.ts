import type { Locator } from '@playwright/test';

/** Objectif: Choisir le motif d'un mouvement | Périmètre: `app-movement-reason-select` | Limites: sans recherche saisie */
export class MovementReason {
	/** Le champ porte son message d'erreur dans l'attribut `error`. */
	public readonly field: Locator;
	public readonly options: Locator;

	constructor(root: Locator) {
		this.field = root.getByTestId('movement-reason-select-reason-select');
		this.options = this.field.getByRole('option');
	}

	public async open(): Promise<void> {
		await this.field.click();
	}

	/** Choisit un motif (ou une activité) par son libellé, en ouvrant la liste. */
	public async choose(label: string): Promise<void> {
		await this.open();
		await this.options.filter({ hasText: label }).click();
	}
}
