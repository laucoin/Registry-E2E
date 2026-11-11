import type { Locator, Page } from '@playwright/test';

export type ConfigurationTile = 'participants' | 'groups' | 'vehicles' | 'activities' | 'profiles';

/** Objectif: Lire la page de configuration d'un projet | Périmètre: informations, tuiles, zone de danger | Limites: sans exécuter les commandes de la zone de danger */
export class ConfigurationPage {
	public readonly tiles: Locator;
	public readonly projectName: Locator;
	public readonly editButton: Locator;
	public readonly dangerZone: Locator;

	constructor(private readonly _page: Page) {
		this.tiles = _page.getByTestId('configuration-tile');
		this.projectName = _page.getByTestId('project-information-name');
		this.editButton = _page.getByTestId('project-information-edit-button');
		this.dangerZone = _page.getByTestId('project-danger-zone');
	}

	public async goto(projectId: string): Promise<void> {
		await this._page.goto(`/projects/${projectId}/configuration`);
	}

	public tile(key: ConfigurationTile): Locator {
		return this.tiles.and(this._page.locator(`[data-id="${key}"]`));
	}

	public tileCount(key: ConfigurationTile): Locator {
		return this.tile(key).getByTestId('configuration-tile-count-tag');
	}
}
