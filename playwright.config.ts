import { readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Minimal .env loading (no dotenv dependency).
try {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
        const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (match && !process.env[match[1]]) {
            process.env[match[1]] = match[2]
        }
    }
}
catch {
    // no .env — rely on the ambient environment
}

// ADR 021 — one parity suite, two targets. The journeys and assertions are
// identical; only the baseURL and the login *fixture* (auth.setup.ts) differ.
// Select a target with --project=angular | --project=nuxt.
const ANGULAR_URL = process.env.E2E_ANGULAR_URL ?? 'http://localhost:4200'
const NUXT_URL = process.env.E2E_NUXT_URL ?? 'http://localhost:3000'

export default defineConfig({
    testDir: './tests',
    // The suite drives ONE shared backend database, so data-mutating journeys
    // (project create/delete) must never run concurrently with state-asserting
    // ones (the zero-projects welcome). Serialize: one worker, no parallelism.
    fullyParallel: false,
    workers: 1,
    retries: process.env.CI ? 2 : 0,
    reporter: [ [ 'list' ], [ 'html', { open: 'never' } ] ],
    // Clean any stray lifecycle data before AND after the run, so an
    // interrupted previous run can't fail the zero-projects welcome journey.
    globalSetup: './tests/global-setup.ts',
    globalTeardown: './tests/global-teardown.ts',
    use: {
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        {
            name: 'angular-setup',
            testMatch: /auth\.setup\.ts/,
            use: { baseURL: ANGULAR_URL },
        },
        {
            name: 'angular',
            testIgnore: /auth\.setup\.ts/,
            dependencies: [ 'angular-setup' ],
            use: {
                ...devices['Desktop Chrome'],
                baseURL: ANGULAR_URL,
                storageState: '.auth/angular.json',
            },
        },
        {
            name: 'nuxt-setup',
            testMatch: /auth\.setup\.ts/,
            use: { baseURL: NUXT_URL },
        },
        {
            name: 'nuxt',
            testIgnore: /auth\.setup\.ts/,
            dependencies: [ 'nuxt-setup' ],
            use: {
                ...devices['Desktop Chrome'],
                baseURL: NUXT_URL,
                storageState: '.auth/nuxt.json',
            },
        },
    ],
})
