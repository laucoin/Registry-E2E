import { expect, test } from '@fixtures/test.fixture';

/** Objectif: Couvrir la page d'erreur globale | Périmètre: échec du chargement de l'utilisateur courant | Limites: erreur simulée côté navigateur */
test.describe('Global error', () => {
	test('ERR-01 · a failure to load the current user shows the backend message, and retrying reloads the app', async ({
		globalError,
		session,
	}) => {
		await test.step('The error page shows the title and the detail sent by the backend', async () => {
			await globalError.failNextUserLoad(500, { title: 'Base indisponible', detail: 'Maintenance en cours' });
			await session.visit('/');
			await expect(globalError.callout).toHaveJSProperty('title', 'Base indisponible');
			await expect(globalError.callout).toContainText('Maintenance en cours');
		});

		await test.step('Retrying reloads the application, which no longer shows the error', async () => {
			await globalError.retry();
			// L'échec a déjà renvoyé vers la page de connexion : c'est elle qui est rechargée.
			await expect(session.loginButton).toBeVisible();
			await expect(globalError.callout).toHaveCount(0);
		});
	});
});
