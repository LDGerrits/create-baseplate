// Rules for the game's source files that luau-lsp and Selene don't have (scripts/check-sources.ts
// runs them).
import path from "node:path";

/** Files are PascalCase, with dotted suffixes such as `.server`, `.spec` or `.story`; `init` too. */
const PASCAL = /^(?:[A-Z][A-Za-z0-9]*|init)(?:\.[a-z]+)*\.luau?$/;

export function namingErrors(files: string[]): string[] {
	return files
		.filter((file) => !PASCAL.test(path.posix.basename(file)))
		.map((file) => {
			const [stem = "", ...rest] = path.posix.basename(file).split(".");
			const pascal = stem
				.split(/[-_]/)
				.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
				.join("");
			return `${file}: file names are PascalCase, since they're module names: ${[pascal, ...rest].join(".")}.`;
		});
}

/** A comment after the code on the same line: ` -- <why>`. */
const REASON = /--\s*\S/;

/** A `selene: allow` or a `:: any` cast with no reason after it. */
export function silencedErrors(file: string, source: string): string[] {
	return source.split("\n").flatMap((line, index) => {
		const at = `${file}:${index + 1}`;
		const allow = /--\s*selene:\s*allow\([^)]*\)(.*)$/.exec(line);
		if (allow !== null && !REASON.test(allow[1] ?? "")) {
			return [`${at}: say why Selene is wrong here, after the allow: \`-- selene: allow(<lint>) -- <why>\`.`];
		}
		const cast = /::\s*any\b(.*)$/.exec(line);
		if (cast !== null && !line.trimStart().startsWith("--") && !REASON.test(cast[1] ?? "")) {
			return [
				`${at}: \`:: any\` turns the type checker off: fix the type, or say why it can't be typed: \`:: any -- <why>\`.`,
			];
		}
		return [];
	});
}

/** Whether a file opts out of a rule with `-- <marker>: <why>`. */
const optedOut = (source: string, marker: string) => new RegExp(`--\\s*${marker}:\\s*\\S`).test(source);

/** A service with no spec beside it: its rules are what a spec tests. */
export function specErrors(files: string[], read: (file: string) => string): string[] {
	const present = new Set(files);
	return files
		.filter((file) => /Service\.luau$/.test(file) && !present.has(file.replace(/\.luau$/, ".spec.luau")))
		.filter((file) => !optedOut(read(file), "no-spec"))
		.map(
			(file) =>
				`${file}: a service has a spec beside it, ${path.posix.basename(file, ".luau")}.spec.luau, that tests its rules (see .agents/skills/write-tests/SKILL.md). If it only wires other code, say so at its top: \`-- no-spec: <why>\`.`,
		);
}

/**
 * A feature with remotes and no end-to-end test: `tests` lists the end-to-end test files, as
 * `tests/e2e/<feature>.luau` or, in a multi-place game, `projects/<place>/tests/e2e/<feature>.luau`.
 */
export function e2eErrors(files: string[], tests: string[], read: (file: string) => string): string[] {
	const tested = new Set(tests.map((file) => path.posix.basename(file, ".luau")));
	return files.flatMap((file) => {
		const feature = /(?:^|\/)features\/([^/]+)\/shared\/[^/]+Network\.luau$/.exec(file)?.[1];
		if (feature === undefined || tested.has(feature) || optedOut(read(file), "no-e2e")) return [];
		return [
			`${file}: the ${feature} feature's remotes have no end-to-end test: add tests/e2e/${feature}.luau, which sends each request a client sends through the real server (\`mise run feature\` writes one to start from; see .agents/skills/write-tests/SKILL.md).`,
		];
	});
}

/** Client modules that aren't components: they start, or mount, what the player sees. */
const NOT_COMPONENT = /(Controller|\.story|\.storybook|\.spec|\.server|\.client|\/Start)\.luau$/;

/** A component (a client module that creates UI elements) with no story beside it. */
export function storyErrors(files: string[], read: (file: string) => string): string[] {
	const present = new Set(files);
	return files
		.filter((file) => /(^|\/)client\//.test(file) && file.endsWith(".luau") && !NOT_COMPONENT.test(file))
		.filter((file) => /\bcreateElement\(|\bVide\.create\b|\bcreate\s*\(?\s*"[A-Z]/.test(read(file)))
		.filter((file) => !present.has(file.replace(/\.luau$/, ".story.luau")) && !optedOut(read(file), "no-story"))
		.map(
			(file) =>
				`${file}: a component has a story beside it, ${path.posix.basename(file, ".luau")}.story.luau, which \`mise run ui\` renders (see .agents/skills/build-ui/SKILL.md). If the module draws nothing on its own, say so at its top: \`-- no-story: <why>\`.`,
		);
}

/** DataStoreService by hand: player data belongs in a data library, whose session locking saves it safely. */
export function dataStoreErrors(file: string, source: string): string[] {
	const lines = source.split("\n");
	return lines.flatMap((line, index) => {
		if (!/GetService\(\s*["']DataStoreService["']\s*\)/.test(line)) return [];
		if (optedOut(line, "datastore") || optedOut(lines[index - 1] ?? "", "datastore")) return [];
		return [
			`${file}:${index + 1}: player data goes through a data library (ProfileStore or Lapis), not DataStoreService by hand: saving by hand loses data when a player joins a second server or a write fails. For another store, such as a leaderboard's, say why on the line above: \`-- datastore: <why>\`.`,
		];
	});
}

/** The packages wally.toml asks for at runtime: under [dependencies] and [server-dependencies]. */
export function runtimePackages(wallyToml: string): Set<string> {
	const names = new Set<string>();
	let runtime = false;
	for (const line of wallyToml.split("\n")) {
		const section = /^\[([\w-]+)\]/.exec(line);
		if (section !== null) runtime = section[1] === "dependencies" || section[1] === "server-dependencies";
		const name = /"([\w-]+\/[\w-]+)@/.exec(line)?.[1];
		if (runtime && name !== undefined) names.add(name);
	}
	return names;
}

/**
 * The game's own runtime packages that wally.lock holds in more than one version, as when one is
 * updated past what another package depends on: the game would load both copies. (Test tools bring
 * their own copies of some packages; those never reach the game.)
 */
export function duplicateErrors(lockfile: string, wallyToml: string): string[] {
	const runtime = runtimePackages(wallyToml);
	const versions = new Map<string, Set<string>>();
	for (const [, name = "", version = ""] of lockfile.matchAll(/name = "([^"]+)"\s*\nversion = "([^"]+)"/g)) {
		versions.set(name, (versions.get(name) ?? new Set()).add(version));
	}
	return [...versions]
		.filter(([name, found]) => found.size > 1 && runtime.has(name))
		.map(
			([name, found]) =>
				`wally.lock: ${name} is installed in versions ${[...found].sort().join(" and ")}, so the game would load two copies that don't share state. Pin the version the other packages need in wally.toml.`,
		);
}
