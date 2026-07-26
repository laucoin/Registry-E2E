import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Ant Design teleports its overlays into <body> and puts test ids on wrapper
 * elements rather than on the interactive node, so the same few drive sequences
 * recurred verbatim across the suite. These helpers own the WIDGET quirk; the
 * specs keep owning the journey.
 *
 * The title/item helpers deliberately return LOCATORS rather than running an
 * assertion. Call sites differ — some assert `toHaveText`, others
 * `toContainText` — and a shared assertion helper would have to pick one and
 * would silently loosen the others.
 */

export function drawerTitle(page: Page): Locator {
	return page.locator('.ant-drawer-title')
}

export function modalTitle(page: Page): Locator {
	return page.locator('.ant-modal-title')
}

/**
 * Click a control and wait for what it reveals, tolerating the hydration window.
 * Drawers, dropdown menus and wizard steps all go through here.
 *
 * SSR paints the control before hydration attaches its click handler, so a click
 * landing in that window is swallowed in silence: the button is visible, enabled
 * and actionable by every check Playwright makes, the press registers, and
 * nothing opens — the failure then surfaces much later, as a timeout on
 * something that was supposed to appear. The app emits no "hydrated" signal to
 * wait on, so the click is retried until the target is actually there. A click
 * that worked passes on the first pass and is never repeated.
 *
 * Retrying is only safe because every trigger it drives is idempotent (each sets
 * a state rather than toggling it); a true toggle would need its own helper.
 */
export async function clickUntilVisible(trigger: Locator, target: Locator): Promise<void> {
	await expect(async () => {
		await trigger.click()
		await expect(target).toBeVisible({ timeout: 1000 })
	}).toPass({ timeout: 15000 })
}

/**
 * The clickable row is the visible list item; the `role="option"` node AntD also
 * renders is a hidden accessibility mirror and cannot be clicked.
 */
export function selectItem(page: Page, label: RegExp): Locator {
	return page.locator('.ant-select-item-option').filter({ hasText: label })
}

/**
 * The dropdown overlays the drawer footer, so it is dismissed by clicking the
 * drawer title before anything below it can be reached.
 */
export async function selectOption(page: Page, testId: string, label: RegExp): Promise<void> {
	await page.getByTestId(testId).click()
	await selectItem(page, label).click()
	await drawerTitle(page).click()
}

/**
 * A DatePicker's input is readonly, so a value goes in as keystrokes rather than
 * fill(). A picker carrying a TIME panel commits through its OK button while a
 * date-only picker commits on Enter — using the wrong one leaves the panel open
 * over the submit button, which surfaces as a mystifying click timeout.
 */
export async function fillDate(page: Page, testId: string, value: string): Promise<void> {
	const input = page.getByTestId(testId).locator('input')
	await input.click()
	await input.pressSequentially(value)
	await input.press('Enter')
}

export async function fillDateTime(page: Page, testId: string, value: string): Promise<void> {
	const input = page.getByTestId(testId).locator('input')
	await input.click()
	await input.pressSequentially(value)
	await page.locator('.ant-picker-ok button').click()
}

/**
 * Replacing an existing value needs the field cleared first, and fill() is
 * refused on the readonly input — hence the platform select-all before typing.
 * The keystroke delay is deliberate: the picker re-parses on every input event
 * and drops characters when they arrive faster than it can.
 */
export async function replaceDate(page: Page, testId: string, value: string): Promise<void> {
	const input = page.getByTestId(testId).locator('input')
	await input.click()
	await page.keyboard.press('ControlOrMeta+a')
	await input.pressSequentially(value, { delay: 20 })
	await page.keyboard.press('Enter')
}

/**
 * Row actions live in a portal, so the menu item is addressed on the page rather
 * than inside the row that opened it.
 */
export async function rowAction(page: Page, row: Locator, domain: string, verb: string): Promise<void> {
	await row.getByTestId(`${domain}-row-actions`).click()
	await page.getByTestId(`${domain}-action-${verb}`).click()
}

export async function sendThreadMessage(page: Page, message: string): Promise<void> {
	await page.getByTestId('thread-message').fill(message)
	await page.getByTestId('thread-send').click()
}

/**
 * The disable → assert-enable → delete → confirm → gone tail is identical across
 * the four domain lifecycle journeys, differing only by test-id prefix. Only the
 * tail is shared: what precedes it is each domain's own create form, which is
 * where the failures actually happen and is far more legible written out.
 */
export async function expectDisableThenDelete(
	page: Page,
	domain: string,
	row: Locator,
	match: RegExp,
): Promise<void> {
	await row.getByTestId(`${domain}-row-actions`).click()
	await page.getByTestId(`${domain}-action-disable`).click()

	await row.getByTestId(`${domain}-row-actions`).click()
	await expect(page.getByTestId(`${domain}-action-enable`)).toBeVisible()
	await page.getByTestId(`${domain}-action-delete`).click()
	await page.getByTestId(`${domain}-delete-confirm`).click()

	await expect(page.getByTestId(`${domain}-row`).filter({ hasText: match })).toHaveCount(0)
}

/**
 * Where a project domain lives in the shell since the operations/settings
 * split: `movements` and `alerts` are tabs, everything else sits behind the
 * Paramétrage menu. Tests assert on presence in the NAV, so they must look in
 * the right half — checking for a tab that no longer exists would pass for the
 * wrong reason.
 */
const SETTINGS_DOMAINS = ['members', 'participants', 'groups', 'vehicles', 'activities']

export function isSettingsDomain(domain: string): boolean {
	return SETTINGS_DOMAINS.includes(domain)
}

/**
 * Resolves a domain's nav entry, opening the Paramétrage menu first when the
 * domain lives there. Returns a locator the caller asserts on.
 *
 * Most callers assert ABSENCE (`toHaveCount(0)`) to prove a gate, and absence is
 * only evidence once the surface that would have held the entry is proven to be
 * there: a swallowed menu click, or a shell that has not rendered yet, leaves an
 * empty locator that passes such an assertion while proving nothing. So the tab
 * bar is awaited before the settings button is judged missing, and the menu is
 * opened through `clickUntilVisible` and confirmed open before its entries are read.
 *
 * A caller with no settings access at all legitimately has no button: with the
 * shell rendered, that absence IS the answer, and the empty locator is correct.
 */
export async function projectNavEntry(page: Page, domain: string): Promise<Locator> {
	if (!isSettingsDomain(domain)) {
		return page.getByTestId(`project-tab-${domain}`)
	}
	await expect(page.getByTestId('project-tab-dashboard')).toBeVisible()
	const trigger = page.getByTestId('project-settings')
	if (await trigger.count() > 0) {
		await clickUntilVisible(trigger, page.locator('.ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu').first())
	}
	return page.getByTestId(`project-settings-${domain}`)
}
