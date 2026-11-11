import { expect, test } from '@fixtures/test.fixture';
import { uid } from '@support/unique';

/** Objectif: Couvrir la création d'une alerte | Périmètre: action rapide de l'accueil, liste des alertes, alertes en cours | Limites: sans communication liée */
test.describe('Alerts', () => {
	test('ALR-01 · a new alert needs a title and a message, then shows in the list and on the dashboard', async ({
		alertsList,
		data,
		projectHome,
	}) => {
		const project = await data.project(['ACTIVITY', 'COMMUNICATION', 'ALERT']);
		const title = `Lost hiker ${uid()}`;

		await test.step('The title and the message are required', async () => {
			await projectHome.goto(project.id);
			await projectHome.openAlertCreation();
			await projectHome.alertForm.submit();
			await expect(projectHome.alertForm.titleField).toHaveAttribute('error', /.+/);
			await expect(projectHome.alertForm.messageField).toHaveAttribute('error', /.+/);
		});

		await test.step('Save the alert', async () => {
			await projectHome.alertForm.fill(title, 'Last seen near the lake');
			await projectHome.alertForm.submit();
			await expect(projectHome.alertDrawer).not.toHaveAttribute('open');
		});

		await test.step('The alert is immediately active on the dashboard', async () => {
			await expect(projectHome.activeAlerts).toContainText(title);
		});

		await test.step('The alert is listed with the alerts of the project', async () => {
			await alertsList.goto(project.id);
			await expect(alertsList.rows.filter({ hasText: title })).toHaveCount(1);
		});
	});
});
