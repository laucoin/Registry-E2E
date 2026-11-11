import type { Locator, Page } from '@playwright/test';

import { DateTimePicker } from '@components/date-time-picker.component';

export type MovementType = 'IN' | 'OUT';

const TYPE_LABELS: Record<MovementType, string> = { IN: 'Entrée', OUT: 'Sortie' };

/**
 * Objectif: Remplir la première étape d'un formulaire de mouvement | Périmètre: date, type, annuler, suivant, pour les
 * inscrits comme pour les invités | Limites: le contenu du mouvement est piloté par le page object du formulaire.
 */
export class MovementInformationStep {
	public readonly dateTime: DateTimePicker;
	public readonly cancel: Locator;
	private readonly _type: Locator;
	private readonly _next: Locator;

	constructor(private readonly _page: Page) {
		this.dateTime = new DateTimePicker(_page.getByTestId('movement-information-step-date-time-picker'));
		this.cancel = _page.getByTestId('movement-information-step-cancel-button');
		this._type = _page.getByTestId('movement-information-step-type-select');
		this._next = _page.getByTestId('movement-information-step-next-submit');
	}

	/** Choisit le type puis passe à l'étape du contenu. */
	public async continueAs(type: MovementType): Promise<void> {
		await this._type.click();
		await this._page.getByRole('option', { name: TYPE_LABELS[type], exact: true }).click();
		await this._next.click();
	}
}
