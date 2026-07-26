import { request } from '@playwright/test'

// ADR 021 — the suite must leave the environment as it found it. The project
// lifecycle journey creates data; if a run is interrupted between create and
// delete, a stray "E2E Parity …" project would linger and break the
// zero-projects welcome journey on the next run. This teardown deletes any
// such leftover directly against the backend (test IdP + v2 API), independent
// of the app under test.
const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://localhost:8081'
const ISSUER = process.env.E2E_ISSUER ?? 'http://localhost:8080/realms/laucoin'
const TEST_CLIENT = process.env.E2E_TEST_CLIENT ?? 'registry-test-cli'

export default async function globalTeardown(): Promise<void> {
    const username = process.env.E2E_USERNAME
    const password = process.env.E2E_PASSWORD
    if (!username || !password) {
        return
    }

    const api = await request.newContext()
    try {
        const tokenResponse = await api.post(`${ISSUER}/protocol/openid-connect/token`, {
            form: { client_id: TEST_CLIENT, grant_type: 'password', username, password },
        })
        if (!tokenResponse.ok()) {
            return
        }
        const accessToken = (await tokenResponse.json()).access_token as string
        const auth = { Authorization: `Bearer ${accessToken}` }

        const listResponse = await api.get(`${BACKEND}/api/v2/projects?size=200&q=E2E Parity`, { headers: auth })
        if (!listResponse.ok()) {
            return
        }
        const projects = (await listResponse.json()).content as Array<{ id: string, name?: string }>
        for (const project of projects.filter(p => p.name?.startsWith('E2E Parity'))) {
            await api.delete(`${BACKEND}/api/v2/projects/${project.id}`, { headers: auth })
        }
    }
    finally {
        await api.dispose()
    }
}
