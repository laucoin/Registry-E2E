import { authentik } from '@/support/idp/authentik';
import { keycloak } from '@/support/idp/keycloak';
import type { IdpAdapter } from '@/support/idp/types';

const ADAPTERS: Record<string, IdpAdapter> = { authentik, keycloak };

/** Choisit l'adaptateur nommé par la variable d'environnement IDP (par défaut : authentik). */
export function idp(): IdpAdapter {
	const name = (process.env.IDP ?? 'authentik').toLowerCase();
	const adapter = ADAPTERS[name];
	if (!adapter) throw new Error(`Unknown IDP "${name}". Expected one of: ${Object.keys(ADAPTERS).join(', ')}`);
	return adapter;
}
