import type { APIResponse } from '@playwright/test';

import { randomUUID } from 'node:crypto';

import type { Account } from '@support/accounts';
import { ApiClient } from '@support/api/client';
import { type ApiDateTime, DAY_MS, isoDate } from '@support/dates';

export type ProjectOption = 'VEHICLE' | 'ACTIVITY' | 'COMMUNICATION' | 'ALERT';
export type ProjectRole = 'PROJECT_ADMINISTRATOR' | 'PROJECT_COORDINATOR' | 'PROJECT_PARTICIPANT';
export type MovementType = 'IN' | 'OUT';
/** Motifs que le backend accepte : les invités entrent (IN) pour ceux-ci, les participants enregistrés sortent (OUT) pour les autres. */
export type GuestReason = 'EMERGENCY' | 'LOGISTICS' | 'PARTNER_ANIMATION' | 'VISIT';
export type RegisteredReason = 'SHOPPING' | 'MEDICAL' | 'DEFINITIVE_DEPARTURE' | 'OTHER';

export interface ParticipantMovement {
	type: MovementType;
	participantIds: string[];
	reason?: RegisteredReason;
	activityId?: string;
	dateTime?: string;
	vehicleId?: string;
}

export interface ParticipantState {
	lastName: string;
	effectiveArrival: string | null;
	effectiveDeparture: string | null;
}

/** Le corps d'un mouvement d'inscrits : un contenu par participant, avec le véhicule éventuel. */
function movementBody(movement: ParticipantMovement): Record<string, unknown> {
	const { participantIds, dateTime, vehicleId, ...rest } = movement;
	return {
		dateTime: dateTime ?? new Date().toISOString(),
		content: participantIds.map((participantId) => ({ participantId, vehicleId })),
		...rest,
	};
}

export interface Project {
	id: string;
	name: string;
}
export interface Created {
	id: string;
}

const unique = (prefix: string): string => `${prefix} ${randomUUID().slice(0, 8)}`;

