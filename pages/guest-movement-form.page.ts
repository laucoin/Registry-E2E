import type { Locator, Page } from '@playwright/test';

import { ElementPicker } from '@components/element-picker.component';
import { FormSubmission } from '@components/form-submission.component';
import { MovementInformationStep } from '@components/movement-information-step.component';
import { MovementReason } from '@components/movement-reason.component';
import type { ParticipantIdentity } from '@pages/participant-form.page';

/**
 * Objectif: Enregistrer l'entrée ou la sortie d'invités | Périmètre: informations, motif, invités saisis à l'entrée et
 * choisis à la sortie | Limites: un seul invité saisi par entrée.
 */
export class GuestMovementFormPage {
	public readonly information: MovementInformationStep;
	public readonly reason: MovementReason;
	/** Les invités qui sortent, choisis parmi ceux présents. */
	public readonly leavingGuests: ElementPicker;
	/** Le message du champ des invités qui sortent quand la recherche ne trouve personne. */
	public readonly noLeavingGuestFound: Locator;
	private readonly _guest: Locator;
	private readonly _submit: Locator;
	private readonly _submission: FormSubmission;

	constructor(private readonly _page: Page) {
		this.information = new MovementInformationStep(_page);
		const content = _page.getByTestId('guest-movement-form-content-form');
		this.reason = new MovementReason(content);
		const leaving = _page.getByTestId('guest-movement-form-participants-field');
		this.leavingGuests = new ElementPicker(leaving);
		this.noLeavingGuestFound = leaving.getByText('Aucune personne ou groupe trouvé');
		this._guest = content.getByTestId('guest-list-fields-guest-item').first();
		this._submit = _page.getByTestId('guest-movement-form-content-submit');
		this._submission = new FormSubmission(_page);
	}

	public async open(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/movements/create/guest`);
	}

	/** Le premier invité saisi : son prénom porte son message d'erreur dans l'attribut `error`. */
	public get guestFirstName(): Locator {
		return this._guest.getByTestId('guest-list-fields-first-name-input');
	}

	public get guestLastName(): Locator {
		return this._guest.getByTestId('guest-list-fields-last-name-input');
	}

	public async fillGuest(guest: ParticipantIdentity): Promise<void> {
		await this.guestFirstName.getByRole('textbox').fill(guest.firstName);
		await this.guestLastName.getByRole('textbox').fill(guest.lastName);
		await this._guest.getByTestId('guest-list-fields-birthday-picker').getByRole('textbox').fill(guest.birthday);
	}

	/** Envoie un formulaire que la validation du frontend doit retenir : le formulaire reste ouvert. */
	public async submitRejected(): Promise<void> {
		await this._submit.click();
	}

	public async save(): Promise<void> {
		await this._submission.submit(this._submit);
	}
}
