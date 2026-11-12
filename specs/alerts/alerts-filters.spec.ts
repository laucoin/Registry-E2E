import { expect, test } from '@fixtures/test.fixture';
import { isoHoursAgo, uiDateIn } from '@support/dates';
import { uid } from '@support/unique';

/** Objectif: Couvrir les statistiques et les filtres de la liste des alertes | Périmètre: taux d'alertes réelles, titre, statut, date de début | Limites: le temps moyen de résolution n'est pas maîtrisé, seule sa présence est vérifiée */
test.describe('Alerts list statistics and filters', () => {
	test('ALR-03 · the statistics sum up the closed alerts, and the list filters on the title, the status and the date', async ({
		alertsList: list,
		data,
	}) => {
		const project = await data.project(['ACTIVITY', 'COMMUNICATION', 'ALERT']);
		const [storm, rain, fog] = [`Storm ${uid()}`, `Rain ${uid()}`, `Fog ${uid()}`];
		await data.alert(project.id, { title: storm });
		const resolved = await data.alert(project.id, { title: rain });
		const canceled = await data.alert(project.id, { title: fog, dateTime: isoHoursAgo(72) });
		await data.api.send('PATCH', `/projects/${project.id}/alerts/${resolved.id}/status/RESOLVED`);
		await data.api.send('PATCH', `/projects/${project.id}/alerts/${canceled.id}/status/CANCELED`);

		await test.step('One resolved alert out of two closed makes a real-alert rate of 50 %', async () => {
			await list.goto(project.id);
			await expect(list.rateStat).toMatchAriaSnapshot('- group: /50 %.*1 résolues sur 2 clôturées/');
			await expect(list.resolutionStat).toMatchAriaSnapshot('- group: /Moyenne sur les alertes résolues/');
		});

		await test.step('The title filter keeps the matching alert', async () => {
			await list.search(storm);
			await expect(list.rows).toHaveCount(1);
			await expect(list.rows).toContainText(storm);
		});

		await test.step('The status filter keeps the resolved alert', async () => {
			await list.goto(project.id);
			await list.filterStatus('Résolue');
			await expect(list.rows).toHaveCount(1);
			await expect(list.rows).toContainText(rain);
		});

		await test.step('The date filter leaves out the alert of three days ago', async () => {
			await list.goto(project.id);
			await list.after.fill({ date: uiDateIn(-1), time: '00:00' });
			await expect(list.rows).toHaveCount(2);
			await expect(list.row(fog).root).toHaveCount(0);
		});
	});
});
