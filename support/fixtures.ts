import type { APIResponse } from '@playwright/test';

import { createBdd, test as base } from 'playwright-bdd';

import type { Account } from '@/support/accounts';
import { authFile } from '@/support/accounts';
import { type Created, type Project, TestData } from '@/support/api/test-data';
import { liveLogin } from '@/support/live-login';
import { EXPECTED_PROJECT_AUTHORITIES, type ProjectRole, ROLE_ACCOUNTS } from '@/support/permissions';

/** Ce que partagent les steps d'un scénario : les projets sous le nom que leur donne la feature, et le dernier participant. */
export interface Scenario {
	projects: Map<string, Project>;
	participant?: Created;
	/** La présence dans laquelle le dernier participant préparé a été mis. */
	presence?: 'IN' | 'OUT';
	/** Le projet sur lequel un step opère quand la feature n'en nomme pas. */
	current?: Project;
	/** Le formulaire de mouvement ouvert dans le navigateur, et la nature du motif choisie par le scénario. */
	form?: 'registered' | 'guest';
	reasonKind?: 'REASON' | 'ACTIVITY';
	/** Indique si le formulaire de mouvement a signalé le participant choisi (p. ex. déjà IN). */
	warned?: boolean;
	/** Participants préparés dans chaque statut de présence, par statut. */
	mix?: Record<'IN' | 'OUT' | 'OVERDUE' | 'UNAVAILABLE', Created>;
	/** Le type d'élément que liste la page de configuration utilisée. */
	kind?: 'participant' | 'group' | 'vehicle' | 'activity';
	/** Le type d'élément dont parle un step de matrice de rôles, et ceux préparés pour lui. */
	kind2?: 'project' | 'participant' | 'group' | 'vehicle' | 'activity' | 'movement' | 'alert' | 'communication';
	elements?: Partial<
		Record<
			'project' | 'participant' | 'group' | 'vehicle' | 'activity' | 'movement' | 'alert' | 'communication',
			Created
		>
	>;
	/** L'utilisateur de départ sur lequel agit un step de rôle de plateforme. */
	userId?: string;
	userName?: string;
	/** Le chemin demandé par le dernier step de navigation. */
	requestedPath?: string;
	/** La réponse d'un export fait via l'API. */
	exportResponse?: APIResponse;
	/** Le téléchargement lancé par un step d'export. */
	download?: Promise<import('@playwright/test').Download>;
	/** Les options avec lesquelles un formulaire de projet a été rempli. */
	options?: ('VEHICLE' | 'ACTIVITY' | 'COMMUNICATION' | 'ALERT')[];
	/** Projets renvoyés par une requête triée de l'API. */
	sorted?: unknown[];
	/** Nombre de lignes qu'une liste affichait avant de charger la suite. */
	listedBefore?: number;
	/** Une plage d'accès définie sur un profil. */
	window?: { start: Date; end: Date };
	/** L'autre compte sur lequel agit un step de profil. */
	otherAccount?: import('@/support/accounts').Account;
	/** Les types d'éléments qu'un step de matrice de rôles a déjà masqués. */
	hidden?: Set<string>;
	/** L'élément qu'un scénario de concurrence a ouvert, modifié ailleurs, puis enregistré. */
	subject?: unknown;
	/** Ce dont un formulaire de projet a été rempli, pour le rejouer sur l'API. */
	projectDraft?: Record<string, unknown>;
	/** Un profil de projet sur lequel agit un step. */
	profileId?: string;
	/** Une alerte préparée par le scénario. */
	alert?: Created;
	/** Un invité (participant de type GUEST) préparé par le scénario. */
	guest?: Created;
	/** Un groupe préparé par le scénario. */
	group?: Created;
	/** Une activité préparée par le scénario. */
	activity?: Created;
	/** Un véhicule préparé par le scénario. */
	vehicle?: Created;
	/** Plusieurs réponses de l'API d'un step qui attend des erreurs. */
	responses?: APIResponse[];
	/** La dernière réponse de l'API d'un step qui attend une erreur. */
	response?: APIResponse;
	/** Le mouvement préparé par le scénario. */
	movement?: Created;
	/** Les participants (ou invités, qui n'ont pas d'id) du mouvement préparé par le scénario, avec le nom par lequel les formulaires les recherchent. */
	movementMembers?: { id?: string; lastName: string }[];
	/** Le dernier nom donné à un invité par un step de modification. */
	newLastName?: string;
	/** Le rôle de projet qu'exerce un scénario `@all-roles` : les projets qu'il prépare donnent ce rôle au compte connecté. */
	role?: ProjectRole;
	/** Le compte avec lequel le scénario est connecté. */
	account?: Account;
	/** Nom de l'élément créé par le dernier step de création, pour le step qui vérifie qu'il est listé. */
	created?: string;
}

