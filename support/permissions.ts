import type { Account } from '@support/accounts';
import type { ApiClient } from '@support/api/client';

/** Les trois rôles de projet, et le compte de départ qui les détient dans les projets de départ et ceux que `TestData` prépare. */
export const PROJECT_ROLES = ['PROJECT_ADMINISTRATOR', 'PROJECT_COORDINATOR', 'PROJECT_PARTICIPANT'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const ROLE_ACCOUNTS: Record<ProjectRole, Account> = {
	PROJECT_ADMINISTRATOR: 'administrator',
	PROJECT_COORDINATOR: 'coordinator',
	PROJECT_PARTICIPANT: 'participant',
};

/** Les droits d'une ressource : C, R, U, D (définitive), SOFT_DELETE, RESTORE, ou un droit propre à la ressource (EXPORT, HISTORY_R…). */
export type Right = string;

const PROJECT_PREFIX = 'REGISTRY_PROJECT_';

/**
 * Les permissions que le backend accorde à un compte sur un projet, lues sur `/authentication/user/current` : la matrice des rôles vient
 * ainsi de la même source que celle que le backend applique (tables `tb_project_role_permission` et `tb_user_role_permission`).
 */
export class Permissions {
	private constructor(
		private readonly _project: ReadonlySet<string>,
		private readonly _global: ReadonlySet<string>,
	) {}

	public static async load(api: ApiClient, projectId: string): Promise<Permissions> {
		const { authorities } = await api.send<{ authorities: string[] }>('GET', '/authentication/user/current');
		const prefix = `${projectId}_${PROJECT_PREFIX}`;
		return new Permissions(
			new Set(
				authorities
					.filter((authority) => authority.startsWith(prefix))
					.map((authority) => authority.slice(prefix.length)),
			),
			new Set(authorities.filter((authority) => authority.startsWith('REGISTRY_'))),
		);
	}

	/** Le droit sur une ressource du projet, p. ex. `can('PARTICIPANT', 'SOFT_DELETE')` ; `can('', 'U')` pour le projet lui-même. */
	public can(resource: string, right: Right): boolean {
		return this._project.has(resource ? `${resource}_${right}` : right);
	}

	/** Le droit sur le plan global, p. ex. `canGlobally('USER_U')`. */
	public canGlobally(right: string): boolean {
		return this._global.has(`REGISTRY_${right}`);
	}

	public get projectAuthorities(): string[] {
		return [...this._project].sort();
	}

	public get globalAuthorities(): string[] {
		return [...this._global].sort();
	}
}

const words = (text: string): string[] => text.trim().split(/\s+/).sort();

/**
 * Ce que le backend accorde à chaque rôle de projet dont toutes les options sont activées (migrations `V1_*` ; les `OPTION_*` suivent les
 * options du projet). Un écart avec les authorities réelles fait échouer SEC-01 (`specs/security/permissions.spec.ts`).
 *
 * Écart connu avec le référentiel : il donne la lecture des activités au participant, le backend ne lui accorde aucune permission ACTIVITY_*.
 */
const READ_ONLY_TEAM = `
  ALERT_C ALERT_COMMUNICATION_R ALERT_R ALERT_SOFT_DELETE ALERT_U
  COMMUNICATION_C COMMUNICATION_METADATA_R COMMUNICATION_R COMMUNICATION_SOFT_DELETE COMMUNICATION_U
  GROUP_C GROUP_METADATA_R GROUP_R GROUP_SOFT_DELETE GROUP_U
  MOVEMENT_C MOVEMENT_COMMUNICATION_R MOVEMENT_METADATA_R MOVEMENT_R MOVEMENT_SOFT_DELETE MOVEMENT_U
  OPTION_ACTIVITY OPTION_ALERT OPTION_COMMUNICATION OPTION_VEHICLE
  PARTICIPANT_C PARTICIPANT_METADATA_R PARTICIPANT_R PARTICIPANT_SOFT_DELETE PARTICIPANT_U
  R
`;

const COORDINATION = `
  ACTIVITY_C ACTIVITY_HISTORY_R ACTIVITY_R ACTIVITY_RESTORE ACTIVITY_SOFT_DELETE ACTIVITY_U
  ALERT_RESTORE COMMUNICATION_RESTORE GROUP_RESTORE MOVEMENT_RESTORE PARTICIPANT_RESTORE
  PARTICIPANT_HISTORY_R PROFILE_R
  VEHICLE_C VEHICLE_HISTORY_R VEHICLE_R VEHICLE_RESTORE VEHICLE_SOFT_DELETE VEHICLE_U
`;

const ADMINISTRATION = `
  ACTIVITY_D ALERT_D COMMUNICATION_D GROUP_D MOVEMENT_D PARTICIPANT_D VEHICLE_D
  PARTICIPANT_EXPORT
  PROFILE_C PROFILE_D PROFILE_METADATA_R PROFILE_RESTORE PROFILE_SOFT_DELETE PROFILE_U
  D RESTORE SOFT_DELETE U
`;

export const EXPECTED_PROJECT_AUTHORITIES: Record<ProjectRole, string[]> = {
	PROJECT_PARTICIPANT: words(READ_ONLY_TEAM),
	PROJECT_COORDINATOR: words(`${READ_ONLY_TEAM} ${COORDINATION}`),
	PROJECT_ADMINISTRATOR: words(`${READ_ONLY_TEAM} ${COORDINATION} ${ADMINISTRATION}`),
};

/** Les permissions globales : le rôle USER_ADMINISTRATOR administre la plateforme, tout USER peut créer un projet. */
export const EXPECTED_GLOBAL_AUTHORITIES = {
	USER_ADMINISTRATOR: words(
		'REGISTRY_JOB_C REGISTRY_PROFILE_C REGISTRY_PROJECT_C REGISTRY_PROJECT_R REGISTRY_USER_D REGISTRY_USER_METADATA_R REGISTRY_USER_R REGISTRY_USER_RESTORE REGISTRY_USER_SOFT_DELETE REGISTRY_USER_U',
	),
	USER: words('REGISTRY_PROJECT_C'),
} as const;
