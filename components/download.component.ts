import type { Download, Page } from '@playwright/test';

import { Toasts } from '@components/toasts.component';

/**
 * Lance une action qui télécharge un fichier et renvoie ce fichier ; échoue tout de suite avec le message du toast si le
 * backend refuse, p. ex. quand le quota d'exports de données personnelles est atteint.
 */
export async function downloadOf(page: Page, trigger: () => Promise<void>): Promise<Download> {
	const refusal = new Toasts(page).error;
	const download = page.waitForEvent('download');
	await trigger();
	const outcome = await Promise.race([download, refusal.waitFor().then(() => undefined)]);
	if (outcome) return outcome;
	const message = (await refusal.innerText()).trim().replace(/\.$/, '');
	throw new Error(
		`The download was refused: ${message}. Personal-data exports are limited per user and per hour: raise ` +
			'REGISTRY_EXPORT_RATE_LIMIT_CAPACITY on the local backend.',
	);
}
