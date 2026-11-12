import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';

/**
 * Objectif: Couvrir les préférences et le rafraîchissement automatique | Périmètre: thème, mode de rafraîchissement,
 * mise à jour de l'accueil d'un projet | Limites: les préférences du compte participant sont remises par défaut à la
 * fin ; les deux tests, dans le même fichier, s'exécutent l'un après l'autre.
 */
test.describe('Preferences of a user', () => {
	test.use({ storageState: authFile('participant') });

	test('ACC-03 · the theme and the refresh mode are kept after a reload', async ({ data, myAccount }) => {
		const participant = await data.apiAs('participant');
		data.onCleanup(() => participant.raw('POST', '/users/preferences/theme?theme=SYSTEM'));
		data.onCleanup(() => participant.raw('POST', '/users/preferences/refresh-mode?mode=NORMAL'));

		await test.step('Choose the dark theme and the fast refresh', async () => {
			await myAccount.goto();
			await myAccount.chooseTheme('Sombre');
			await myAccount.chooseRefresh('Rapide');
		});

		await test.step('Both are kept after a reload', async () => {
			await myAccount.reload();
			await expect(myAccount.themeChoices).toHaveJSProperty('value', 'dark');
			await expect(myAccount.refreshChoices).toHaveJSProperty('value', 'FAST');
		});
	});

	test('PH-13 · HOME-09 · the dashboard of a project shows a change made elsewhere without reloading', async ({
		data,
		projectHome,
		session,
	}) => {
		const participantApi = await data.apiAs('participant');
		await participantApi.send('POST', '/users/preferences/refresh-mode?mode=FAST');
		data.onCleanup(() => participantApi.raw('POST', '/users/preferences/refresh-mode?mode=NORMAL'));
		const project = await data.project();
		await data.invite(project.id, 'participant', 'PROJECT_PARTICIPANT');
		const { id } = await data.participant(project.id);

		await test.step('An entry recorded elsewhere appears once the fast refresh period is over', async () => {
			await session.controlClock();
			await projectHome.goto(project.id);
			await expect(projectHome.participantStats).toHaveAccessibleName(/^Inscrits présents 0 /);
			await data.participantMovement(project.id, { type: 'IN', participantIds: [id] });
			await session.letTimePass(30);
			await expect(projectHome.participantStats).toHaveAccessibleName(/^Inscrits présents 1 /);
		});
	});
});
