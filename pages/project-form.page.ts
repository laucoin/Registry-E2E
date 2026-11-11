import type { Locator, Page } from '@playwright/test';

import { FormSubmission } from '@components/form-submission.component';

/** Objectif: Créer un projet par le formulaire en trois étapes | Périmètre: informations, options, invitation | Limites: sans dates ni options pour l'instant */
export class ProjectFormPage {
	private readonly _name: Locator;
	private readonly _next: Locator;
	private readonly _create: Locator;
	private readonly _skipInvitation: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this._name = _page.getByTestId('project-information-fields-name-input').getByRole('textbox');
		this._next = _page.getByTestId('project-form-information-next-submit');
		this._create = _page.getByTestId('project-form-options-submit');
		this._skipInvitation = _page.getByTestId('project-form-invitation-skip-button');
		this._submission = new FormSubmission(_page);
	}

	/** Le projet existe dès la validation des options (étape 2) ; passer l'invitation ouvre son accueil, dont l'URL donne l'identifiant. */
	public async create(name: string): Promise<string> {
		await this._page.goto('/projects/create');
		await this._name.fill(name);
		await this._next.click();
		await this._submission.submit(this._create);
		await this._skipInvitation.click();
		await this._page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
		return this._page.url().split('/').pop() ?? '';
	}
}
