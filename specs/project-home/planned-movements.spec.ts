import { expect, test } from '@fixtures/test.fixture';
import { at, hoursFromNow } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir les arrivées et départs du jour | Périmètre: widgets de l'accueil et préremplissage du formulaire | Limites: un participant, sans groupe */
test.describe('Planned movements of the day', () => {
	// Dans une heure : le mouvement est « du jour » et encore à venir, sauf dans la dernière heure avant minuit.
	const SOON = 1;

	test('PH-06 · an arrival of the day opens the entry of the participant, filled', async ({
		data,
		projectHome,
		registeredMovementForm: form,
	}) => {
		const project = await data.project();
		const lastName = `MEITNER-${uid().toUpperCase()}`;
		await data.participant(project.id, {
			firstName: 'Lise',
			lastName,
			startAvailability: hoursFromNow(SOON),
			endAvailability: at(5),
		});

		await test.step('The arrival opens the second step of an entry with the participant', async () => {
			await projectHome.goto(project.id);
			await projectHome.plannedArrivals.filter({ hasText: lastName }).click();
			await expect(form.title).toHaveJSProperty('title', 'Créer une entrée');
			await expect(form.previous).toBeVisible();
			await expect(form.participants.chosen).toHaveText([`Lise ${lastName}`]);
		});
	});

	test('PH-07 · a departure of the day opens the definitive exit of the participant, filled', async ({
		data,
		projectHome,
		registeredMovementForm: form,
	}) => {
		const project = await data.project();
		const lastName = `FRANKLIN-${uid().toUpperCase()}`;
		const participant = await data.participant(project.id, {
			firstName: 'Rosalind',
			lastName,
			startAvailability: at(-2),
			endAvailability: hoursFromNow(SOON),
		});
		await data.participantMovement(project.id, { type: 'IN', participantIds: [participant.id] });

		await test.step('The departure opens the second step of a definitive exit with the participant', async () => {
			await projectHome.goto(project.id);
			await projectHome.plannedDepartures.filter({ hasText: lastName }).click();
			await expect(form.title).toHaveJSProperty('title', 'Créer une sortie');
			await expect(form.reason.field).toHaveJSProperty('value', 'REASON:DEFINITIVE_DEPARTURE');
			await expect(form.participants.chosen).toHaveText([`Rosalind ${lastName}`]);
		});
	});
});
