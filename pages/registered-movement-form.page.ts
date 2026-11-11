import type { Locator, Page } from '@playwright/test';

import { ElementPicker } from '@components/element-picker.component';
import { FormSubmission } from '@components/form-submission.component';
import { MovementInformationStep, type MovementType } from '@components/movement-information-step.component';
import { MovementReason } from '@components/movement-reason.component';

/**
 * Objectif: Enregistrer l'entrée ou la sortie d'inscrits | Périmètre: étapes informations et contenu, motif |
 * Limites: sans l'étape des véhicules.
 */
export class RegisteredMovementFormPage {
	public readonly information: MovementInformationStep;
	public readonly reason: MovementReason;
	public readonly previous: Locator;
	/** Le titre dit s'il s'agit d'une entrée ou d'une sortie (« Créer une sortie »). */
	public readonly title: Locator;
	public readonly participants: ElementPicker;
	private readonly _submit: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this.information = new MovementInformationStep(_page);
		this.reason = new MovementReason(_page.getByTestId('registered-movement-form-content-form'));
		this.previous = _page.getByTestId('registered-movement-form-content-previous-button');
		this.title = _page.getByTestId('form-title');
		this.participants = new ElementPicker(_page.getByTestId('registered-participants-fields-participants-field'));
		this._submit = _page.getByTestId('registered-movement-form-content-next-submit');
		this._submission = new FormSubmission(_page);
	}

	/** Les participants sont désignés par leur nom complet, tel que le champ de sélection les propose. */
	public async record(projectId: string, type: MovementType, participants: string[]): Promise<void> {
		await this.open(projectId);
		await this.information.continueAs(type);
		await this.chooseParticipants(participants);
		await this.save();
	}

	public async open(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/movements/create/registered`);
	}

	public async chooseParticipants(participants: string[]): Promise<void> {
		for (const participant of participants) await this.participants.choose(participant);
	}

	/** Envoie un formulaire que la validation du frontend doit retenir : le formulaire reste ouvert. */
	public async submitRejected(): Promise<void> {
		await this._submit.click();
	}

	public async save(): Promise<void> {
		await this._submission.submit(this._submit);
	}
}
