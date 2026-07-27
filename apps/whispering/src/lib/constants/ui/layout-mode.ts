/**
 * Layout modes for the application navigation.
 *
 * - `sidebar`: Uses the collapsible vertical sidebar for navigation.
 *   Nav items show on home page but hidden on config pages.
 * - `nav-items`: Uses inline navigation items in the header.
 *   No sidebar, nav items visible on all pages.
 */
export const LAYOUT_MODES = ['sidebar', 'nav-items'] as const;
export type LayoutMode = (typeof LAYOUT_MODES)[number];

export const LAYOUT_MODE_OPTIONS = [
	{
		value: 'sidebar' as const,
		label: '侧边栏导航',
		description:
			'使用左侧可折叠侧边栏。适合屏幕较大的桌面端。',
	},
	{
		value: 'nav-items' as const,
		label: '顶栏导航',
		description:
			'使用顶栏中的导航项。更简洁,适合较小的屏幕。',
	},
] satisfies { value: LayoutMode; label: string; description: string }[];
