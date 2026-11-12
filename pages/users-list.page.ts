import type { Download, Locator, Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { downloadOf } from '@components/download.component';
import { ElementRow, type RowAction } from '@components/element-row.component';
import { Toasts } from '@components/toasts.component';

/**
 * Objectif: Parcourir les utilisateurs de la plateforme et agir sur un compte | Périmètre: recherche, lignes, rôle,
 * export, blocage, suppression | Limites: la suppression n'est jamais confirmée (les comptes de départ sont partagés).
 */
export class UsersListPage {
	public readonly rows: Locator;
	public readonly confirmation: ConfirmationDialog;
	public readonly toasts: Toasts;
	/** Le choix du rôle de la dialog de modification. */
	public readonly roleSelect: Locator;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('user-row');
		this.confirmation = new ConfirmationDialog(_page);
		this.toasts = new Toasts(_page);
		this.roleSelect = _page.getByTestId('user-form-modal').getByTestId('user-form-role-select');
	}

	/** Ouvre la liste filtrée sur le texte donné (nom ou email). */
	public async goto(query: string): Promise<void> {
		await this._page.goto(`/users?q=${encodeURIComponent(query)}`);
	}

	public row(text: string): ElementRow {
		return new ElementRow(this.rows.filter({ hasText: text }));
	}

	public hiddenTag(text: string): Locator {
		return this.row(text).root.getByTestId('user-row-hidden-tag');
	}

	public role(text: string): Locator {
		return this.row(text).root.getByTestId('user-row-role');
	}

	/** Ferme la dialog de modification du rôle sans l'enregistrer. */
	public async closeRoleDialog(): Promise<void> {
		await this._page.getByTestId('user-form-modal').getByTestId('form-dialog-cancel-button').click();
	}

	/** Le menu d'actions d'une ligne, absent sur sa propre ligne. */
	public menuButton(text: string): Locator {
		return this.row(text).root.getByTestId('element-actions-button');
	}

	/** Lance la commande puis la confirme. */
	public async runConfirmed(text: string, action: RowAction): Promise<void> {
		await this.row(text).run(action);
		await this.confirmation.confirm();
	}

	/** Exporte les données d'un utilisateur, après confirmation, et renvoie le fichier téléchargé. */
	public async export(text: string): Promise<Download> {
		await this.row(text).run('export');
		return downloadOf(this._page, () => this.confirmation.confirm());
	}
}
