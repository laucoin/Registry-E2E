import type { Page } from '@playwright/test'
import { clickUntilVisible } from './support/antd'
import { seedParticipant } from './support/domain'
import { expect, test } from './support/fixtures'

/**
 * The Nuxt rewrite must render usably down to a 320px viewport (mobile-first),
 * clamped so it never collapses below 320. This spec pins a 320px viewport and
 * asserts the hard invariant — no unintended HORIZONTAL overflow — across the
 * key surfaces, plus the mobile-specific chrome (hamburger menu, full-width
 * drawer). The pinned viewport height is generous so vertical scroll (expected)
 * never masks a horizontal overflow (never acceptable).
 */
test.describe('responsive down to 320px (Nuxt rewrite)', () => {
	test.use({ viewport: { width: 320, height: 900 } })

	/**
	 * The invariant: the document is never wider than its viewport. A 1px
	 * tolerance absorbs sub-pixel rounding; anything more is a real overflow.
	 * The layout is measured SETTLED (network idle) because async data (e.g.
	 * the users list) reflows for a frame as it lands, which is not a real
	 * overflow.
	 */
	async function expectNoHorizontalOverflow(page: Page): Promise<void> {
		await page.waitForLoadState('networkidle')
		const overflow = await page.evaluate(() => {
			const doc = document.documentElement
			return doc.scrollWidth - doc.clientWidth
		})
		expect(overflow, 'horizontal overflow (px) at 320px viewport').toBeLessThanOrEqual(1)
	}

	for (const path of ['/', '/projects', '/users', '/account']) {
		test(`no horizontal overflow at 320px: ${path}`, async ({ page }) => {
			await page.goto(path)
			await expect(page.getByTestId('header-brand')).toBeVisible()
			await expectNoHorizontalOverflow(page)
		})
	}

	/**
	 * The desktop nav is CSS-hidden at 320px, so navigation goes through the
	 * burger. The drawer's copy of the nav carries no testids, so it is driven
	 * by role, scoped to the drawer — the page itself may show its own
	 * "Projects" links, and the display:none desktop nav is ignored anyway.
	 */
	test('the hamburger menu opens and navigates on a narrow viewport', async ({ page }) => {
		await page.goto('/')

		await expect(page.getByTestId('nav-menu-toggle')).toBeVisible()
		await page.getByTestId('nav-menu-toggle').click()

		const projectsLink = page.locator('.ant-drawer-body').getByRole('link', { name: /proje?ts?/i })
		await expect(projectsLink).toBeVisible()
		await projectsLink.click()
		await expect(page).toHaveURL(/\/projects\/?$/)
		await expectNoHorizontalOverflow(page)
	})

	test('a project domain page (list + create drawer) fits 320px', async ({ page, api, project }) => {
		await seedParticipant(api, project.id, {
			firstName: 'Narrow',
			lastName: 'Viewport',
			birthday: '1990-01-01',
		})
		await page.goto(`/projects/${project.id}/participants`)

		await expect(page.getByTestId('participant-row').filter({ hasText: /narrow/i })).toBeVisible()
		await expectNoHorizontalOverflow(page)

		await clickUntilVisible(page.getByTestId('participant-create'), page.getByTestId('participant-form-firstname'))
		await expectNoHorizontalOverflow(page)
	})
})
