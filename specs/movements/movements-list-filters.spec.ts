import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';
import { uid } from '@support/unique';

/** Objectif: Couvrir les filtres et les lignes de la liste des entrées et sorties | Périmètre: type, visibilité, contenu d'une ligne | Limites: sans les dates */
test.describe('Movements list filters and rows', () => {
	test('MVL-01 · MVL-02 · the type filter keeps the exits, whose row shows its reason and opens its participants', async ({
		data,
		movementsList: list,
	}) => {
		const project = await data.project();
		const lastName = `ROW-${uid().toUpperCase()}`;
		const { id } = await data.participant(project.id, { lastName });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id] });
		await data.participantMovement(project.id, { type: 'OUT', participantIds: [id], reason: 'SHOPPING' });

		await test.step('The administrator can filter on the visibility and the type', async () => {
			await list.goto(project.id);
			await expect(list.rows).toHaveCount(2);
			await expect(list.visibilityFilter).toBeVisible();
			await list.filterType('Sortie');
			await expect(list.rows).toHaveCount(1);
		});

		await test.step('The exit shows its reason and its counter opens its participants', async () => {
			await expect(list.rows).toContainText('Courses');
			await expect(await list.openParticipants(list.rows)).toContainText(lastName);
		});
	});
});

test.describe('Movements list of a participant', () => {
	test.use({ storageState: authFile('participant') });

	test('MVL-01 · a project participant has no visibility filter', async ({ data, movementsList: list }) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');
		const { id } = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id] });

		await test.step('The visibility filter is not offered', async () => {
			await list.goto(project.id);
			await expect(list.rows).toHaveCount(1);
			await expect(list.visibilityFilter).toHaveCount(0);
		});
	});
});

test.describe('Movements in progress on the dashboard', () => {
	test('PH-09 · with the activities, the other movements in progress leave out the activities and show their reason', async ({
		data,
		projectHome,
	}) => {
		const project = await data.project(['ACTIVITY']);
		const [shopper, hiker] = [await data.participant(project.id), await data.participant(project.id)];
		const { id: activityId } = await data.activity(project.id, { name: `Hike ${uid()}` });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [shopper.id, hiker.id] });
		await data.participantMovement(project.id, { type: 'OUT', participantIds: [shopper.id], reason: 'SHOPPING' });
		await data.participantMovement(project.id, { type: 'OUT', participantIds: [hiker.id], activityId });

		await test.step('Only the shopping exit is among the other movements', async () => {
			await projectHome.goto(project.id);
			await projectHome.openOtherMovementsTab();
			await expect(projectHome.otherMovementRows).toHaveCount(1);
			await expect(projectHome.otherMovementRows).toContainText('Courses');
		});
	});

	test('PH-09 · PH-10 · without the activities, every movement in progress is listed, a present guest included', async ({
		data,
		projectHome,
	}) => {
		const project = await data.project();
		const { id } = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id] });
		await data.participantMovement(project.id, { type: 'OUT', participantIds: [id], reason: 'SHOPPING' });
		await data.guestMovement(project.id, { type: 'IN', reason: 'VISIT' });

		await test.step('The exit and the guest entry are in progress, the guest can be let out', async () => {
			await projectHome.goto(project.id);
			await expect(projectHome.otherMovementRows).toHaveCount(2);
			await expect(
				projectHome.otherMovementRows
					.filter({ hasText: 'Visite' })
					.getByTestId('movement-element-reverse-button'),
			).toBeVisible();
		});
	});
});

test.describe('Participants of a movement', () => {
	test('DRW-06 · the participants are split into all, adults, minors, one tab per group and the independent ones', async ({
		data,
		movementsList: list,
	}) => {
		const project = await data.project();
		const minor = await data.participant(project.id, { birthday: '2015-06-01' });
		const adult = await data.participant(project.id, { birthday: '1990-06-01' });
		const content = [{ participantId: minor.id, poolName: 'Otters' }, { participantId: adult.id }];
		await data.api.send('POST', `/projects/${project.id}/movements`, {
			type: 'IN',
			dateTime: new Date().toISOString(),
			content,
		});

		await test.step('Every non-empty tab is offered', async () => {
			await list.goto(project.id);
			const drawer = await list.openParticipants(list.rows);
			await expect(drawer.getByTestId('movement-participants-all-tab')).toContainText('(2)');
			await expect(drawer.getByTestId('movement-participants-adults-tab')).toContainText('(1)');
			await expect(drawer.getByTestId('movement-participants-children-tab')).toContainText('(1)');
			await expect(drawer.getByTestId('movement-participants-pool-tab')).toHaveText('Otters (1)');
			await expect(drawer.getByTestId('movement-participants-independent-tab')).toContainText('(1)');
		});
	});
});
