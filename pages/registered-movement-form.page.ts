import type { Locator, Page } from '@playwright/test';

import { ElementPicker } from '@components/element-picker.component';
import { FormSubmission } from '@components/form-submission.component';
import { MovementInformationStep, type MovementType } from '@components/movement-information-step.component';
import { MovementReason } from '@components/movement-reason.component';

/**
 * Objectif: Enregistrer l'entrée ou la sortie d'inscrits | Périmètre: étapes informations et contenu, motif |
 * Limites: l'étape des véhicules n'est pilotée que pour choisir et retirer un véhicule.
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

	/** L'interrupteur qui élargit le choix à tous les participants du projet, au-delà de ceux présents à la date. */
	public get allParticipants(): Locator {
		return this._page.getByTestId('registered-participants-fields-all-switch');
	}

	/** Le message du champ des participants quand la recherche ne trouve personne. */
	public get nobodyFound(): Locator {
		return this._page
			.getByTestId('registered-participants-fields-participants-field')
			.getByText('Aucune personne ou groupe trouvé');
	}

	/** Passe de l'étape du contenu à celle des véhicules. */
	public async nextToVehicles(): Promise<void> {
		await this._submit.click();
	}

	/** Les véhicules choisis à la troisième étape ; chacun porte l'erreur de son responsable dans `error`. */
	public get vehicleItems(): Locator {
		return this._page.getByTestId('registered-vehicles-fields-vehicle-item');
	}

	public get noVehicle(): Locator {
		return this._page.getByTestId('registered-vehicles-fields-empty');
	}

	public async chooseVehicle(label: string): Promise<void> {
		const select = this._page.getByTestId('registered-vehicles-fields-vehicle-select');
		await select.click();
		await select.getByRole('option').filter({ hasText: label }).click();
	}

	/** Envoie la dernière étape sans attendre : la validation du frontend doit la retenir. */
	public async submitVehiclesRejected(): Promise<void> {
		await this._page.getByTestId('registered-movement-form-submit').click();
	}

	/** Envoie un formulaire que la validation du frontend doit retenir : le formulaire reste ouvert. */
	public async submitRejected(): Promise<void> {
		await this._submit.click();
	}

	public async save(): Promise<void> {
		await this._submission.submit(this._submit);
	}
}
