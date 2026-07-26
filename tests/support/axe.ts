import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

const BLOCKING_IMPACTS = new Set(['serious', 'critical'])

/**
 * Accessibility as an enforced gate, not aspiration.
 * The gate fails on serious + critical violations (the ones that block users);
 * minor/moderate are tracked but not yet failing, so the gate can be adopted
 * without a big-bang remediation.
 *
 * NO RULES ARE DISABLED. `aria-required-attr` and `aria-valid-attr-value` used
 * to be waived for Ant Design's combobox internals (the accepted "not
 * ARIA-first" cost): vc-select's inner role="combobox" omitted aria-expanded
 * while closed and pointed aria-owns/aria-controls at a listbox that only
 * exists once opened. `aria-required-children` likewise failed wherever Tabs
 * carried a `#rightExtra`, because AntD put role="tablist" on `.ant-tabs-nav`,
 * which wraps the extra content as well as the tabs — the role now sits on
 * `.ant-tabs-nav-list`, which owns the tabs alone. Both are fixed at the source
 * by Registry-Frontend's patches/ant-design-vue@4.2.6.patch, so the full WCAG
 * 2.2 AA rule set runs strict. Do not re-add a waiver to make a scan pass — fix
 * the markup, or the patch.
 */
export async function expectNoBlockingA11yViolations(page: Page, tags: string[] = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']): Promise<void> {
	const results = await new AxeBuilder({ page })
		.withTags(tags)
		.analyze()

	const blocking = results.violations.filter(v => BLOCKING_IMPACTS.has(v.impact ?? ''))
	const summary = blocking.map(v => `${v.impact} · ${v.id}: ${v.help} (${v.nodes.length} node[s])`)

	expect(summary, `axe blocking violations on ${page.url()}`).toEqual([])
}
