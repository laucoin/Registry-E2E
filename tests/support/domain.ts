import { expect, type Page } from '@playwright/test'
import { registryApi, type RegistryApi } from './api'

/**
 * Nuxt-native domain journeys need a project (and sometimes seed rows) to act
 * on. We create/tear-down through the BFF using the caller's own authenticated
 * context — fast and deterministic, and it exercises the same proxy the app
 * uses.
 *
 * A `Page` is accepted alongside a `RegistryApi` so the specs written before the
 * fixture layer keep compiling while they are migrated; the factories themselves
 * only ever use the api.
 */
export type ApiSource = Page | RegistryApi

function api(source: ApiSource): RegistryApi {
	return 'raw' in source ? source : registryApi(source)
}

export async function csrf(source: ApiSource): Promise<string> {
	const me = await api(source).get<{ csrf: string }>('/auth/me')
	return me.csrf
}

/**
 * Every test project name carries this prefix so the stray-data cleanup in
 * global-setup/teardown can find and delete leftovers from an interrupted run,
 * whatever the individual journey called its project. A rename that drops it
 * makes the project invisible to that sweep, so renames keep it too.
 */
export const E2E_PROJECT_PREFIX = 'E2E '

export const OPTION = {
	VEHICLE: 'VEHICLE',
	ACTIVITY: 'ACTIVITY',
	COMMUNICATION: 'COMMUNICATION',
	ALERT: 'ALERT',
} as const
export type ProjectOption = typeof OPTION[keyof typeof OPTION]

/**
 * The backend's option dependency graph: COMMUNICATION requires ACTIVITY and
 * ALERT requires both, so a partial set is rejected with PROJECT_OPTIONS_MISSING.
 * Naming the valid combinations stops four specs spelling them out and drifting.
 */
export const OPTIONS_COMMUNICATION: ProjectOption[] = [OPTION.ACTIVITY, OPTION.COMMUNICATION]
export const OPTIONS_ALERT: ProjectOption[] = [...OPTIONS_COMMUNICATION, OPTION.ALERT]
export const OPTIONS_ALL: ProjectOption[] = [OPTION.VEHICLE, ...OPTIONS_ALERT]

export const PROJECT_ROLE = {
	ADMINISTRATOR: 'PROJECT_ADMINISTRATOR',
	COORDINATOR: 'PROJECT_COORDINATOR',
	PARTICIPANT: 'PROJECT_PARTICIPANT',
} as const
export type ProjectRole = typeof PROJECT_ROLE[keyof typeof PROJECT_ROLE]

export const USER_ROLE = {
	ADMINISTRATOR: 'USER_ADMINISTRATOR',
	USER: 'USER',
} as const

/**
 * A fixed window; date-ranged seeds (movements, alerts, guests) MUST fall inside
 * it for the backend to accept them — never seed with `new Date()`, which drifts
 * out of the window.
 */
export const SEED_BEGIN = '2026-07-01'
export const SEED_END = '2026-08-31'
export const SEED_DATE_TIME = '2026-07-10T09:00:00.000Z'

/**
 * The ONE place a real clock is correct. Everything else seeds inside the fixed
 * window above, but "arrivals today" and "departures today" are defined against
 * the current date by the backend, so a journey asserting them has to agree with
 * it. Safe only because today falls inside the seeded project window — if the
 * suite is ever run outside 2026-07-01..2026-08-31, those journeys are the first
 * to break, and correctly so.
 *
 * The day is the LOCAL calendar day, never the UTC one: the backend answers
 * CURRENT_DATE on a connection pinned to its own zone, and the runner shares
 * that zone. `toISOString()` would name yesterday for every hour the machine
 * sits east of UTC — between midnight and 02:00 CEST it silently seeded these
 * journeys one day off and they failed as a matter of the clock.
 */
export function todayIso(): string {
	return daysFromTodayIso(0)
}

