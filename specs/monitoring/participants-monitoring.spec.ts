import { expect, test } from '@fixtures/test.fixture';
import { at } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir le suivi des participants | Périmètre: statuts, retard, filtre de présence | Limites: onglet individuel */
test.describe('Participants monitoring', () => {
	test('MON-01 · MON-02 · each participant shows their presence, the overdue one is flagged, and the presence filters', async ({
		data,
		participantsMonitoring: monitoring,
	}) => {
		const project = await data.project();
		const suffix = uid().toUpperCase();
		const [present, out, gone] = [`PRESENT-${suffix}`, `OUT-${suffix}`, `GONE-${suffix}`];
		const p = await data.participant(project.id, { lastName: present });
		const o = await data.participant(project.id, { lastName: out });
		await data.participant(project.id, { lastName: gone, startAvailability: at(-10), endAvailability: at(-5) });
		await data.participantMovement(project.id, { type: 'IN', participantIds: [p.id, o.id] });
		await data.participantMovement(project.id, { type: 'OUT', participantIds: [o.id], reason: 'SHOPPING' });
		const overdue = await data.overdueParticipant(project.id);
		const late = await data.participantOf(project.id, overdue.id);

		await test.step('Each status is shown, and the overdue participant is flagged', async () => {
			await monitoring.gotoIndividuals(project.id);
			await expect(monitoring.status(present)).toContainText('Présent');
			await expect(monitoring.status(out)).toContainText('En sortie');
			await expect(monitoring.status(gone)).toContainText('Parti');
			await expect(monitoring.overdue(late.lastName)).toBeVisible();
		});

		await test.step('The presence filter keeps the participants out', async () => {
			await monitoring.filterStatus('En sortie');
			await expect(monitoring.rows).toHaveCount(1);
			await expect(monitoring.row(out)).toBeVisible();
		});
	});

	test('MON-03 · the vehicles monitoring needs the vehicle option', async ({ data, page, session }) => {
		const [withVehicles, without] = [await data.project(['VEHICLE']), await data.project()];

		await test.step('With the option, the vehicles are followed', async () => {
			await session.visit(`/projects/${withVehicles.id}/vehicles`);
			await expect(page).toHaveURL(new RegExp(`/projects/${withVehicles.id}/vehicles`));
		});

		await test.step('Without the option, the projects are shown instead', async () => {
			await session.visit(`/projects/${without.id}/vehicles`);
			await expect(page).toHaveURL(/\/projects$/);
		});
	});
});
