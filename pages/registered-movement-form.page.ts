import type { Locator, Page } from '@playwright/test';

import { ElementPicker } from '@components/element-picker.component';
import { FormSubmission } from '@components/form-submission.component';

export type MovementType = 'IN' | 'OUT';

const TYPE_LABELS: Record<MovementType, string> = { IN: 'Entrée', OUT: 'Sortie' };

/** Objectif: Enregistrer l'entrée ou la sortie d'inscrits | Périmètre: étapes informations et contenu | Limites: date par défaut (maintenant), sans motif ni véhicule */
export class RegisteredMovementFormPage {
	private readonly _type: Locator;
	private readonly _next: Locator;
	private readonly _participants: ElementPicker;
	private readonly _submit: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this._type = _page.getByTestId('movement-information-step-type-select');
		this._next = _page.getByTestId('movement-information-step-next-submit');
		this._participants = new ElementPicker(_page.getByTestId('registered-participants-fields-participants-field'));
		this._submit = _page.getByTestId('registered-movement-form-content-next-submit');
		this._submission = new FormSubmission(_page);
	}

	/** Les participants sont désignés par leur nom complet, tel que le champ de sélection les propose. */
	public async record(projectId: string, type: MovementType, participants: string[]): Promise<void> {
		await this._page.goto(`/projects/${projectId}/movements/create/registered`);
		await this._type.click();
		await this._page.getByRole('option', { name: TYPE_LABELS[type], exact: true }).click();
		await this._next.click();
		for (const participant of participants) await this._participants.choose(participant);
		await this._submission.submit(this._submit);
	}
}