export function daysFromTodayIso(offset: number): string {
	const date = new Date()
	date.setDate(date.getDate() + offset)
	const month = `${date.getMonth() + 1}`.padStart(2, '0')
	const day = `${date.getDate()}`.padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

/**
 * One prefix, always, and never a collision. Some call sites used to pass a name
 * already carrying the prefix and some did not, and only three added uniqueness,
 * so two specs seeding "E2E groups" could match each other's rows.
 */
let sequence = 0

export function uniqueName(label: string): string {
	sequence += 1
	const trimmed = label.replace(E2E_PROJECT_PREFIX, '').slice(0, 60)
	return `${E2E_PROJECT_PREFIX}${trimmed} ${process.pid}-${sequence}`
}

export async function createProject(
	source: ApiSource,
	name = 'domain journey',
	options: readonly ProjectOption[] = [],
): Promise<string> {
	const fullName = name.startsWith(E2E_PROJECT_PREFIX) ? name : `${E2E_PROJECT_PREFIX}${name}`
	const created = await api(source).post<{ id: string }>('/api/v2/projects', {
		name: fullName,
		begin: { date: SEED_BEGIN },
		end: { date: SEED_END },
		options: [...options],
	})
	return created.id
}

/**
 * Re-declare a project's options after creation, which is how a module gets
 * switched OFF mid-life. The endpoint is a PATCH but its body is the whole
 * writer DTO — `name` is @NotBlank there — so the project is read back and its
 * own fields are resent unchanged alongside the new option set.
 */
export async function setProjectOptions(
	source: ApiSource,
	projectId: string,
	options: readonly ProjectOption[],
): Promise<void> {
	const project = await api(source).get<{
		name: string
		begin?: { date?: string, time?: string } | null
		end?: { date?: string, time?: string } | null
	}>(`/api/v2/projects/${projectId}`)
	await api(source).patch(`/api/v2/projects/${projectId}`, {
		name: project.name,
		begin: project.begin ?? null,
		end: project.end ?? null,
		options: [...options],
	})
}

export async function deleteProject(source: ApiSource, projectId: string): Promise<void> {
	await api(source).discard(`/api/v2/projects/${projectId}`)
}

export async function seedParticipant(
	source: ApiSource,
	projectId: string,
	participant: { firstName: string, lastName: string, birthday: string },
): Promise<string> {
	const created = await api(source).post<{ id: string }>(
		`/api/v2/projects/${projectId}/participants`,
		participant,
	)
	return created.id
}

/**
 * A fresh alert is IN_PROGRESS — the state a communication can attach to. The
 * dateTime must sit inside the seeded project's range. (Creating an alert also
 * spawns an initial communication server-side, so alerts can't be deleted once
 * they carry one — journeys that need a deletable target use movements instead.)
 */
export async function seedAlert(
	source: ApiSource,
	projectId: string,
	alert: { title: string, dateTime: string, message?: string | null } = {
		title: 'Seed alert',
		dateTime: SEED_DATE_TIME,
	},
): Promise<string> {
	const created = await api(source).post<{ id: string }>(`/api/v2/projects/${projectId}/alerts`, alert)
	return created.id
}

export async function seedActivity(
	source: ApiSource,
	projectId: string,
	activity: { name: string, description?: string, duration?: string } = { name: 'Rando' },
): Promise<string> {
	const created = await api(source).post<{ id: string }>(
		`/api/v2/projects/${projectId}/activities`,
		activity,
	)
	return created.id
}

export async function seedVehicle(
	source: ApiSource,
	projectId: string,
	vehicle: { licensePlate: string, brand: string, model: string },
): Promise<string> {
	const created = await api(source).post<{ id: string }>(`/api/v2/projects/${projectId}/vehicles`, vehicle)
	return created.id
}

/**
 * A group must carry at least one member from the outset — the backend rejects
 * an empty one with GROUP_MEMBERS_EMPTY.
 */
/**
 * A group's own availability window is optional at creation, but it is what the
 * "due today" panels key on — so the seeder accepts it rather than forcing a
 * follow-up PATCH.
 */
export async function seedGroup(
	source: ApiSource,
	projectId: string,
	group: {
		name: string
		members: string[]
		startAvailability?: { date: string, time?: string | null }
		endAvailability?: { date: string, time?: string | null }
	},
): Promise<string> {
	const created = await api(source).post<{ id: string }>(`/api/v2/projects/${projectId}/groups`, group)
	return created.id
}

export interface MovementContent {
	participantId: string
	vehicleId?: string | null
	poolName?: string | null
}

/**
 * `reason` and `activityId` are mutually exclusive (@BothCannotBeDefined) and a
 * registered OUT needs one of them, so callers pass whichever justifies the
 * movement and leave the other null. An IN needs neither.
 */
export async function seedMovement(
	source: ApiSource,
	projectId: string,
	movement: {
		type?: 'IN' | 'OUT'
		dateTime?: string
		reason?: string | null
		activityId?: string | null
		content: MovementContent[]
	},
): Promise<string> {
	const created = await api(source).post<{ id: string }>(`/api/v2/projects/${projectId}/movements`, {
		type: movement.type ?? 'OUT',
		dateTime: movement.dateTime ?? SEED_DATE_TIME,
		reason: movement.reason ?? null,
		activityId: movement.activityId ?? null,
		content: movement.content.map(entry => ({
			participantId: entry.participantId,
			vehicleId: entry.vehicleId ?? null,
			poolName: entry.poolName ?? null,
		})),
	})
	return created.id
}

export interface GuestSeed {
	firstName: string
	lastName: string
	birthday: string
}

/**
 * Guest movements invert by direction (@MovementGuestContent): an entry carries
 * brand-new people under `guests` and a reason is mandatory; an exit references
 * guests already on site under `content` and may omit the reason. The key that
 * does not apply is left out entirely rather than sent empty, mirroring what the
 * guest drawer posts.
 */
export async function seedGuestMovement(
	source: ApiSource,
	projectId: string,
	movement: {
		type: 'IN' | 'OUT'
		dateTime?: string
		reason?: string | null
		guests?: GuestSeed[]
		participantIds?: string[]
	},
): Promise<string> {
	const data: Record<string, unknown> = {
		type: movement.type,
		dateTime: movement.dateTime ?? SEED_DATE_TIME,
		reason: movement.reason ?? null,
	}
	if (movement.type === 'IN') {
		data.guests = movement.guests ?? []
	} else {
		data.content = (movement.participantIds ?? []).map(participantId => ({ participantId }))
	}
	const created = await api(source).post<{ id: string }>(
		`/api/v2/projects/${projectId}/movements/guests`,
		data,
	)
	return created.id
}

export async function seedCommunication(
	source: ApiSource,
	projectId: string,
	communication: {
		message: string
		dateTime?: string
		movementId?: string | null
		alertId?: string | null
		onBehalfOfMovement?: boolean
	},
): Promise<string> {
	const data: Record<string, unknown> = {
		message: communication.message,
		dateTime: communication.dateTime ?? SEED_DATE_TIME,
	}
	if (communication.movementId) {
		data.movementId = communication.movementId
	}
	if (communication.alertId) {
		data.alertId = communication.alertId
	}
	if (communication.onBehalfOfMovement !== undefined) {
		data.onBehalfOfMovement = communication.onBehalfOfMovement
	}
	const created = await api(source).post<{ id: string }>(
		`/api/v2/projects/${projectId}/communications`,
		data,
	)
	return created.id
}

/**
 * Movement motives are seeded reference DATA, not constants, and the backend
 * localises their labels — so a journey that needs one looks it up. `kind`
 * separates a true reason from an activity, which the same endpoint merges in.
 * Fails loudly when the environment has none, because a missing motive
 * otherwise turns into an opaque 400 several lines later.
 */
export async function movementReason(
	source: ApiSource,
	projectId: string,
	type: 'IN' | 'OUT' = 'OUT',
	contentType: 'REGISTERED' | 'GUEST' = 'REGISTERED',
): Promise<{ value: string, label: string }> {
	const reasons = await api(source).get<Array<{ kind: string, value: string, label: string }>>(
		`/api/v2/projects/${projectId}/movements/reasons?type=${type}&contentType=${contentType}`,
	)
	const reason = (reasons ?? []).find(candidate => candidate.kind === 'REASON')
	expect(reason, `${type}/${contentType} movement reasons must exist in the environment`).toBeTruthy()
	return reason!
}

export interface AccessWindow {
	startAccess?: { date: string, time?: string }
	endAccess?: { date: string, time?: string }
}

/**
 * The two-step membership handshake. Invites BY EMAIL rather than by user id:
 * the global USER role carries no directory read, and an unknown email is the
 * documented way a light user is created — so the email path is the one that
 * works for every actor. An INVITED profile grants nothing until it is accepted,
 * which is why both halves live in one helper. Returns the profile id, which the
 * block, unblock, role-change and access-window scenarios address directly.
 */
export async function inviteAndAccept(
	admin: ApiSource,
	invitee: ApiSource,
	projectId: string,
	inviteeEmail: string,
	role: ProjectRole,
	access: AccessWindow = {},
): Promise<string> {
	await invite(admin, projectId, inviteeEmail, role, access)
	return acceptInvitation(invitee, projectId)
}

export async function invite(
	admin: ApiSource,
	projectId: string,
	inviteeEmail: string,
	role: ProjectRole,
	access: AccessWindow = {},
): Promise<void> {
	await api(admin).post(`/api/v2/projects/${projectId}/profiles`, {
		emails: [inviteeEmail],
		role,
		...access,
	})
}

export async function acceptInvitation(invitee: ApiSource, projectId: string): Promise<string> {
	const profileId = await pendingInvitation(invitee, projectId)
	await api(invitee).post(`/api/v2/users/profiles/${profileId}/accept`)
	return profileId
}

export async function pendingInvitation(invitee: ApiSource, projectId: string): Promise<string> {
	const invitations = await api(invitee).get<{ content: Array<{ id: string, project: { id: string } }> }>(
		'/api/v2/users/profiles?status=INVITED&size=200',
	)
	const match = invitations.content.find(profile => profile.project?.id === projectId)
	expect(match, `an INVITED profile on ${projectId} must exist`).toBeTruthy()
	return match!.id
}
