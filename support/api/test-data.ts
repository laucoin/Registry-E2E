import { randomUUID } from 'node:crypto';

import type { Account } from '@/support/accounts';
import { ApiClient } from '@/support/api/client';
import { DAY_MS, isoDate } from '@/support/dates';
import type { Scenario } from '@/support/fixtures';
import { ROLE_ACCOUNTS } from '@/support/permissions';

export type ProjectOption = 'VEHICLE' | 'ACTIVITY' | 'COMMUNICATION' | 'ALERT';
export type ProjectRole = 'PROJECT_ADMINISTRATOR' | 'PROJECT_COORDINATOR' | 'PROJECT_PARTICIPANT';
export type MovementType = 'IN' | 'OUT';
/** Motifs que le backend accepte : les invités entrent (IN) pour ceux-ci, les participants enregistrés sortent (OUT) pour les autres. */
export type GuestReason = 'EMERGENCY' | 'LOGISTICS' | 'PARTNER_ANIMATION' | 'VISIT';
export type RegisteredReason = 'SHOPPING' | 'MEDICAL' | 'DEFINITIVE_DEPARTURE' | 'OTHER';

export interface Project {
	id: string;
	name: string;
}
export interface Created {
	id: string;
}

const unique = (prefix: string) => `${prefix} ${randomUUID().slice(0, 8)}`;

/**
 * Crée via l'API les données dont un scénario a besoin, avec le compte donné, et supprime les projets qu'il a
 * créés une fois le scénario terminé (supprimer un projet supprime tout ce qu'il contient).
 */
export class TestData {
	private readonly _projects: string[] = [];
	private readonly _others: TestData[] = [];
	private readonly _cleanups: (() => Promise<unknown>)[] = [];
	private readonly _clients = new Map<Account, ApiClient>();

	private constructor(public readonly api: ApiClient) {}

	public static async as(account: Account): Promise<TestData> {
		return new TestData(await ApiClient.as(account));
	}

	/** Un projet commencé il y a un mois et qui se termine dans un mois, de sorte que les mouvements datés de maintenant sont dans la plage. */
	public async project(options: ProjectOption[] = [], overrides: Record<string, unknown> = {}): Promise<Project> {
		const name = unique('E2E project');
		const created = await this.api.send<Created>('POST', '/projects', {
			name,
			begin: { date: isoDate(-30) },
			end: { date: isoDate(30) },
			options,
			...overrides,
		});
		this._projects.push(created.id);
		return { id: created.id, name };
	}

	/** Un client d'API d'un autre compte, conservé jusqu'à la fin du scénario pour que ses réponses restent lisibles. */
	public async apiAs(account: Account): Promise<ApiClient> {
		let client = this._clients.get(account);
		if (!client) {
			client = await ApiClient.as(account);
			this._clients.set(account, client);
		}
		return client;
	}

	/** Enregistre quelque chose à annuler une fois le scénario terminé, p. ex. débloquer un compte de départ qu'un step a bloqué. */
	public onCleanup(undo: () => Promise<unknown>) {
		this._cleanups.push(undo);
	}

	/** Enregistre un projet créé via l'UI pour qu'il soit supprimé avec les autres, par le compte qui l'a créé (il en est l'administrateur). */
	public track(projectId: string, owner: Account = 'administrator') {
		if (owner === 'administrator') this._projects.push(projectId);
		else this._cleanups.push(async () => (await this.apiAs(owner)).raw('DELETE', `/projects/${projectId}`));
	}

	/**
	 * Les helpers de données d'un autre compte (ses projets, participants, groupes…) : à utiliser quand le projet du scénario n'appartient pas
	 * à l'administrateur, p. ex. un projet qu'un coordinateur vient de créer par l'interface. Nettoyé avec ce `TestData`.
	 */
	public async asOwner(account: Account): Promise<TestData> {
		if (account === 'administrator') return this;
		const owner = await TestData.as(account);
		this._others.push(owner);
		return owner;
	}

