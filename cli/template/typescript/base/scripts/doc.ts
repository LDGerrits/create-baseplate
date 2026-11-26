// `mise run doc [topic] [--json]`: Baseplate's docs for the create-baseplate version this game's
// agent files come from, printed as Markdown. Without a topic, lists them. The CLI keeps a copy in
// .baseplate/docs when it creates the game and on each `create-baseplate sync`, so this works
// offline; without that copy it asks the pinned create-baseplate, which pnpm fetches once.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DOCS = path.join(".baseplate", "docs");
const args = process.argv.slice(2);
const json = args.includes("--json");
const [given, ...extra] = args.filter((arg) => arg !== "--json");
// The pages link to each other as the CLI's command; in the game, it's this task.
const inGame = (text: string) => text.replaceAll("create-baseplate doc ", "mise run doc ");

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
function closestTopic(name: string, topics: readonly string[]): string | undefined {
	const prefixed = topics.find((topic) => topic.startsWith(name));
	if (prefixed !== undefined) return prefixed;
	const edits = (topic: string) => Math.min(distance(name, topic), distance(name, topic.slice(0, name.length)));
	const ranked = topics.map((topic) => ({ topic, edits: edits(topic) })).sort((a, b) => a.edits - b.edits)[0];
	return ranked !== undefined && ranked.edits <= Math.max(2, Math.floor(name.length / 3)) ? ranked.topic : undefined;
}

const fail = (message: string) => {
	if (json) console.log(JSON.stringify({ ok: false, error: message }));
	else console.error(message);
	process.exit(1);
};

if (fs.existsSync(path.join(DOCS, "topics.json"))) {
	const index = JSON.parse(fs.readFileSync(path.join(DOCS, "topics.json"), "utf8")) as {
		url: string | null;
		topics: { topic: string; title: string; description: string }[];
	};
	const names = index.topics.map((topic) => topic.topic);
	if (extra.length > 0) fail("mise run doc takes one topic: mise run doc <topic>");
	if (given === undefined) {
		if (json) {
			console.log(
				JSON.stringify({ ok: true, ...(index.url === null ? {} : { url: index.url }), topics: index.topics }),
			);
		} else {
			const width = Math.max(...names.map((name) => name.length));
			console.log("Baseplate's docs, for this game's version. Read one with mise run doc <topic>:\n");
			for (const topic of index.topics) console.log(`  ${topic.topic.padEnd(width)}  ${topic.description}`);
			if (index.url !== null) console.log(`\nOnline: ${index.url}`);
		}
		process.exit(0);
	}
	const topic = given.toLowerCase();
	if (!names.includes(topic)) {
		const closest = closestTopic(topic, names);
		fail(
			`No topic "${given}". ${closest === undefined ? `The topics are ${names.join(", ")}.` : `Did you mean mise run doc ${closest}?`}`,
		);
	}
	const text = inGame(fs.readFileSync(path.join(DOCS, `${topic}.md`), "utf8"));
	if (json) console.log(JSON.stringify({ ok: true, topic, text }));
	else process.stdout.write(text);
	process.exit(0);
}

const pin = (JSON.parse(fs.readFileSync("package.json", "utf8")) as { baseplate?: { version?: string } }).baseplate
	?.version;
const doc = spawnSync("pnpm", ["dlx", `create-baseplate@${pin ?? "latest"}`, "doc", ...args], {
	encoding: "utf8",
	stdio: ["inherit", "pipe", "inherit"],
	shell: process.platform === "win32",
});
process.stdout.write(inGame(doc.stdout ?? ""));
// Only when pnpm couldn't fetch it: create-baseplate's own refusals say why themselves.
const fetchable = () =>
	spawnSync("pnpm", ["view", `create-baseplate@${pin ?? "latest"}`, "version"], {
		stdio: "ignore",
		shell: process.platform === "win32",
	}).status === 0;
if (doc.status !== 0 && !fetchable()) {
	console.error(
		`Couldn't run create-baseplate@${pin ?? "latest"}: pnpm needs the network the first time it runs a version, and the version must be published on npm.`,
	);
}
process.exit(doc.status ?? 1);
