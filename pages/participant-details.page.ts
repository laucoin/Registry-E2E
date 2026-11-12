import type { Locator, Page } from '@playwright/test';

/**
 * Objectif: Lire les détails d'un participant hors de son formulaire | Périmètre: dialog de ses groupes, historique de
 * ses mouvements et frise de présence | Limites: sans les actions de l'historique.
 */
export class ParticipantDetailsPage {
	public readonly groupItems: Locator;
	public readonly movementRows: Locator;
	public readonly timeline: Locator;

	constructor(private readonly _page: Page) {
		this.groupItems = _page.getByTestId('participant-groups-dialog-group-item');
		this.movementRows = _page.getByTestId('movement-row');
		this.timeline = _page.getByTestId('participant-movements-list-timeline');
	}

	/** Le bouton « premier groupe et N autres » d'une ligne de participant, qui ouvre la dialog de ses groupes. */
	public groupsButton(row: Locator): Locator {
		return row.getByTestId('participant-row-groups-button');
	}

	/** Le choix de l'utilisateur lié, dans le formulaire du participant. */
	public get userSelect(): Locator {
		return this._page.getByTestId('participant-user-select-user-select');
	}
}
