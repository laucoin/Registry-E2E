import { expect, test } from '@fixtures/test.fixture';
import { licensePlate } from '@support/unique';

/** Objectif: Couvrir le cycle de vie d'un véhicule | Périmètre: formulaire et liste des véhicules | Limites: sans disponibilité */
test.describe('Vehicles', () => {
	test('VEH-02 · create then edit a vehicle', async ({ data, vehicleForm, vehiclesList }) => {
		const project = await data.project(['VEHICLE']);
		const plate = licensePlate();

		await test.step('Create a vehicle from the list', async () => {
			await vehiclesList.goto(project.id);
			await vehiclesList.openCreation();
			await vehicleForm.save({ licensePlate: plate, brand: 'Renault', model: 'Master' });
			await expect(vehiclesList.row(plate).root).toContainText('Renault Master');
		});

		await test.step('The edition form is filled with the vehicle', async () => {
			await vehiclesList.run(plate, 'edit');
			await expect(vehicleForm.licensePlate).toHaveValue(plate);
			await expect(vehicleForm.brand).toHaveValue('Renault');
			await expect(vehicleForm.model).toHaveValue('Master');
		});

		await test.step('Save a new model', async () => {
			await vehicleForm.save({ model: 'Trafic' });
			await expect(vehiclesList.row(plate).root).toContainText('Renault Trafic');
		});
	});
});
