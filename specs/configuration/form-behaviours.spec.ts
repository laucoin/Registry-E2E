import { expect, test } from '@fixtures/test.fixture';
import { licensePlate } from '@support/unique';

/** Objectif: Couvrir le comportement d'un formulaire à l'envoi | Périmètre: refus du backend, envoi en cours, conflit d'édition | Limites: sur la dialog des véhicules */
test.describe('Form behaviours', () => {
	test('FRM-01 · a refused form stays open with the message of the backend and its data, and saves on retry', async ({
		data,
		vehicleForm: form,
		vehiclesList: list,
	}) => {
		const project = await data.project(['VEHICLE']);
		const plate = licensePlate();

		await test.step('The refusal is shown inside the form, which keeps its data', async () => {
			await list.goto(project.id);
			await list.openCreation();
			await form.failNextSave(422, 'Plaque refusée par la préfecture');
			await form.fill({ licensePlate: plate, brand: 'Peugeot', model: 'Partner' });
			await form.submitButton.click();
			await expect(form.error).toContainText('Plaque refusée par la préfecture');
			await expect(list.toasts.error).toHaveCount(0);
			await expect(form.brand).toHaveValue('Peugeot');
		});

		await test.step('Sending again saves the vehicle', async () => {
			await form.save({});
			await expect(list.row(plate).root).toBeVisible();
		});
	});

	test('FRM-03 · a form being sent shows its progress and creates a single element', async ({
		data,
		vehicleForm: form,
		vehiclesList: list,
	}) => {
		const project = await data.project(['VEHICLE']);
		const plate = licensePlate();

		await test.step('Send twice while the first sending is slow', async () => {
			await list.goto(project.id);
			await list.openCreation();
			await form.fill({ licensePlate: plate, brand: 'Renault', model: 'Kangoo' });
			await form.slowDownNextSave(1_500);
			await form.submitButton.click();
			await expect(form.submitButton).toHaveAttribute('loading');
			// Un second clic pendant l'envoi : l'événement est envoyé même si le bouton refuse le pointeur.
			await form.submitButton.dispatchEvent('click');
		});

		await test.step('A single vehicle is created', async () => {
			await expect(form.dialog).toBeHidden();
			await expect(list.rows.filter({ hasText: plate })).toHaveCount(1);
		});
	});
});

test.describe('Edition conflicts', () => {
	test('CON-01 · saving an element changed meanwhile by someone else shows a conflict without overwriting', async ({
		data,
		vehicleForm: form,
		vehiclesList: list,
	}) => {
		const project = await data.project(['VEHICLE']);
		const plate = licensePlate();
		const { id } = await data.vehicle(project.id, { licensePlate: plate, brand: 'Renault', model: 'Master' });

		await test.step('Someone else changes the vehicle while its form is open', async () => {
			await list.goto(project.id);
			await list.run(plate, 'edit');
			await expect(form.model).toHaveValue('Master');
			await data.api.send('PATCH', `/projects/${project.id}/vehicles/${id}`, {
				licensePlate: plate,
				brand: 'Renault',
				model: 'Trafic',
			});
		});

		await test.step('Saving shows the conflict and keeps the other change', async () => {
			await form.fill({ model: 'Kangoo' });
			await form.submitButton.click();
			await expect(form.error).toBeVisible();
			const vehicle = await data.api.send<{ model: string }>('GET', `/projects/${project.id}/vehicles/${id}`);
			expect(vehicle.model).toBe('Trafic');
		});
	});
});
