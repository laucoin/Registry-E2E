import type { Locator, Page } from '@playwright/test';

import { FormDialog } from '@components/form-dialog.component';

export interface Vehicle {
	licensePlate: string;
	brand: string;
	model: string;
}

/** Objectif: Saisir un véhicule dans sa dialog | Périmètre: plaque, marque, modèle | Limites: sans disponibilité */
export class VehicleFormPage {
	public readonly licensePlate: Locator;
	public readonly brand: Locator;
	public readonly model: Locator;
	private readonly _dialog: FormDialog;

	constructor(page: Page) {
		this._dialog = new FormDialog(page, 'vehicle-form-dialog');
		this.licensePlate = this._dialog.textbox('vehicle-form-license-plate-input');
		this.brand = this._dialog.textbox('vehicle-form-brand-input');
		this.model = this._dialog.textbox('vehicle-form-model-input');
	}

	public async save(vehicle: Partial<Vehicle>): Promise<void> {
		if (vehicle.licensePlate !== undefined) await this.licensePlate.fill(vehicle.licensePlate);
		if (vehicle.brand !== undefined) await this.brand.fill(vehicle.brand);
		if (vehicle.model !== undefined) await this.model.fill(vehicle.model);
		await this._dialog.submit();
	}
}
