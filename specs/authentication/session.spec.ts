import { expect, test } from '@fixtures/test.fixture';

/**
 * Objectif: Couvrir la connexion et la déconnexion | Périmètre: redirection vers le SSO, retour, déconnexion |
 * Limites: chaque test ouvre sa propre session, pour ne pas déconnecter celles du global setup ; le backend limite le débit
 * des connexions, d'où l'exécution seule (@exclusive).
 */
test.describe('Session', { tag: '@exclusive' }, () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('AUTH-01 · an anonymous visitor of a protected page signs in and comes back to it', async ({
		page,
		session,
	}) => {
		await test.step('A protected page asks to sign in', async () => {
			await session.visit('/my-account/invitations');
			await expect(page).toHaveURL(/\/login/);
		});

		await test.step('After signing in, the requested page is shown', async () => {
			await session.signIn('participant');
			await expect(session.accountMenu).toBeVisible();
			await expect(page).toHaveURL(/\/my-account\/invitations/);
		});
	});

	test('AUTH-02 · signing out makes the protected pages unreachable', async ({ page, session }) => {
		await test.step('Sign in then sign out', async () => {
			await session.visit('/login');
			await session.signIn('participant');
			await expect(session.accountMenu).toBeVisible();
			await session.signOut();
		});

		await test.step('A protected page asks to sign in again', async () => {
			await session.visit('/my-account/invitations');
			await expect(page).toHaveURL(/\/login/);
		});
	});

	test('AUTH-05 · a blocked user is refused after the identity provider, on the global error page', async ({
		globalError,
		session,
	}) => {
		await test.step('The blocked account signs in and is told it is locked', async () => {
			await session.visit('/login');
			await session.signIn('blocked-user');
			await expect(globalError.callout).toContainText('Ton compte a été bloqué');
		});
	});

	test('AUTH-06 · the session survives a reload and an expired access token is refreshed', async ({ session }) => {
		await test.step('Sign in then reload', async () => {
			await session.visit('/login');
			await session.signIn('participant');
			await expect(session.accountMenu).toBeVisible();
			await session.reload();
			await expect(session.accountMenu).toBeVisible();
		});

		await test.step('Without access token, the session goes on', async () => {
			await session.expireAccessToken();
			await session.visit('/my-account/invitations');
			await expect(session.accountMenu).toBeVisible();
		});
	});
});
