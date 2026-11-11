import type { Locator } from '@playwright/test';

/** Une date et une heure au format de saisie de l'UI : jj/mm/aaaa et hh:mm. */
export interface UiDateTime {
	date: string;
	time: string;
}

/** Objectif: Saisir et lire un `sgdf-date-time-picker` avec heure | Périmètre: tout champ date et heure séparées | Limites: sans le calendrier */
export class DateTimePicker {
	public readonly date: Locator;
	public readonly time: Locator;

	constructor(root: Locator) {
		this.date = root.getByPlaceholder('jj/mm/aaaa');
		this.time = root.getByPlaceholder('hh:mm');
	}

	public async fill(value: UiDateTime | undefined): Promise<void> {
		if (!value) return;
		await this.date.fill(value.date);
		await this.time.fill(value.time);
	}
}
