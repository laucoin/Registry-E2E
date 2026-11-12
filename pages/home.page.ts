import type { Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';

/**
 * Objectif: Lire et utiliser l'accueil de l'application | Périmètre: projets favoris, invitations reçues, projets
 * demandant de l'attention, création de projet | Limites: sans les accès rapides.
 */
export class HomePage {
	public readonly favoriteCards: Locator;
	public readonly invitationRows: Locator;
	/** Les noms des projets demandant de l'attention, dans l'ordre affiché. */
	public readonly attentionNames: Locator;
	public readonly createButton: Locator;
	public readonly confirmation: ConfirmationDialog;

	constructor(private readonly _page: Page) {
		this.favoriteCards = _page.getByTestId('home-favorite-projects-card');
		this.invitationRows = _page.getByTestId('home-invitations-row');
		this.attentionNames = _page.getByTestId('home-attention-projects-project-name');
		this.createButton = _page.getByTestId('home-create-button');
		this.confirmation = new ConfirmationDialog(_page);
	}

	public async goto(): Promise<void> {
		await this._page.goto('/');
	}

	public favoriteCard(name: string): Locator {
		return this.favoriteCards.filter({ hasText: name });
	}

	/** Retire le projet des favoris depuis l'étoile de sa carte. */
	public async unfavorite(name: string): Promise<void> {
		await this.favoriteCard(name).getByTestId('home-favorite-projects-toggle').click();
	}

	public async openFavorite(name: string): Promise<void> {
		await this.favoriteCard(name).getByTestId('home-favorite-projects-tile').click();
	}

	public invitation(project: string): Locator {
		return this.invitationRows.filter({ hasText: project });
	}

	/** Accepte ou refuse une invitation, après confirmation. */
	public async answer(project: string, accept: boolean): Promise<void> {
		const button = accept ? 'home-invitations-accept-button' : 'home-invitations-refuse-button';
		await this.invitation(project).getByTestId(button).click();
		await this.confirmation.confirm();
	}

	public async openAttentionProject(name: string): Promise<void> {
		await this._page.getByTestId('home-attention-projects-project-link').filter({ hasText: name }).click();
	}
}
