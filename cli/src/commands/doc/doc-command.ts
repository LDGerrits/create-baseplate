import fs from "node:fs";
import path from "node:path";
import { printJsonError } from "../../base/logger.ts";

export interface Topic {
	topic: string;
	title: string;
	description: string;
}

interface Index {
	url: string | null;
	topics: Topic[];
}

/** The number of single-letter edits between two words. */
function distance(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const current = [i];
		for (let j = 1; j <= b.length; j++) {
			current[j] = Math.min(
				(previous[j] ?? 0) + 1,
				(current[j - 1] ?? 0) + 1,
				(previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
			);
		}
		previous = current;
	}
	return previous[b.length] ?? 0;
}

/** The topic `name` was likely meant to be: one it starts, or one a few letters from it or its start. */
export function closestTopic(name: string, topics: readonly string[]): string | undefined {
	const prefixed = topics.find((topic) => topic.startsWith(name));
	if (prefixed !== undefined) return prefixed;
	// A misspelt start of a topic counts too: `publsh` is two edits from `publis`hing.
	const edits = (topic: string) => Math.min(distance(name, topic), distance(name, topic.slice(0, name.length)));
	const ranked = topics.map((topic) => ({ topic, edits: edits(topic) })).sort((a, b) => a.edits - b.edits)[0];
	return ranked !== undefined && ranked.edits <= Math.max(2, Math.floor(name.length / 3)) ? ranked.topic : undefined;
}

/**
 * `create-baseplate doc [topic] [--json]`: prints one page of the docs, as Markdown, from the copy
 * this version ships in `docsDir`; without a topic, lists them. Returns the exit code.
 */
export function runDoc(docsDir: string, args: readonly string[]): number {
	const json = args.includes("--json");
	const [given, ...extra] = args.filter((arg) => arg !== "--json");
	const index = JSON.parse(fs.readFileSync(path.join(docsDir, "topics.json"), "utf8")) as Index;
	const names = index.topics.map((topic) => topic.topic);
	const fail = (message: string) => {
		if (json) printJsonError(message);
		else console.error(message);
		return 1;
	};

	if (extra.length > 0) return fail("create-baseplate doc takes one topic: create-baseplate doc <topic>");
	if (given === undefined) {
		if (json) {
			console.log(
				JSON.stringify({ ok: true, ...(index.url === null ? {} : { url: index.url }), topics: index.topics }),
			);
			return 0;
		}
		const width = Math.max(...names.map((name) => name.length));
		console.log("Baseplate's docs, for this version. Read one with create-baseplate doc <topic>:\n");
		for (const topic of index.topics) console.log(`  ${topic.topic.padEnd(width)}  ${topic.description}`);
		if (index.url !== null) console.log(`\nOnline: ${index.url}`);
		return 0;
	}

	const topic = given.toLowerCase();
	if (!names.includes(topic)) {
		const closest = closestTopic(topic, names);
		return fail(
			`No topic "${given}". ${closest === undefined ? `The topics are ${names.join(", ")}.` : `Did you mean create-baseplate doc ${closest}?`}`,
		);
	}
	const text = fs.readFileSync(path.join(docsDir, `${topic}.md`), "utf8");
	if (json) console.log(JSON.stringify({ ok: true, topic, text }));
	else process.stdout.write(text);
	return 0;
}
