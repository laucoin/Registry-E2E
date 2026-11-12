import { expect, test } from '@fixtures/test.fixture';
import { at } from '@support/dates';
import { licensePlate, uid } from '@support/unique';

/** Objectif: Couvrir le choix des participants et des véhicules d'un mouvement d'inscrits | Périmètre: présence à la date, étape des véhicules | Limites: sans enregistrement */
test.describe('Registered movement participants and vehicles', () => {
	test('MVF-04 · only the participants present at the date are offered, unless widened to the whole project', async ({
		data,
		registeredMovementForm: form,
	}) => {
		const project = await data.project();
		const lastName = `LATER-${uid().toUpperCase()}`;
		await data.participant(project.id, {
			firstName: 'Ida',
			lastName,
			startAvailability: at(5),
			endAvailability: at(10),
		});

		await test.step('A participant expected later is not offered', async () => {
			await form.open(project.id);
			await form.information.continueAs('IN');
			await form.participants.search(lastName);
			await expect(form.nobodyFound).toBeVisible();
		});

		await test.step('Widening to the whole project offers them', async () => {
			await form.allParticipants.click();
			await form.participants.choose(`Ida ${lastName}`);
		});
	});

	test('MVF-05 · each vehicle needs a responsible and can be removed', async ({
		data,
		registeredMovementForm: form,
	}) => {
		const project = await data.project(['VEHICLE']);
		const lastName = `DRIVER-${uid().toUpperCase()}`;
		await data.participant(project.id, { firstName: 'Bertha', lastName });
		const plate = licensePlate();
		await data.vehicle(project.id, { licensePlate: plate });

		await test.step('A vehicle without responsible is refused', async () => {
			await form.open(project.id);
			await form.information.continueAs('IN');
			await form.participants.choose(`Bertha ${lastName}`);
			await form.nextToVehicles();
			await form.chooseVehicle(plate);
			await form.submitVehiclesRejected();
			await expect(form.vehicleItems.getByTestId('registered-vehicles-fields-driver-select')).toHaveAttribute(
				'error',
				/.+/,
			);
		});

		await test.step('The vehicle can be removed', async () => {
			await form.vehicleItems.getByTestId('registered-vehicles-fields-remove-button').click();
			await expect(form.noVehicle).toBeVisible();
		});
	});
});
