// Decodes the keymap exported by the Argos configurator
// (src/routes/keyboard/argos_config.json). Keycodes are stored as numbers in
// QMK's keycode encoding (qmkKeycodesVersion 0.0.8, i.e. QMK >= 0.19), so
// this turns each one into something the on-screen keyboard can label and
// act on.

export type Config = {
	keycodes: number[][];
	layerNames: string[];
	tapDances: { on_tap: number; on_hold: number }[];
	tappingTerm: number;
	rows: number;
	cols: number;
};

// QMK's 5-bit modifier mask.
export const CTL = 0x01;
export const SFT = 0x02;
export const ALT = 0x04;
export const GUI = 0x08;

// What's pressed when a hold is chosen over a tap.
export type Hold = { layer: number } | { mods: number };

export type Action =
	| { type: 'none' }
	| { type: 'trans' }
	// A basic keycode, possibly wrapped in modifiers, e.g. LSFT(KC_1) for "!".
	| { type: 'key'; code: number; mods: number }
	| { type: 'mod'; mods: number }
	// Layer-tap, mod-tap and tap dance: one keycode on tap, something else on hold.
	| { type: 'dual'; tap: number; hold: Hold }
	| { type: 'layer'; layer: number }
	// Recognised but does nothing here, e.g. media, RGB and pointer keys.
	| { type: 'other'; label: string };

// Printable basic keycodes as [unshifted, shifted] on a US layout.
const chars: Record<number, [string, string]> = {};
for (let i = 0; i < 26; i++) {
	const c = String.fromCharCode(97 + i);
	chars[0x04 + i] = [c, c.toUpperCase()];
}
[...'1234567890'].forEach((d, i) => (chars[0x1e + i] = [d, '!@#$%^&*()'[i]]));
Object.assign(chars, {
	0x28: ['\n', '\n'],
	0x2b: ['\t', '\t'],
	0x2c: [' ', ' '],
	0x2d: ['-', '_'],
	0x2e: ['=', '+'],
	0x2f: ['[', '{'],
	0x30: [']', '}'],
	0x31: ['\\', '|'],
	0x33: [';', ':'],
	0x34: ["'", '"'],
	0x35: ['`', '~'],
	0x36: [',', '<'],
	0x37: ['.', '>'],
	0x38: ['/', '?']
});

const names: Record<number, string> = {
	0x28: 'ret',
	0x29: 'esc',
	// Backspace, called delete on a Mac.
	0x2a: 'del',
	0x2b: 'tab',
	0x2c: 'space',
	0x39: 'caps',
	0x46: 'prtsc',
	0x47: 'scrl',
	0x48: 'pause',
	0x49: 'ins',
	0x4a: 'home',
	0x4b: 'pgup',
	0x4c: 'fwd del',
	0x4d: 'end',
	0x4e: 'pgdn',
	0x4f: '→',
	0x50: '←',
	0x51: '↓',
	0x52: '↑',
	0x65: 'menu',
	0xa8: 'mute',
	0xa9: 'vol+',
	0xaa: 'vol−',
	0xab: 'next',
	0xac: 'prev',
	0xad: 'stop',
	0xae: 'play',
	0xbd: 'bri+',
	0xbe: 'bri−',
	0xd1: 'btn1',
	0xd2: 'btn2',
	0xd3: 'btn3',
	0xd4: 'btn4',
	0xd5: 'btn5',
	0xd9: 'wh↑',
	0xda: 'wh↓',
	0xdb: 'wh←',
	0xdc: 'wh→',
	// RGB matrix.
	0x7840: 'rgb on',
	0x7841: 'rgb off',
	0x7842: 'rgb',
	0x7843: 'rgb›',
	0x7844: 'rgb‹',
	0x7c00: 'boot',
	0x7c01: 'reboot',
	0x7c03: 'eeclr',
	// Keyboard-level keycodes (QK_KB_n) from the Charybdis firmware.
	0x7e00: 'dpi+',
	0x7e01: 'dpi−',
	0x7e02: 'snp+',
	0x7e03: 'snp−',
	0x7e04: 'snipe',
	0x7e05: 'snipe⇅',
	0x7e06: 'drag',
	0x7e07: 'drag⇅'
};
for (let i = 0; i < 12; i++) names[0x3a + i] = `f${i + 1}`;

const modSymbols: [number, string][] = [
	[CTL, '⌃'],
	[ALT, '⌥'],
	[SFT, '⇧'],
	[GUI, '⌘']
];

// Left/right doesn't matter here, so drop the right-hand flag (0x10).
function modMask(mods: number) {
	return mods & 0x0f;
}

// KC_LCTL..KC_RGUI (0xe0..0xe7) as a modifier mask.
function modKeyMask(code: number) {
	return 1 << (code & 0x03);
}

export function decode(code: number, config: Config): Action {
	if (code === 0x0000) return { type: 'none' };
	if (code === 0x0001) return { type: 'trans' };
	if (code >= 0xe0 && code <= 0xe7) return { type: 'mod', mods: modKeyMask(code) };
	if (code < 0x0100) {
		return chars[code] || names[code]
			? { type: 'key', code, mods: 0 }
			: { type: 'other', label: `0x${code.toString(16)}` };
	}
	// QK_MODS: modifiers applied to a basic keycode.
	if (code < 0x2000) return { type: 'key', code: code & 0xff, mods: modMask(code >> 8) };
	// QK_MOD_TAP.
	if (code < 0x4000) {
		return { type: 'dual', tap: code & 0xff, hold: { mods: modMask(code >> 8) } };
	}
	// QK_LAYER_TAP.
	if (code < 0x5000) return { type: 'dual', tap: code & 0xff, hold: { layer: (code >> 8) & 0x0f } };
	// QK_MOMENTARY, i.e. MO(n).
	if (code >= 0x5220 && code < 0x5240) return { type: 'layer', layer: code & 0x1f };
	// QK_TAP_DANCE. Only the tap and hold actions are used here.
	if (code >= 0x5700 && code < 0x5800) {
		const td = config.tapDances[code & 0xff];
		if (td && td.on_hold >= 0xe0 && td.on_hold <= 0xe7) {
			return { type: 'dual', tap: td.on_tap, hold: { mods: modKeyMask(td.on_hold) } };
		}
		if (td) return decode(td.on_tap, config);
	}
	return { type: 'other', label: names[code] ?? `0x${code.toString(16)}` };
}

export function modsLabel(mods: number) {
	return modSymbols
		.filter(([m]) => mods & m)
		.map(([, s]) => s)
		.join('');
}

// What a basic keycode prints, with or without shift.
export function char(code: number, shifted: boolean): string | undefined {
	return chars[code]?.[shifted ? 1 : 0];
}

export function keyLabel(code: number, mods = 0): string {
	const shifted = (mods & SFT) !== 0;
	const c = names[code] ?? char(code, shifted);
	const label = c ?? `0x${code.toString(16)}`;
	// Shift is already shown by the character itself, e.g. "!" for ⇧1.
	const rest = chars[code] ? mods & ~SFT : mods;
	return modsLabel(rest) + label;
}
