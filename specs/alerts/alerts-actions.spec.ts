import { expect, test } from '@fixtures/test.fixture';
import { uid } from '@support/unique';

/** Objectif: Couvrir les actions sur une alerte | Périmètre: page, statut, suppression | Limites: en administrateur du projet */
test.describe('Alert actions', () => {
	const OPTIONS = ['ACTIVITY', 'COMMUNICATION', 'ALERT'] as const;

	test('ALR-02 · the alerts page needs the alert option', async ({ alertsList, data, page }) => {
		const project = await data.project(['ACTIVITY']);

		await test.step('Without the option, the projects are shown instead', async () => {
			await alertsList.goto(project.id);
			await expect(page).toHaveURL(/\/projects$/);
		});
	});

	test('ALR-04 · only an alert in progress can be resolved or cancelled, after confirming', async ({
		alertsList: list,
		data,
	}) => {
		const project = await data.project([...OPTIONS]);
		const title = `Storm ${uid()}`;
		await data.alert(project.id, { title });

		await test.step('An alert in progress offers to resolve and cancel it', async () => {
			await list.goto(project.id);
			await expect(list.status(title)).toHaveText('En cours');
			await list.row(title).openMenu();
			await expect(list.row(title).action('resolve')).toBeVisible();
			await expect(list.row(title).action('cancel')).toBeVisible();
		});

		await test.step('Once resolved, it can only be reopened', async () => {
			await list.row(title).action('resolve').click();
			await list.confirmation.confirm();
			await expect(list.status(title)).toHaveText('Résolue');
			await list.row(title).openMenu();
			await expect(list.row(title).action('reopen')).toBeVisible();
			await expect(list.row(title).action('resolve')).toHaveCount(0);
		});
	});

	test('ALR-05 · an alert is deleted then restored, but never permanently deleted while it keeps its communications', async ({
		alertsList: list,
		data,
	}) => {
		const project = await data.project([...OPTIONS]);
		const title = `Fog ${uid()}`;
		// Le message d'une alerte est sa première communication : toute alerte en a au moins une.
		await data.alert(project.id, { title });

		await test.step('Delete then restore', async () => {
			await list.goto(project.id);
			await list.runConfirmed(title, 'softDelete');
			await expect(list.hiddenTag(title)).toBeVisible();
			await list.runConfirmed(title, 'restore');
			await expect(list.hiddenTag(title)).toHaveCount(0);
		});

		await test.step('The permanent deletion is refused and the alert stays', async () => {
			await list.runConfirmed(title, 'hardDelete');
			await expect(list.toasts.error).toBeVisible();
			await expect(list.row(title).root).toBeVisible();
		});
	});
});
