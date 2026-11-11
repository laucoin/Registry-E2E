import { test as base } from '@playwright/test';

import { ActivityFormPage } from '@pages/activity-form.page';
import { ConfigurationListPage } from '@pages/configuration-list.page';
import { GroupFormPage } from '@pages/group-form.page';
import { MovementsListPage } from '@pages/movements-list.page';
import { ParticipantFormPage } from '@pages/participant-form.page';
import { ProjectFormPage } from '@pages/project-form.page';
import { ProjectHomePage } from '@pages/project-home.page';
import { RegisteredMovementFormPage } from '@pages/registered-movement-form.page';
import { VehicleFormPage } from '@pages/vehicle-form.page';
import { TestData } from '@support/api/test-data';

interface Fixtures {
	activitiesList: ConfigurationListPage;
	activityForm: ActivityFormPage;
	/** Prépare les données par l'API ; les projets créés ou suivis (`track`) sont supprimés à la fin du test, ce qui rend chaque test rejouable. */
	data: TestData;
	groupForm: GroupFormPage;
	groupsList: ConfigurationListPage;
	movementsList: MovementsListPage;
	participantForm: ParticipantFormPage;
	participantsList: ConfigurationListPage;
	projectForm: ProjectFormPage;
	projectHome: ProjectHomePage;
	registeredMovementForm: RegisteredMovementFormPage;
	vehicleForm: VehicleFormPage;
	vehiclesList: ConfigurationListPage;
}

/** Objectif: Injecter les page objects et les données de test | Périmètre: tous les tests | Limites: le compte connecté vient de `storageState` */
export const test = base.extend<Fixtures>({
	activitiesList: async ({ page }, use) => use(new ConfigurationListPage(page, 'activities')),
	activityForm: async ({ page }, use) => use(new ActivityFormPage(page)),
	data: async ({}, use) => {
		const data = await TestData.as('administrator');
		try {
			await use(data);
		} finally {
			await data.cleanup();
		}
	},
	groupForm: async ({ page }, use) => use(new GroupFormPage(page)),
	groupsList: async ({ page }, use) => use(new ConfigurationListPage(page, 'groups')),
	movementsList: async ({ page }, use) => use(new MovementsListPage(page)),
	participantForm: async ({ page }, use) => use(new ParticipantFormPage(page)),
	participantsList: async ({ page }, use) => use(new ConfigurationListPage(page, 'participants')),
	projectForm: async ({ page }, use) => use(new ProjectFormPage(page)),
	projectHome: async ({ page }, use) => use(new ProjectHomePage(page)),
	registeredMovementForm: async ({ page }, use) => use(new RegisteredMovementFormPage(page)),
	vehicleForm: async ({ page }, use) => use(new VehicleFormPage(page)),
	vehiclesList: async ({ page }, use) => use(new ConfigurationListPage(page, 'vehicles')),
});

export { expect } from '@playwright/test';
