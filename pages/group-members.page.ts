import { expect, type Locator, type Page } from '@playwright/test';

import { ConfirmationDialog } from '@components/confirmation-dialog.component';
import { ElementPicker } from '@components/element-picker.component';
import { ElementRow } from '@components/element-row.component';

/**
 * Objectif: Gérer les membres d'un groupe depuis sa page | Périmètre: liste des membres, ajout, création d'un membre,
 * retrait | Limites: sans recherche dans la liste.
 */
export class GroupMembersPage {
	public readonly rows: Locator;
	public readonly addMembersButton: Locator;
	/** Le champ des membres à ajouter porte son message d'erreur dans l'attribut `error`. */
	public readonly membersField: Locator;
	public readonly members: ElementPicker;
	/** Le message du champ des membres quand la recherche ne trouve personne. */
	public readonly nobodyFound: Locator;
	public readonly confirmation: ConfirmationDialog;
	private readonly _addDrawer: Locator;
	private readonly _add: Locator;
	private readonly _createMember: Locator;

	constructor(private readonly _page: Page) {
		this.rows = _page.getByTestId('participant-row');
		this.addMembersButton = _page.getByTestId('group-member-list-add-members-button');
		this._addDrawer = _page.getByTestId('group-member-list-add-members-drawer');
		this.membersField = this._addDrawer.getByTestId('group-members-field-participants-field');
		this.members = new ElementPicker(this.membersField);
		this.nobodyFound = this.membersField.getByText('Aucune personne trouvée');
		this._add = _page.getByTestId('group-member-list-actions').getByTestId('form-actions-submit');
		this._createMember = _page.getByTestId('group-member-list-create-member-button');
		this.confirmation = new ConfirmationDialog(_page);
	}

	public async goto(projectId: string, groupId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration/groups/${groupId}/members`);
	}

	public row(name: string): ElementRow {
		return new ElementRow(this.rows.filter({ hasText: name }));
	}

	public async openAddMembers(): Promise<void> {
		await this.addMembersButton.click();
	}

	/** Ajoute les membres choisis ; sans membre, le formulaire reste ouvert. */
	public async add(): Promise<void> {
		await this._add.click();
	}

	/** Ajoute ces participants au groupe et attend la fermeture du tiroir. */
	public async addMembers(names: string[]): Promise<void> {
		await this.openAddMembers();
		for (const name of names) await this.members.choose(name);
		await this.add();
		await expect(this._addDrawer).not.toHaveAttribute('open');
	}

	/** Ouvre le formulaire participant dans un tiroir ; le participant créé est rattaché au groupe. */
	public async openMemberCreation(): Promise<void> {
		await this._createMember.click();
	}

	/** Retire un membre du groupe, après confirmation. */
	public async remove(name: string): Promise<void> {
		await this.row(name).run('remove-member');
		await this.confirmation.confirm();
	}
}
