/** Comptes qui peuvent se connecter et dont la session est préparée à l'avance. */
export const ACCOUNTS = ['administrator', 'coordinator', 'participant', 'blocked-profile'] as const;

/** Bloqués au niveau utilisateur : l'application les refuse après l'étape IdP, leurs scénarios se connectent donc en direct. */
export const BLOCKED_ACCOUNTS = ['blocked-user'] as const;

export type Account = (typeof ACCOUNTS)[number] | (typeof BLOCKED_ACCOUNTS)[number];

export const password = (): string => process.env.AU_PASS ?? 'dev123';
export const authFile = (account: Account): string => `.auth/${account}.json`;