	/** Un projet créé par un autre compte, p. ex. un projet dans lequel le compte principal n'a pas de profil. */
	public async projectAs(account: Account, options: ProjectOption[] = []): Promise<Project> {
		const other = await TestData.as(account);
		this._others.push(other);
		return other.project(options);
	}

	/**
	 * Le projet que la feature appelle `name` : celui que ce scénario a créé sous cet alias, sinon un nouveau projet
	 * vide est créé sous ce nom. Passer `seeded` pour les steps en lecture seule qui s'appuient sur les données de départ.
	 */
	public async projectNamed(scenario: Scenario, name: string, seeded = false): Promise<Project> {
		let project = scenario.projects.get(name);
		if (!project) {
			project = seeded ? await this._seededProject(name) : await this._scenarioProject(scenario);
			scenario.projects.set(name, project);
		}
		scenario.current = project;
		return project;
	}

	private async _seededProject(name: string): Promise<Project> {
		const list = await this.api.send<{ content: { id: string; name: string }[] }>(
			'GET',
			`/projects?q=${encodeURIComponent(name)}&size=50`,
		);
		const found = list.content.find((candidate) => candidate.name === name);
		if (!found) throw new Error(`Seeded project "${name}" not found`);
		return { id: found.id, name };
	}

	private async _scenarioProject(scenario: Scenario): Promise<Project> {
		const project = await this.project();
		// Le projet appartient à l'administrateur : un scénario `@all-roles` donne son rôle au compte connecté pour qu'il y ait un profil.
		if (scenario.role && scenario.role !== 'PROJECT_ADMINISTRATOR')
			await this.invite(project.id, ROLE_ACCOUNTS[scenario.role], scenario.role);
		return project;
	}

	/**
	 * Donne à un autre compte un profil dans le projet et, sauf indication contraire, lui fait accepter
	 * l'invitation (un compte de départ n'est invité qu'aux projets de départ).
	 */
	public async invite(projectId: string, account: Account, role: ProjectRole, accept = true): Promise<void> {
		const invitee = await ApiClient.as(account);
		try {
			const { email } = await invitee.send<{ email: string }>('GET', '/authentication/user/current');
			await this.api.send('POST', `/projects/${projectId}/profiles`, { emails: [email], role });
			if (!accept) return;
			const mine = await invitee.send<{ content: { id: string; project: { id: string } }[] }>(
				'GET',
				'/users/profiles?size=100',
			);
			const profile = mine.content.find((candidate) => candidate.project.id === projectId);
			if (!profile) throw new Error(`No invitation to project ${projectId} found for "${account}"`);
			await invitee.send('POST', `/users/profiles/${profile.id}/accept/true`);
		} finally {
			await invitee.dispose();
		}
	}

	public participant(projectId: string, overrides: Record<string, unknown> = {}): Promise<Created> {
		return this.api.send('POST', `/projects/${projectId}/participants`, {
			firstName: unique('First'),
			lastName: unique('Last'),
			birthday: '2000-01-01',
			...overrides,
		});
	}

	public group(projectId: string, members: string[], overrides: Record<string, unknown> = {}): Promise<Created> {
		return this.api.send('POST', `/projects/${projectId}/groups`, { name: unique('Group'), members, ...overrides });
	}

	public vehicle(projectId: string, overrides: Record<string, unknown> = {}): Promise<Created> {
		return this.api.send('POST', `/projects/${projectId}/vehicles`, {
			licensePlate: unique('PLATE'),
			brand: 'Renault',
			model: 'Master',
			...overrides,
		});
	}

	public activity(projectId: string, overrides: Record<string, unknown> = {}): Promise<Created> {
		return this.api.send('POST', `/projects/${projectId}/activities`, { name: unique('Activity'), ...overrides });
	}

	public alert(projectId: string, overrides: Record<string, unknown> = {}): Promise<Created> {
		return this.api.send('POST', `/projects/${projectId}/alerts`, {
			title: unique('Alert'),
			dateTime: new Date().toISOString(),
			message: 'E2E',
			...overrides,
		});
	}