type World = {
	/** Le rôle de projet avec lequel le projet Playwright exécute les scénarios `@all-roles` (administrateur par défaut). */
	role: ProjectRole;
	scenario: Scenario;
	signInAs: (account: Account) => Promise<void>;
	/** Helpers d'API qui créent les données du scénario ; les projets qu'ils créent sont supprimés après le scénario. */
	data: TestData;
};

export const test = base.extend<World>({
	role: ['PROJECT_ADMINISTRATOR', { option: true }],
	scenario: async ({}, use) => {
		await use({ projects: new Map() });
	},
	data: async ({}, use) => {
		const data = await TestData.as('administrator');
		try {
			await use(data);
		} finally {
			await data.cleanup();
		}
	},
	signInAs: async ({ browser, context, page, scenario }, use, testInfo) => {
		await use(async (account) => {
			scenario.account = account;
			if (testInfo.tags.includes('@logout')) {
				// Se déconnecter termine la session du fournisseur d'identité : on le fait sur une session à part, pas sur la session stockée partagée.
				await liveLogin(page, account);
				return;
			}
			// Remplace les cookies du contexte par défaut par la session stockée du compte.
			await context.clearCookies();
			const state = await browser.newContext({ storageState: authFile(account) });
			await context.addCookies((await state.storageState()).cookies);
			await state.close();
			await page.goto('/');
			// L'accueil s'affiche une fois la session acceptée ; les steps peuvent compter sur le shell de l'application à partir de là.
			await page.getByTestId('navbar-account-menu-button').waitFor();
		});
	},
});

export const { Given, When, Then, Before } = createBdd(test);

/**
 * `@needs:PARTICIPANT_C` réserve un scénario aux rôles qui détiennent cette permission de projet : les autres rôles le sautent, car leur refus est
 * vérifié ailleurs (tests/permission-denials.spec.ts). La permission vient de la matrice des rôles (support/permissions.ts).
 */
Before(async ({ $tags, $test, role }) => {
	const needed = $tags.filter((tag) => tag.startsWith('@needs:')).map((tag) => tag.slice('@needs:'.length));
	const missing = needed.filter((permission) => !EXPECTED_PROJECT_AUTHORITIES[role].includes(permission));
	$test.skip(
		missing.length > 0,
		`${role} n'a pas ${missing.join(', ')} : le refus est couvert par la matrice des permissions`,
	);
	// `@only:PROJECT_ADMINISTRATOR` : le scénario change lui-même de compte, il n'a de sens que pour le projet Playwright de ce rôle.
	const only = $tags.filter((tag) => tag.startsWith('@only:')).map((tag) => tag.slice('@only:'.length));
	$test.skip(only.length > 0 && !only.includes(role), `réservé à ${only.join(', ')}`);
});

export { ROLE_ACCOUNTS };

/** La valeur que l'étape précédente du scénario doit avoir posée ; échoue avec un message clair sinon. */
export function required<K extends keyof Scenario>(scenario: Scenario, key: K): NonNullable<Scenario[K]> {
	const value = scenario[key];
	if (value === undefined || value === null) throw new Error(`The scenario has no "${key}" yet`);
	return value as NonNullable<Scenario[K]>;
}
