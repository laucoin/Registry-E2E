import type { Locator, Page } from '@playwright/test';

import { FormDialog } from '@components/form-dialog.component';

export interface Vehicle {
	licensePlate: string;
	brand: string;
	model: string;
}

/** Objectif: Saisir un véhicule dans sa dialog | Périmètre: plaque, marque, modèle, erreur et envoi ralenti ou refusé | Limites: sans disponibilité */
export class VehicleFormPage {
	public readonly licensePlate: Locator;
	public readonly brand: Locator;
	public readonly model: Locator;
	private readonly _dialog: FormDialog;

	constructor(private readonly _page: Page) {
		this._dialog = new FormDialog(_page, 'vehicle-form-dialog');
		this.licensePlate = this._dialog.textbox('vehicle-form-license-plate-input');
		this.brand = this._dialog.textbox('vehicle-form-brand-input');
		this.model = this._dialog.textbox('vehicle-form-model-input');
	}

	public get dialog(): Locator {
		return this._dialog.root;
	}

	public get error(): Locator {
		return this._dialog.error;
	}

	public get submitButton(): Locator {
		return this._dialog.submitButton;
	}

	public async fill(vehicle: Partial<Vehicle>): Promise<void> {
		if (vehicle.licensePlate !== undefined) await this.licensePlate.fill(vehicle.licensePlate);
		if (vehicle.brand !== undefined) await this.brand.fill(vehicle.brand);
		if (vehicle.model !== undefined) await this.model.fill(vehicle.model);
	}

	/** Fait échouer le prochain envoi d'un véhicule avec l'erreur donnée par le backend. */
	public async failNextSave(status: number, detail: string): Promise<void> {
		await this._page.route(
			'**/api/v2/projects/*/vehicles',
			(route) =>
				route.request().method() === 'POST'
					? route.fulfill({
							status,
							contentType: 'application/problem+json',
							body: JSON.stringify({ type: 'about:blank', status, title: 'Refus', detail }),
						})
					: route.fallback(),
			{ times: 1 },
		);
	}

	/** Ralentit le prochain envoi d'un véhicule, pour observer le formulaire pendant l'envoi. */
	public async slowDownNextSave(delayMs: number): Promise<void> {
		await this._page.route(
			'**/api/v2/projects/*/vehicles',
			async (route) => {
				await new Promise((resolve) => setTimeout(resolve, delayMs));
				await route.fallback();
			},
			{ times: 1 },
		);
	}

	public async save(vehicle: Partial<Vehicle>): Promise<void> {
		await this.fill(vehicle);
		await this._dialog.submit();
	}
}
