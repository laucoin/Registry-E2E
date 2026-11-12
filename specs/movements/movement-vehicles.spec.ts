import { expect, test } from '@fixtures/test.fixture';
import { licensePlate, uid } from '@support/unique';

/** Objectif: Couvrir les véhicules d'un mouvement | Périmètre: tiroir des véhicules et de leurs responsables | Limites: un véhicule */
test.describe('Vehicles of a movement', () => {
	test('DRW-07 · the vehicles drawer lists each vehicle with its responsible', async ({
		data,
		movementsList: list,
	}) => {
		const project = await data.project(['VEHICLE']);
		const plate = licensePlate();
		const vehicle = await data.vehicle(project.id, { licensePlate: plate });
		const lastName = `DRIVER-${uid().toUpperCase()}`;
		const { id } = await data.participant(project.id, { firstName: 'Ayrton', lastName });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id], vehicleId: vehicle.id });

		await test.step('The vehicle and its responsible are listed', async () => {
			await list.goto(project.id);
			const drawer = await list.openVehicles(list.rows);
			await expect(drawer.getByTestId('movement-vehicles-label')).toContainText(plate);
			await expect(drawer.getByTestId('movement-vehicles-driver')).toHaveText(`Ayrton ${lastName}`);
		});
	});
});
