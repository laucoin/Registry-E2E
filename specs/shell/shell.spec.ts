import { expect, test } from '@fixtures/test.fixture';
import { authFile } from '@support/accounts';

/** Objectif: Couvrir le cadre commun de l'application | Périmètre: pied de page, titre de page, route inconnue, liens de l'accueil | Limites: les liens externes ne sont pas suivis */
test.describe('Application shell of the administrator', () => {
	test('SHELL-01 · SHELL-03 · the footer links the legal pages, the documentation and the support, and an unknown address leads home', async ({
		page,
		session,
	}) => {
		await test.step('The footer links', async () => {
			await session.visit('/');
			await expect(session.footerLink('terms')).toHaveAttribute('href', '/terms');
			await expect(session.footerLink('privacy')).toHaveAttribute('href', '/privacy');
			await expect(session.footerLink('documentation')).toHaveAttribute('href', /^https:\/\//);
			await expect(session.footerLink('support')).toHaveAttribute('href', /^https:\/\//);
		});

		await test.step('An unknown address leads to the home page', async () => {
			await session.visit('/nowhere-to-be-found');
			await expect(page).toHaveURL(/\/$/);
		});
	});

	test('SHELL-02 · each page of the application begins with its page title', async ({ data, session }) => {
		const project = await data.project();

		await test.step('Application pages', async () => {
			await session.visit('/projects');
			await expect(session.pageTitle).toBeVisible();
			await session.visit('/users');
			await expect(session.pageTitle).toBeVisible();
			await session.visit('/my-account/invitations');
			await expect(session.pageTitle).toBeVisible();
		});

		await test.step('Project pages', async () => {
			await session.visit(`/projects/${project.id}/movements`);
			await expect(session.pageTitle).toBeVisible();
			await session.visit(`/projects/${project.id}/configuration`);
			await expect(session.pageTitle).toBeVisible();
			await session.visit(`/projects/${project.id}/configuration/participants`);
			await expect(session.pageTitle).toBeVisible();
		});
	});

	test('HOME-03 · HOME-05 · HOME-07 · the home links lead to the favorites, the invitations and the allowed pages', async ({
		home,
		page,
	}) => {
		await test.step('The administrator has every shortcut once', async () => {
			await home.goto();
			await expect(home.internalShortcuts).toHaveText(['Utilisateurs', 'Mon compte', 'Mes projets']);
			await expect(home.externalShortcuts).toContainText(['Documentation', 'Support']);
		});

		await test.step('See all the favorites', async () => {
			await home.favoritesSeeAll.click();
			await expect(page).toHaveURL(/\/projects\?isFavorite=true/);
		});

		await test.step('See all the invitations', async () => {
			await home.goto();
			await home.invitationsSeeAll.click();
			await expect(page).toHaveURL(/\/my-account\/invitations/);
		});
	});
});

test.describe('Application shell of a user', () => {
	test.use({ storageState: authFile('coordinator') });

	test('HOME-07 · a plain user has no shortcut to the users', async ({ home }) => {
		await test.step('Only the allowed shortcuts are offered', async () => {
			await home.goto();
			await expect(home.internalShortcuts).toHaveText(['Mon compte', 'Mes projets']);
		});
	});
});
