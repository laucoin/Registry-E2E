import type { Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { ElementRow } from '@components/element-row.component';

/**
 * Objectif: Lire les profils d'un projet ou les invitations du compte, et répondre à une invitation | Périmètre: lignes
 * de profil, bouton « Accepter » | Limites: sans le menu d'actions.
 */
export class ProfilesListPage {
	public readonly rows: Locator;
	public readonly confirmation: ConfirmationDialog;
	public readonly inviteButton: Locator;
	/** L'erreur de chargement de la liste. */
	public readonly loadError: Locator;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('profile-row');
		this.confirmation = new ConfirmationDialog(_page);
		this.inviteButton = _page.getByTestId('project-profiles-list-few-button');
		this.loadError = _page.getByTestId('list-error');
	}

	public async gotoProject(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/profiles`);
	}

	public async gotoInvitations(): Promise<void> {
		await this._page.goto('/my-account/invitations');
	}

	public row(text: string): Locator {
		return this.rows.filter({ hasText: text });
	}

	/** Le statut d'un profil (« Invité », « Accepté »…). */
	public status(text: string): Locator {
		return this.row(text).getByTestId('project-profile-row-status-tag');
	}

	/** Le menu d'actions d'un profil. */
	public menu(text: string): ElementRow {
		return new ElementRow(this.row(text));
	}

	public acceptButton(text: string): Locator {
		return this.row(text).getByTestId('project-profile-row-accept-button');
	}

	/** Accepte l'invitation, après confirmation. */
	public async accept(text: string): Promise<void> {
		await this.acceptButton(text).click();
		await this.confirmation.confirm();
	}
}
