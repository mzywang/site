import raw from '../../../log/eng_log.txt?raw';
import { parseEngLog } from '$lib/eng-log';

// The log only changes when a new build is deployed, so render it to static HTML.
export const prerender = true;

export function load() {
	return { days: parseEngLog(raw) };
}
