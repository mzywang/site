// Parses log/eng_log.txt, written with the ,,d and ,,t insert-mode mappings
// in the nvim config:
//
//   # 20260926
//    - 1432: shipped the thing
//      more detail on the next line
//
// Lines that aren't a day header or a timed entry continue the entry above
// them, or start an untimed entry if there isn't one yet that day. Anything
// before the first day header is ignored.

export type Entry = { time: string | null; text: string };
export type Day = { date: string; entries: Entry[] };

const DAY = /^#\s*(\d{4})(\d{2})(\d{2})\s*$/;
const ENTRY = /^\s*-\s*(\d{2})(\d{2}):\s?(.*)$/;

export function parseEngLog(raw: string): Day[] {
	const days: Day[] = [];
	let day: Day | undefined;
	let entry: Entry | undefined;

	for (const line of raw.split(/\r?\n/)) {
		const dayMatch = DAY.exec(line);
		if (dayMatch) {
			const [, y, m, d] = dayMatch;
			day = { date: `${y}-${m}-${d}`, entries: [] };
			days.push(day);
			entry = undefined;
			continue;
		}
		if (!day) continue;

		const entryMatch = ENTRY.exec(line);
		if (entryMatch) {
			const [, hh, mm, text] = entryMatch;
			entry = { time: `${hh}:${mm}`, text: text.trim() };
			day.entries.push(entry);
			continue;
		}

		const text = line.trim();
		if (!text) continue;
		if (entry) {
			entry.text = entry.text ? `${entry.text}\n${text}` : text;
		} else {
			entry = { time: null, text };
			day.entries.push(entry);
		}
	}

	// Newest day first; entries within a day stay in the order they were written.
	return days
		.filter((d) => d.entries.length > 0)
		.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
