import type { AcceleratorPossibleKey } from './possible-keys';

/**
 * Structured accelerator key sections for global (system-wide) shortcuts.
 * Each section groups related keys with descriptive metadata.
 * Following Electron Accelerator specification.
 */
export const ACCELERATOR_SECTIONS = [
	{
		title: '修饰键',
		description: '全局快捷键的修饰键',
		keys: [
			'Command',
			'Cmd', // macOS Command key
			'Control',
			'Ctrl', // Control key
			'Alt',
			'Option', // Alt/Option key
			'AltGr', // Alt Graph key
			'Shift', // Shift key
			'Super',
			'Meta', // Windows/Linux Super key
		] as const satisfies AcceleratorPossibleKey[],
	},
	{
		title: '字母',
		description: '大写字母 A-Z',
		keys: [
			'A',
			'B',
			'C',
			'D',
			'E',
			'F',
			'G',
			'H',
			'I',
			'J',
			'K',
			'L',
			'M',
			'N',
			'O',
			'P',
			'Q',
			'R',
			'S',
			'T',
			'U',
			'V',
			'W',
			'X',
			'Y',
			'Z',
		] as const satisfies AcceleratorPossibleKey[],
	},
	{
		title: '数字',
		description: '数字键 0-9',
		keys: [
			'0',
			'1',
			'2',
			'3',
			'4',
			'5',
			'6',
			'7',
			'8',
			'9',
		] as const satisfies AcceleratorPossibleKey[],
	},
	{
		title: '功能键',
		description: 'F1-F24 功能键',
		keys: [
			'F1',
			'F2',
			'F3',
			'F4',
			'F5',
			'F6',
			'F7',
			'F8',
			'F9',
			'F10',
			'F11',
			'F12',
			'F13',
			'F14',
			'F15',
			'F16',
			'F17',
			'F18',
			'F19',
			'F20',
			'F21',
			'F22',
			'F23',
			'F24',
		] as const satisfies AcceleratorPossibleKey[],
	},
	{
		title: '标点符号',
		description: '符号和标点键',
		keys: [
			')',
			'!',
			'@',
			'#',
			'$',
			'%',
			'^',
			'&',
			'*',
			'(',
			':',
			';',
			'+',
			'=',
			'<',
			',',
			'_',
			'-',
			'>',
			'.',
			'?',
			'/',
			'~',
			'`',
			'{',
			']',
			'[',
			'|',
			'\\',
			'}',
			'"',
			// TODO: Not sure if ' is allowed, see https://github.com/electron/electron/pull/47508/files
			"'",
		] as const satisfies AcceleratorPossibleKey[],
	},
	{
		title: '特殊键',
		description: '导航和控制键',
		keys: [
			'Plus',
			'Space',
			'Tab',
			'Capslock',
			'Numlock',
			'Scrolllock',
			'Backspace',
			'Delete',
			'Insert',
			'Return',
			'Enter',
			'Up',
			'Down',
			'Left',
			'Right',
			'Home',
			'End',
			'PageUp',
			'PageDown',
			'Escape',
			'Esc',
			'VolumeUp',
			'VolumeDown',
			'VolumeMute',
			'MediaNextTrack',
			'MediaPreviousTrack',
			'MediaStop',
			'MediaPlayPause',
			'PrintScreen',
		] as const satisfies AcceleratorPossibleKey[],
	},
	{
		title: '小键盘键',
		description: '数字小键盘键',
		keys: [
			'num0',
			'num1',
			'num2',
			'num3',
			'num4',
			'num5',
			'num6',
			'num7',
			'num8',
			'num9',
			'numdec',
			'numadd',
			'numsub',
			'nummult',
			'numdiv',
		] as const satisfies AcceleratorPossibleKey[],
	},
] as const;

/**
 * All accelerator modifier keys
 */
export const ACCELERATOR_MODIFIER_KEYS = ACCELERATOR_SECTIONS[0].keys;
export type AcceleratorModifier = (typeof ACCELERATOR_MODIFIER_KEYS)[number];

/**
 * All accelerator key codes (non-modifiers)
 */
export const ACCELERATOR_KEY_CODES = [
	...ACCELERATOR_SECTIONS[1].keys, // Letters
	...ACCELERATOR_SECTIONS[2].keys, // Numbers
	...ACCELERATOR_SECTIONS[3].keys, // Function
	...ACCELERATOR_SECTIONS[4].keys, // Punctuation
	...ACCELERATOR_SECTIONS[5].keys, // Special
	...ACCELERATOR_SECTIONS[6].keys, // Numpad
] as const satisfies AcceleratorPossibleKey[];
export type AcceleratorKeyCode = (typeof ACCELERATOR_KEY_CODES)[number];

/**
 * Punctuation and symbol keys valid for accelerators.
 * Alias for `ACCELERATOR_SECTIONS[4].keys` for semantic clarity.
 */
export const ACCELERATOR_PUNCTUATION_KEYS = ACCELERATOR_SECTIONS[4].keys;
