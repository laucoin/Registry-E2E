import { expect, test } from '@fixtures/test.fixture';
import { uiDateIn } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir les erreurs affichées sous les champs du formulaire de projet | Périmètre: nom, dates, options | Limites: sans envoi au backend */
test.describe('Project form errors', () => {
	test('PRJ-03 · the name is required, a time needs a date and the end must be after the beginning', async ({
		projectForm: form,
	}) => {
		await test.step('An empty name is refused', async () => {
			await form.openCreation();
			await form.fillInformation({});
			await expect(form.nameField).toHaveAttribute('error', /.+/);
		});

		await test.step('A beginning time without date is refused', async () => {
			await form.begin.time.fill('10:00');
			await form.fillInformation({ name: `E2E errors ${uid()}` });
			await expect(form.beginField).toHaveAttribute('error', /quel jour/);
		});

		await test.step('An end equal to the beginning is refused', async () => {
			await form.fillInformation({
				begin: { date: uiDateIn(0), time: '10:00' },
				end: { date: uiDateIn(0), time: '10:00' },
			});
			await expect(form.endField).toHaveAttribute('error', /finit avant/);
		});
	});

	test('PRJ-04 · an option needs the options it depends on', async ({ projectForm: form }) => {
		await test.step('The alerts alone are refused, for they need the activities first', async () => {
			await form.openCreation();
			await form.fillInformation({ name: `E2E options ${uid()}` });
			await form.option('Gestion des alertes').click();
			await form.submitRejected();
			await expect(form.option('Gestion des alertes')).toHaveAttribute('error', /sans “Activités”/);
		});
	});
});
