import { expect, test } from '@fixtures/test.fixture';

/** Objectif: Couvrir les erreurs affichées sous les champs du formulaire de participant | Périmètre: identité | Limites: sans envoi au backend */
test.describe('Participant form errors', () => {
	test('PAR-03 · the first name, the last name and the birthday are required', async ({
		data,
		participantForm: form,
	}) => {
		const project = await data.project();

		await test.step('An empty form shows an error under each required field', async () => {
			await form.openCreation(project.id);
			await form.submitRejected();
			await expect(form.firstNameField).toHaveAttribute('error', /.+/);
			await expect(form.lastNameField).toHaveAttribute('error', /.+/);
			await expect(form.birthdayField).toHaveAttribute('error', /.+/);
		});
	});
});
