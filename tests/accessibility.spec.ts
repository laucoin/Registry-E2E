import { expectNoBlockingA11yViolations } from './support/axe'
import { expect, test } from './support/fixtures'

/**
 * The accessibility gate over the app's real rendered pages, held to
 * WCAG 2.2 AA.
 */
test.describe('accessibility (rewrite / WCAG 2.2 AA)', () => {
	test('the shell and navigation surfaces have no blocking violations', async ({ page }) => {
		await page.goto('/')
		await expectNoBlockingA11yViolations(page)

		await page.goto('/projects')
		await expect(page.getByText(/bienvenue|welcome|dernière actualisation|last refresh/i).first()).toBeVisible()
		await expectNoBlockingA11yViolations(page)
	})

	/**
	 * Seeds an empty project through the app's BFF proxy so the scoped shell, an
	 * empty domain and the create drawer render — labelled form fields being the
	 * crux of the accessibility target — then cleans up.
	 */
	test('a project workspace shell and the create form have no blocking violations', async ({ page, project }) => {
		await page.goto(`/projects/${project.id}/participants`)
		await expect(page.getByTestId('participant-create')).toBeVisible()
		await expectNoBlockingA11yViolations(page)

		await page.getByRole('button', { name: /ajouter un participant|add participant/i }).click()
		await expect(page.getByRole('textbox', { name: /prénom|first name/i })).toBeVisible()
		await expectNoBlockingA11yViolations(page)
	})

	/**
	 * The public legal/compliance pages (mentions légales, privacy policy,
	 * accessibility statement) are part of the shell surface and must clear the
	 * same gate — including the cookie-inventory table on /privacy.
	 */
	test('the legal, privacy and accessibility pages have no blocking violations', async ({ page }) => {
		for (const path of ['/legal', '/privacy', '/accessibility']) {
			await page.goto(path)
			await expect(page.locator('h1')).toBeVisible()
			await expectNoBlockingA11yViolations(page)
		}
	})

	/**
	 * The contrast pass: a populated list previously tripped
	 * color-contrast on AntD defaults — muted descriptions (colorTextDescription
	 * ≈ 3.3:1) and tinted preset status tags (≈ 3.4:1). Fixed by an explicit
	 * colorTextDescription token (per mode) and AA-safe SOLID status tags
	 * (STATUS_COLOR). Gated in BOTH modes, resolving each mode the way the app
	 * does — the SSR theme hint cookie + a fresh load — rather than a
	 * client-side toggle, which leaves AntD's css-in-js mid-transition and
	 * yields false contrast readings.
	 */
	test('populated data lists meet contrast in both light and dark modes', async ({ page, baseURL }) => {
		const domain = new URL(baseURL!).hostname
		for (const mode of ['LIGHT', 'DARK'] as const) {
			await page.context().addCookies([{
				name: 'registry-preferences',
				value: encodeURIComponent(JSON.stringify({ themeMode: mode })),
				domain,
				path: '/',
			}])
			await page.goto('/users')
			await expectNoBlockingA11yViolations(page)
		}
	})
})
