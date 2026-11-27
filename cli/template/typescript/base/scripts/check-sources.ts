import fs from "node:fs";
import path from "node:path";
import { cycleErrors, importEdges, structureErrors } from "./layers.ts";
import {
	disableErrors,
	duplicateErrors,
	e2eErrors,
	mountedScopes,
	namingErrors,
	packageErrors,
	specErrors,
	storyErrors,
} from "./source-rules.ts";
import { unguardedRemotes } from "./unguarded-remotes.ts";

const SERVER_ENTRY = "app/server/main.server.ts";
const CLIENT_ENTRY = "app/client/main.client.ts";
const SKIPPED = new Set(["node_modules", "out", "include", "build", "dist", ".git"]);

const multi = fs.existsSync("projects");
const places = multi
	? fs.readdirSync("projects").filter((place) => place !== "common" && fs.existsSync(`projects/${place}/src`))
	: [""];
const sourceRoots = multi ? ["projects/common/src", ...places.map((place) => `projects/${place}/src`)] : ["src"];

const errors: string[] = [];

function filesUnder(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const at = path.posix.join(dir, entry.name);
		if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : filesUnder(at);
		return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [at] : [];
	});
}

const sources = sourceRoots.flatMap(filesUnder);
const inSources = new Set(sources);

for (const file of sources) {
	if (/\.test\.tsx?$/.test(file)) {
		errors.push(
			`${file}: Jest here runs *.spec.ts files only, so this one never runs. Name it ${file.replace(/\.test\.(tsx?)$/, ".spec.$1")}.`,
		);
	}
}
for (const file of filesUnder(".")) {
	if (/\.spec\.tsx?$/.test(file) && !inSources.has(file)) {
		errors.push(
			`${file}: a spec outside ${sourceRoots.join(", ")} is never compiled, so it never runs. Move it next to the code it tests.`,
		);
	}
}

function importsOf(entry: string): Set<string> {
	if (!fs.existsSync(entry)) return new Set();
	const text = fs.readFileSync(entry, "utf8");
	const imported = new Set<string>();
	for (const [, specifier] of text.matchAll(/^\s*import\s+(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/gm)) {
		if (specifier === undefined || !specifier.startsWith(".")) continue;
		const base = path.posix.join(path.posix.dirname(entry), specifier);
		for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
			if (inSources.has(candidate)) imported.add(candidate);
		}
	}
	return imported;
}

const entries = places.map((place) => {
	const root = multi ? `projects/${place}/src` : "src";
	return { root, server: importsOf(`${root}/${SERVER_ENTRY}`), client: importsOf(`${root}/${CLIENT_ENTRY}`) };
});

for (const file of sources) {
	const text = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
	const kind = /^\s*@(Service|Controller|Component)\s*\(/m.exec(text)?.[1];
	if (kind === undefined) continue;
	const owners = entries.filter(
		(entry) => !multi || file.startsWith("projects/common/") || file.startsWith(`${entry.root}/`),
	);
	const started = owners.some((entry) =>
		kind === "Service"
			? entry.server.has(file)
			: kind === "Controller"
				? entry.client.has(file)
				: entry.server.has(file) || entry.client.has(file),
	);
	if (started) continue;
	const where =
		kind === "Service" ? SERVER_ENTRY : kind === "Controller" ? CLIENT_ENTRY : `${SERVER_ENTRY} or ${CLIENT_ENTRY}`;
	const root = multi ? "projects/<place>/src" : "src";
	errors.push(
		`${file}: a @${kind} that no entry script imports, so Flamework never starts it. Import it in ${root}/${where}.`,
	);
}

errors.push(...structureErrors(sources, sourceRoots));
errors.push(
	...cycleErrors(
		importEdges(new Map(sources.map((file) => [file, fs.readFileSync(file, "utf8")])), path.posix.join),
		sourceRoots,
	),
);

errors.push(...unguardedRemotes(new Map(sources.map((file) => [file, fs.readFileSync(file, "utf8")]))));
const read = (file: string) => fs.readFileSync(file, "utf8");
const testDirs = multi ? places.map((place) => `projects/${place}/tests/e2e`) : ["tests/e2e"];
const testFolder = (file: string) => {
	if (!multi) return "tests/e2e";
	const place = file.split("/")[1] ?? "";
	return `projects/${place === "common" ? (places.includes("game") ? "game" : places[0]) : place}/tests/e2e`;
};
const e2eTests = testDirs.flatMap((dir) =>
	fs.existsSync(dir) ? fs.readdirSync(dir).map((file) => path.posix.join(dir, file)) : [],
);
errors.push(
	...namingErrors(sources),
	...sources.flatMap((file) => disableErrors(file, read(file))),
	...specErrors(sources, read),
	...e2eErrors(sources, e2eTests, read, testFolder),
	...storyErrors(sources, read),
	...packageErrors(
		read("package.json"),
		mountedScopes(
			[".", ...places.map((place) => `projects/${place}`)].flatMap((dir) =>
				fs.existsSync(dir)
					? fs
							.readdirSync(dir)
							.filter((file) => file.endsWith(".rogen.json"))
							.map((file) => read(path.posix.join(dir, file)))
					: [],
			),
		),
	),
	...(fs.existsSync("pnpm-lock.yaml") ? duplicateErrors(read("pnpm-lock.yaml")) : []),
);

for (const error of errors) console.error(error);
if (errors.length > 0) process.exit(1);
