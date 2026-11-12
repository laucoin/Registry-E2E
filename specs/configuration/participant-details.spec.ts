import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';
import { at } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir la ligne, l'utilisateur lié, l'export et l'historique d'un participant | Périmètre: liste et formulaire des participants | Limites: un participant à la fois */
test.describe('Participant details', () => {
	test('PAR-05 · a row shows the first group with the others in a dialog, the availability and the presence', async ({
		data,
		participantDetails: details,
		participantsList: list,
	}) => {
		const project = await data.project();
		const lastName = `GROUPED-${uid().toUpperCase()}`;
		const { id } = await data.participant(project.id, { lastName, startAvailability: at(-1) });
		await data.group(project.id, [id], { name: `Alpha ${uid()}` });
		await data.group(project.id, [id], { name: `Beta ${uid()}` });
		await data.group(project.id, [id], { name: `Gamma ${uid()}` });

		await test.step('The row names the availability with an open end, and the presence', async () => {
			await list.goto(project.id);
			await expect(list.row(lastName).root).toContainText('...');
			await expect(list.statusTag(lastName)).toBeVisible();
		});

		await test.step('The groups button opens the three groups', async () => {
			await expect(details.groupsButton(list.row(lastName).root)).toContainText('et 2 autres groupes');
			await details.groupsButton(list.row(lastName).root).click();
			await expect(details.groupItems).toHaveCount(3);
		});
	});

	test('PAR-04 · the linked user is chosen among the project members and fills the name', async ({
		data,
		participantDetails: details,
		participantForm: form,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		const [coordinator, participant] = [await data.userOf('coordinator'), await data.userOf('participant')];

		await test.step('Only the members are offered', async () => {
			await form.openCreation(project.id);
			await details.userSelect.click();
			await expect(details.userSelect.getByRole('option', { name: new RegExp(coordinator.email) })).toBeVisible();
			await expect(
				details.userSelect.getByRole('option', { name: new RegExp(participant.lastName) }),
			).toHaveCount(0);
		});

		await test.step('Choosing a member fills the name', async () => {
			await details.userSelect.getByRole('option', { name: new RegExp(coordinator.email) }).click();
			await expect(form.firstName).toHaveValue(coordinator.firstName);
		});
	});

	test('PAR-07 · the administrator exports the data of a participant', async ({ data, participantsList: list }) => {
		const project = await data.project();
		const lastName = `EXPORTED-${uid().toUpperCase()}`;
		const { id } = await data.participant(project.id, { lastName });

		await test.step('The file of the participant is downloaded', async () => {
			// Le code exporte sans confirmation, contrairement au référentiel qui en prévoit une.
			await list.goto(project.id);
			const file = await list.download(lastName, 'export');
			expect(file.suggestedFilename()).toBe(`registry-participant-${id}.json`);
		});
	});
});

test.describe('Participant history of a coordinator', () => {
	test.use({ storageState: authFile('coordinator') });

	test('PAR-08 · the history lists the movements of the participant only, with the presence timeline', async ({
		data,
		page,
		participantDetails: details,
		participantsList: list,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'coordinator', 'PROJECT_COORDINATOR');
		const lastName = `HISTORY-${uid().toUpperCase()}`;
		const { id } = await data.participant(project.id, { lastName });
		const other = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id] });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [other.id] });

		await test.step('Open the history from the row', async () => {
			await list.goto(project.id);
			await list.primaryAction(lastName).click();
			await expect(page).toHaveURL(new RegExp(`/participants/${id}/movements`));
		});

		await test.step('Only the movement of the participant is listed, with the timeline', async () => {
			await expect(details.movementRows).toHaveCount(1);
			await expect(details.timeline).toBeVisible();
		});
	});
});

test.describe('Participant history of a participant', () => {
	test.use({ storageState: authFile('participant') });

	test('PAR-08 · a project participant cannot open the history', async ({ data, participantsList: list }) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');
		const lastName = `NOHISTORY-${uid().toUpperCase()}`;
		await data.participant(project.id, { lastName });

		await test.step('The history action is greyed out', async () => {
			await list.goto(project.id);
			await expect(list.primaryAction(lastName)).toHaveAttribute('aria-disabled', 'true');
		});
	});
});
