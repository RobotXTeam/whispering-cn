import type { KeyboardEventSupportedKey } from './browser/supported-keys';

/**
 * Display labels for browser keys that need human-readable representation.
 * Exhaustive mapping for all non-trivial keys.
 */
const BROWSER_KEY_DISPLAY_LABELS: Partial<
	Record<KeyboardEventSupportedKey, string>
> = {
	// Whitespace (PRIMARY FIX)
	' ': '空格',
	enter: '回车',
	tab: 'Tab',

	// Modifiers
	control: 'Ctrl',
	shift: 'Shift',
	alt: 'Alt',
	meta: 'Cmd',
	altgraph: 'AltGr',
	capslock: 'CapsLock',
	numlock: 'NumLock',
	scrolllock: 'ScrollLock',
	fn: 'Fn',
	fnlock: 'FnLock',
	super: 'Super',

	// Navigation
	arrowleft: '左',
	arrowright: '右',
	arrowup: '上',
	arrowdown: '下',
	home: 'Home',
	end: 'End',
	pageup: 'PgUp',
	pagedown: 'PgDn',

	// Editing
	backspace: '退格',
	delete: 'Del',
	insert: 'Ins',
	clear: 'Clear',
	copy: '复制',
	cut: '剪切',
	paste: '粘贴',
	redo: '重做',
	undo: '撤销',

	// Special
	escape: 'Esc',
	contextmenu: '菜单',
	pause: '暂停',
	break: 'Break',
	printscreen: 'PrtSc',
	help: '帮助',

	// Media
	mediaplaypause: '播放/暂停',
	mediaplay: '播放',
	mediapause: '暂停',
	mediastop: '停止',
	mediatracknext: '下一曲',
	mediatrackprevious: '上一曲',
	volumeup: 'Vol+',
	volumedown: 'Vol-',
	volumemute: '静音',

	// Other keys
	dead: 'Dead',
	compose: 'Compose',
	accept: 'Accept',
	again: 'Again',
	attn: 'Attn',
	cancel: '取消',
	execute: '执行',
	find: '查找',
	finish: '完成',
	props: 'Props',
	select: '选择',
	zoomout: '缩小',
	zoomin: '放大',
};

/**
 * Gets display label for a full shortcut string.
 *
 * @param shortcut - The shortcut string (e.g., "control+shift+ ", "a")
 * @returns Human-readable display (e.g., "Ctrl + Shift + Space", "A")
 *
 * @example
 * getShortcutDisplayLabel(' ')           // 'Space'
 * getShortcutDisplayLabel('control+a')   // 'Ctrl + A'
 * getShortcutDisplayLabel(null)          // ''
 */
export function getShortcutDisplayLabel(shortcut: string | null): string {
	if (!shortcut) return '';

	return shortcut
		.split('+')
		.map((key) => formatKeyForDisplay(key.toLowerCase()))
		.join(' + ');
}

/**
 * Internal helper: formats a single key for display.
 */
function formatKeyForDisplay(key: string): string {
	const label = BROWSER_KEY_DISPLAY_LABELS[key as KeyboardEventSupportedKey];
	if (label) return label;

	// Single letters: uppercase
	if (key.length === 1 && key >= 'a' && key <= 'z') {
		return key.toUpperCase();
	}

	// Function keys: uppercase (f1 -> F1)
	if (/^f\d{1,2}$/.test(key)) {
		return key.toUpperCase();
	}

	// Fallback for unknown multi-char keys: capitalize first letter
	if (key.length > 1) {
		return key.charAt(0).toUpperCase() + key.slice(1);
	}

	// Single char non-letters (numbers, punctuation): return as-is
	return key;
}
