import { test as base } from '@playwright/test';

import { ActivityFormPage } from '@pages/activity-form.page';
import { AlertsListPage } from '@pages/alerts-list.page';
import { ConfigurationListPage } from '@pages/configuration-list.page';
import { GlobalErrorPage } from '@pages/global-error.page';
import { GroupFormPage } from '@pages/group-form.page';
import { GuestMovementFormPage } from '@pages/guest-movement-form.page';
import { MovementsListPage } from '@pages/movements-list.page';
import { ParticipantFormPage } from '@pages/participant-form.page';
import { ProfileInvitationFormPage } from '@pages/profile-invitation-form.page';
import { ProfilesListPage } from '@pages/profiles-list.page';
import { ProjectFormPage } from '@pages/project-form.page';
import { ProjectHomePage } from '@pages/project-home.page';
import { ProjectsListPage } from '@pages/projects-list.page';
import { RegisteredMovementFormPage } from '@pages/registered-movement-form.page';
import { SessionPage } from '@pages/session.page';
import { VehicleFormPage } from '@pages/vehicle-form.page';
import { TestData } from '@support/api/test-data';

interface Fixtures {
	activitiesList: ConfigurationListPage;
	activityForm: ActivityFormPage;
	alertsList: AlertsListPage;
	/** Prépare les données par l'API ; les projets créés ou suivis (`track`) sont supprimés à la fin du test, ce qui rend chaque test rejouable. */
	data: TestData;
	globalError: GlobalErrorPage;
	groupForm: GroupFormPage;
	groupsList: ConfigurationListPage;
	guestMovementForm: GuestMovementFormPage;
	movementsList: MovementsListPage;
	participantForm: ParticipantFormPage;
	participantsList: ConfigurationListPage;
	profileInvitationForm: ProfileInvitationFormPage;
	profilesList: ProfilesListPage;
	projectForm: ProjectFormPage;
	projectHome: ProjectHomePage;
	projectsList: ProjectsListPage;
	registeredMovementForm: RegisteredMovementFormPage;
	session: SessionPage;
	vehicleForm: VehicleFormPage;
	vehiclesList: ConfigurationListPage;
}

/** Objectif: Injecter les page objects et les données de test | Périmètre: tous les tests | Limites: le compte connecté vient de `storageState` */
export const test = base.extend<Fixtures>({
	activitiesList: async ({ page }, use) => use(new ConfigurationListPage(page, 'activities')),
	activityForm: async ({ page }, use) => use(new ActivityFormPage(page)),
	alertsList: async ({ page }, use) => use(new AlertsListPage(page)),
	data: async ({}, use) => {
		const data = await TestData.as('administrator');
		try {
			await use(data);
		} finally {
			await data.cleanup();
		}
	},
	globalError: async ({ page }, use) => use(new GlobalErrorPage(page)),
	groupForm: async ({ page }, use) => use(new GroupFormPage(page)),
	groupsList: async ({ page }, use) => use(new ConfigurationListPage(page, 'groups')),
	guestMovementForm: async ({ page }, use) => use(new GuestMovementFormPage(page)),
	movementsList: async ({ page }, use) => use(new MovementsListPage(page)),
	participantForm: async ({ page }, use) => use(new ParticipantFormPage(page)),
	participantsList: async ({ page }, use) => use(new ConfigurationListPage(page, 'participants')),
	profileInvitationForm: async ({ page }, use) => use(new ProfileInvitationFormPage(page)),
	profilesList: async ({ page }, use) => use(new ProfilesListPage(page)),
	projectForm: async ({ page }, use) => use(new ProjectFormPage(page)),
	projectHome: async ({ page }, use) => use(new ProjectHomePage(page)),
	projectsList: async ({ page }, use) => use(new ProjectsListPage(page)),
	registeredMovementForm: async ({ page }, use) => use(new RegisteredMovementFormPage(page)),
	session: async ({ page }, use) => use(new SessionPage(page)),
	vehicleForm: async ({ page }, use) => use(new VehicleFormPage(page)),
	vehiclesList: async ({ page }, use) => use(new ConfigurationListPage(page, 'vehicles')),
});

export { expect } from '@playwright/test';
