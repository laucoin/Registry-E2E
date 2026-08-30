import { expect } from '@playwright/test'
import type { RegistryApi } from './api'

export interface DirectoryUser {
	id: string
	email?: string
	role?: { value: string } | string
	visible?: boolean
}

/**
 * The directory is read whole and matched here rather than through `?q=`:
 * trigram search is fuzzy, and these journeys need the row for an EXACT address.
 */
export async function directory(api: RegistryApi): Promise<DirectoryUser[]> {
	const page = await api.get<{ content: DirectoryUser[] }>('/api/v2/users?page=0&size=200')
	return page.content
}

export async function findUserByEmail(api: RegistryApi, email: string): Promise<DirectoryUser> {
	const found = (await directory(api)).find(user => user.email === email)
	expect(found, `${email} must exist in the directory`).toBeTruthy()
	return found!
}

export async function findUserIdByEmail(api: RegistryApi, email: string): Promise<string | undefined> {
	return (await directory(api)).find(user => user.email === email)?.id
}

/**
 * Restores the unprovisioned starting point the `fresh` and `burn` journeys
 * depend on. Best effort: a row the backend refuses to delete must not fail a
 * journey that has already made its assertion.
 */
export async function purgeUserByEmail(api: RegistryApi, email: string): Promise<void> {
	const id = await findUserIdByEmail(api, email)
	if (id) {
		await api.discard(`/api/v2/users/${id}`)
	}
}

export function roleOf(user: DirectoryUser): string | undefined {
	return typeof user.role === 'string' ? user.role : user.role?.value
}