	public communication(
		projectId: string,
		alertId: string,
		overrides: Record<string, unknown> = {},
	): Promise<Created> {
		return this.api.send('POST', `/projects/${projectId}/communications`, {
			dateTime: new Date().toISOString(),
			message: 'E2E',
			alertId,
			...overrides,
		});
	}

	/** Un participant arrivé, dont la disponibilité prévue s'est terminée hier et qui n'est pas parti : OVERDUE. */
	public async overdueParticipant(projectId: string): Promise<Created> {
		// Une date sans heure fait répondre 500 au backend : les bornes de disponibilité portent donc une heure explicite.
		const participant = await this.participant(projectId, {
			startAvailability: { date: isoDate(-10), time: '00:00:00+00:00' },
			endAvailability: { date: isoDate(-1), time: '12:00:00+00:00' },
		});
		await this.participantMovement(projectId, {
			type: 'IN',
			participantIds: [participant.id],
			dateTime: new Date(Date.now() - 5 * DAY_MS).toISOString(),
		});
		return participant;
	}

	/** Un participant dans chaque statut de présence que la page de suivi peut afficher. */
	public async presenceMix(projectId: string): Promise<Record<'IN' | 'OUT' | 'OVERDUE' | 'UNAVAILABLE', Created>> {
		const hour = 3_600_000;
		const entered = await this.participant(projectId);
		await this.participantMovement(projectId, {
			type: 'IN',
			participantIds: [entered.id],
			dateTime: new Date(Date.now() - 2 * hour).toISOString(),
		});
		const left = await this.participant(projectId);
		await this.participantMovement(projectId, {
			type: 'IN',
			participantIds: [left.id],
			dateTime: new Date(Date.now() - 3 * hour).toISOString(),
		});
		await this.participantMovement(projectId, {
			type: 'OUT',
			participantIds: [left.id],
			reason: 'SHOPPING',
			dateTime: new Date(Date.now() - hour).toISOString(),
		});
		const overdue = await this.overdueParticipant(projectId);
		const unavailable = await this.participant(projectId, {
			startAvailability: { date: isoDate(2), time: '12:00:00+00:00' },
		});
		return { IN: entered, OUT: left, OVERDUE: overdue, UNAVAILABLE: unavailable };
	}

	/** Un mouvement de participants enregistrés. OUT demande un motif ou une activité ; IN ne doit avoir ni l'un ni l'autre. */
	public participantMovement(
		projectId: string,
		movement: {
			type: MovementType;
			participantIds: string[];
			reason?: RegisteredReason;
			activityId?: string;
			dateTime?: string;
			vehicleId?: string;
		},
	): Promise<Created> {
		const { participantIds, dateTime, vehicleId, ...rest } = movement;
		return this.api.send('POST', `/projects/${projectId}/movements`, {
			dateTime: dateTime ?? new Date().toISOString(),
			content: participantIds.map((participantId) => ({ participantId, vehicleId })),
			...rest,
		});
	}

	/** Un mouvement d'invités. IN demande un motif ; OUT n'en a aucun. */
	public guestMovement(
		projectId: string,
		movement: {
			type: MovementType;
			reason?: GuestReason;
			dateTime?: string;
			guests?: { firstName: string; lastName: string; birthday: string }[];
		},
	): Promise<Created> {
		return this.api.send('POST', `/projects/${projectId}/movements/guests`, {
			dateTime: movement.dateTime ?? new Date().toISOString(),
			type: movement.type,
			reason: movement.reason,
			guests: movement.guests ?? [
				{ firstName: unique('Guest'), lastName: unique('Visitor'), birthday: '1990-01-01' },
			],
		});
	}

	public async cleanup(): Promise<void> {
		for (const undo of this._cleanups.splice(0).reverse()) await undo().catch(() => undefined);
		for (const id of this._projects.splice(0)) {
			await this.api.raw('DELETE', `/projects/${id}`);
		}
		await this.api.dispose();
		for (const client of this._clients.values()) await client.dispose();
		this._clients.clear();
		for (const other of this._others.splice(0)) await other.cleanup();
	}
}
