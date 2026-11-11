import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';
import { uid } from '@support/unique';

/** Objectif: Couvrir les widgets de l'accueil d'un projet | Périmètre: favori, statuts, régularisation, alertes, actions rapides | Limites: en administrateur, sauf mention */
test.describe('Project dashboard widgets', () => {
	test('PH-01 · the star of the title adds the project to the favorites without leaving the page', async ({
		data,
		page,
		projectHome,
	}) => {
		const project = await data.project();

		await test.step('Star the project', async () => {
			await projectHome.goto(project.id);
			await projectHome.favorite.click();
			await expect(projectHome.favorite).toHaveAttribute('aria-pressed', 'true');
			await expect(page).toHaveURL(new RegExp(`/projects/${project.id}$`));
		});
	});

	test('PH-02 · the participants status counts the registered present and out, and the guests present', async ({
		data,
		projectHome,
	}) => {
		const project = await data.project();
		const [first, second, third] = [
			await data.participant(project.id),
			await data.participant(project.id),
			await data.participant(project.id),
		];
		await data.participantMovement(project.id, { type: 'IN', participantIds: [first.id, second.id, third.id] });
		await data.participantMovement(project.id, { type: 'OUT', participantIds: [third.id], reason: 'SHOPPING' });
		await data.guestMovement(project.id, { type: 'IN', reason: 'VISIT' });

		await test.step('The counters match the data', async () => {
			await projectHome.goto(project.id);
			await expect(projectHome.participantStats).toHaveAccessibleName(
				'Inscrits présents 2 Inscrits en sortie 1 Invités présents 1',
			);
		});
	});

	test('PH-03 · the vehicles status counts the vehicles present, and is hidden without the option', async ({
		data,
		projectHome,
	}) => {
		const project = await data.project(['VEHICLE']);
		const without = await data.project();
		const vehicle = await data.vehicle(project.id);
		const { id } = await data.participant(project.id);
		await data.participantMovement(project.id, { type: 'IN', participantIds: [id], vehicleId: vehicle.id });

		await test.step('The vehicle is counted as present', async () => {
			await projectHome.goto(project.id);
			await expect(projectHome.vehicleStats).toHaveAccessibleName(/^Présents 1 /);
		});

		await test.step('Without the option, the widget is hidden', async () => {
			await projectHome.goto(without.id);
			await expect(projectHome.participantStats).toBeVisible();
			await expect(projectHome.vehicleCard).toHaveCount(0);
		});
	});
});

test.describe('Project dashboard regularizations and quick actions', () => {
	test('PH-04 · a participant past their planned departure without definitive exit must be regularized', async ({
		data,
		projectHome,
	}) => {
		const project = await data.project();
		const { id } = await data.overdueParticipant(project.id);

		await test.step('The overdue participant is listed', async () => {
			await projectHome.goto(project.id);
			await expect(projectHome.regularizationRow(id)).toBeVisible();
		});
	});

	test('PH-05 · PH-12 · the quick actions and the alert widget open the right forms', async ({
		data,
		page,
		projectHome,
	}) => {
		const project = await data.project(['ACTIVITY', 'COMMUNICATION', 'ALERT']);
		await data.alert(project.id, { title: `Smoke ${uid()}` });

		await test.step('Communicate on an open alert opens its drawer', async () => {
			await projectHome.goto(project.id);
			await projectHome.communicateButtons.first().click();
			await expect(projectHome.communicationDrawer).toHaveAttribute('open');
		});

		await test.step('The registered and guest buttons open their forms', async () => {
			await projectHome.goto(project.id);
			await projectHome.registeredMovementButton.click();
			await expect(page).toHaveURL(/\/movements\/create\/registered/);
			await projectHome.goto(project.id);
			await projectHome.guestMovementButton.click();
			await expect(page).toHaveURL(/\/movements\/create\/guest/);
		});
	});
});

test.describe('Project dashboard of a participant', () => {
	test.use({ storageState: authFile('participant') });

	test('PH-04 · PH-05 · a participant sees neither the regularizations nor, without the option, the alerts', async ({
		data,
		projectHome,
	}) => {
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');

		await test.step('The profile widgets and the alerts are hidden', async () => {
			await projectHome.goto(project.id);
			await expect(projectHome.participantStats).toBeVisible();
			await expect(projectHome.regularizationSeeAll).toHaveCount(0);
			await expect(projectHome.activeAlerts).toHaveCount(0);
		});
	});
});
