import { expect, test } from '@fixtures/test.fixture';
import { isoDate } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir les anniversaires du jour | Périmètre: participants présents seulement | Limites: en administrateur */
test.describe('Birthdays of the day', () => {
	test('PH-11 · only the participants arrived and not gone are wished a happy birthday', async ({
		data,
		projectHome,
	}) => {
		const project = await data.project();
		const birthday = `2010${isoDate(0).slice(4)}`;
		const suffix = uid().toUpperCase();
		const here = await data.participant(project.id, { lastName: `HERE-${suffix}`, birthday });
		await data.participant(project.id, { lastName: `AWAY-${suffix}`, birthday });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [here.id] });

		await test.step('Only the present participant is listed', async () => {
			await projectHome.goto(project.id);
			await expect(projectHome.birthdayRows).toHaveCount(1);
			await expect(projectHome.birthdayRows).toContainText(`HERE-${suffix}`);
		});
	});
});