/**
 * Crée via l'API les données dont un scénario a besoin, avec le compte donné, et supprime les projets qu'il a
 * créés une fois le test terminé (supprimer un projet supprime tout ce qu'il contient).
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
		const name = typeof overrides.name === 'string' ? overrides.name : unique('E2E project');
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

	/** L'identifiant du profil d'un compte de départ dans un projet. */
	public async profileIdOf(projectId: string, account: Account): Promise<string> {
		const { email } = await this.userOf(account);
		const page = await this.api.send<{ content: { id: string; user: { email: string } }[] }>(
			'GET',
			`/projects/${projectId}/profiles?size=100`,
		);
		const profile = page.content.find((candidate) => candidate.user.email === email);
		if (!profile) throw new Error(`No profile of "${account}" in project ${projectId}`);
		return profile.id;
	}

	/** Ajoute le projet aux favoris du compte de ce `TestData`. */
	public favorite(projectId: string): Promise<unknown> {
		return this.api.send('POST', `/projects/${projectId}/favorite`);
	}

	/** L'identifiant du projet de ce nom que le compte voit, ou `undefined` s'il ne le voit pas. */
	public async projectIdNamed(name: string): Promise<string | undefined> {
		const page = await this.api.send<{ content: Project[] }>('GET', `/projects?q=${encodeURIComponent(name)}`);
		return page.content.find((project) => project.name === name)?.id;
	}

	/** L'utilisateur d'un compte de départ, tel que le backend le connaît. */
	public async userOf(account: Account): Promise<{ id: string; email: string; firstName: string; lastName: string }> {
		return (await this.apiAs(account)).send('GET', '/authentication/user/current');
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
	public onCleanup(undo: () => Promise<unknown>): void {
		this._cleanups.push(undo);
	}

	/** Enregistre un projet créé via l'UI pour qu'il soit supprimé avec les autres, par le compte qui l'a créé (il en est l'administrateur). */
	public track(projectId: string, owner: Account = 'administrator'): void {
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
	 * Donne à un autre compte un profil dans le projet, avec une plage d'accès au besoin, et, sauf indication contraire,
	 * lui fait accepter l'invitation (un compte de départ n'est invité qu'aux projets de départ).
	 */
	public async invite(
		projectId: string,
		account: Account,
		role: ProjectRole,
		accept = true,
		access: { startAccess?: ApiDateTime; endAccess?: ApiDateTime } = {},
	): Promise<void> {
		const invitee = await ApiClient.as(account);
		try {
			const { email } = await invitee.send<{ email: string }>('GET', '/authentication/user/current');
			await this.api.send('POST', `/projects/${projectId}/profiles`, { emails: [email], role, ...access });
			if (accept) await this._acceptInvitation(invitee, projectId, account);
		} finally {
			await invitee.dispose();
		}
	}

	private async _acceptInvitation(invitee: ApiClient, projectId: string, account: Account): Promise<void> {
		const mine = await invitee.send<{ content: { id: string; project: { id: string } }[] }>(
			'GET',
			'/users/profiles?size=100',
		);
		const profile = mine.content.find((candidate) => candidate.project.id === projectId);
		if (!profile) throw new Error(`No invitation to project ${projectId} found for "${account}"`);
		await invitee.send('POST', `/users/profiles/${profile.id}/accept/true`);
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

	/** Un mouvement de participants enregistrés. OUT demande un motif ou une activité ; IN ne doit avoir ni l'un ni l'autre. */
	public participantMovement(projectId: string, movement: ParticipantMovement): Promise<Created> {
		return this.api.send('POST', `/projects/${projectId}/movements`, movementBody(movement));
	}

	/** Le même mouvement, dont la réponse est renvoyée telle quelle pour les scénarios qui attendent un refus. */
	public tryParticipantMovement(projectId: string, movement: ParticipantMovement): Promise<APIResponse> {
		return this.api.raw('POST', `/projects/${projectId}/movements`, movementBody(movement));
	}

	/** Le participant tel que le backend le décrit, avec ses dates effectives d'arrivée et de départ. */
	public participantOf(projectId: string, participantId: string): Promise<ParticipantState> {
		return this.api.send('GET', `/projects/${projectId}/participants/${participantId}`);
	}

	/** Les participants que le formulaire de mouvement propose par défaut à cet instant : ceux qui y sont disponibles. */
	public async availableParticipantIds(projectId: string, at: string): Promise<string[]> {
		const query = `contentType=REGISTERED&at=${encodeURIComponent(at)}&all=false`;
		const found = await this.api.send<{ participants: Created[] }>(
			'GET',
			`/projects/${projectId}/movements/search/participants-and-groups?${query}`,
		);
		return found.participants.map((participant) => participant.id);
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
			// Le backend exige `content`, même vide, comme le frontend l'envoie toujours.
			content: [],
			guests: movement.guests ?? [
				{ firstName: unique('Guest'), lastName: unique('Visitor'), birthday: '1990-01-01' },
			],
		});
	}

	/** Supprime un mouvement sans le supprimer définitivement : il reste visible de ceux qui peuvent le restaurer. */
	public softDeleteMovement(projectId: string, movementId: string): Promise<unknown> {
		return this.api.send('POST', `/projects/${projectId}/movements/${movementId}/disable`);
	}

	public async cleanup(): Promise<void> {
		for (const undo of this._cleanups.splice(0).reverse()) await undo().catch(() => undefined);
		for (const id of this._projects.splice(0)) await this.api.raw('DELETE', `/projects/${id}`);
		await this._disposeClients();
		for (const other of this._others.splice(0)) await other.cleanup();
	}

	private async _disposeClients(): Promise<void> {
		await this.api.dispose();
		for (const client of this._clients.values()) await client.dispose();
		this._clients.clear();
	}
}
