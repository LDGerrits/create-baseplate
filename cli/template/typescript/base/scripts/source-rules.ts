// Rules for the game's source files that no compiler or linter has (scripts/check-sources.ts runs them).
import path from "node:path";

/** Files are kebab-case, with dotted suffixes such as `.server`, `.spec` or `.story`. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z]+)*\.tsx?$/;

export function namingErrors(files: string[]): string[] {
	return files
		.filter((file) => !KEBAB.test(path.posix.basename(file)))
		.map((file) => {
			const name = path.posix.basename(file);
			const kebab = name
				.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
				.replace(/_/g, "-")
				.toLowerCase();
			return `${file}: file names are kebab-case: ${kebab}.`;
		});
}

/** An eslint-disable comment with no reason after ` -- `. */
const BARE_DISABLE = /(?:\/\/|\/\*)\s*eslint-disable(?:-next-line|-line)?\b(?![^\n]*\s--\s+\S)/;

export function disableErrors(file: string, source: string): string[] {
	return source
		.split("\n")
		.flatMap((line, index) =>
			BARE_DISABLE.test(line)
				? [
						`${file}:${index + 1}: say why the rule is wrong here, after the rules: \`// eslint-disable-next-line <rule> -- <why>\`.`,
					]
				: [],
		);
}

/** Whether a file opts out of a rule with `// <marker>: <why>`. */
const optedOut = (source: string, marker: string) => new RegExp(`//\\s*${marker}:\\s*\\S`).test(source);

/** A service with no spec beside it: its rules are what a spec tests. */
export function specErrors(files: string[], read: (file: string) => string): string[] {
	const present = new Set(files);
	return files
		.filter((file) => file.endsWith("-service.ts") && !present.has(file.replace(/\.ts$/, ".spec.ts")))
		.filter((file) => !optedOut(read(file), "no-spec"))
		.map(
			(file) =>
				`${file}: a service has a spec beside it, ${path.posix.basename(file, ".ts")}.spec.ts, that tests its rules (see .agents/skills/write-tests/SKILL.md). If it only wires other code, say so at its top: \`// no-spec: <why>\`.`,
		);
}

/**
 * A feature with remotes and no end-to-end test. `testFolder` names the folder whose tests run the
 * feature's code: `tests/e2e`, or in a multi-place game the place's (`projects/<place>/tests/e2e`).
 */
export function e2eErrors(
	files: string[],
	tests: string[],
	read: (file: string) => string,
	testFolder: (file: string) => string = () => "tests/e2e",
): string[] {
	const present = new Set(tests);
	return files.flatMap((file) => {
		const feature = /(?:^|\/)features\/([^/]+)\/shared\/[^/]+-network\.ts$/.exec(file)?.[1];
		if (feature === undefined || optedOut(read(file), "no-e2e")) return [];
		const test = `${testFolder(file)}/${feature}.luau`;
		if (present.has(test)) return [];
		return [
			`${file}: the ${feature} feature's remotes have no end-to-end test: add ${test}, which sends each request a client sends through the real server (\`mise run feature\` writes one to start from; see .agents/skills/write-tests/SKILL.md).`,
		];
	});
}

/** A component with no story beside it: the story is how its picture is rendered and checked. */
export function storyErrors(files: string[], read: (file: string) => string): string[] {
	const present = new Set(files);
	return files
		.filter((file) => file.endsWith(".tsx") && !/\.(story|spec)\.tsx$/.test(file))
		.filter((file) => !present.has(file.replace(/\.tsx$/, ".story.tsx")) && !optedOut(read(file), "no-story"))
		.map(
			(file) =>
				`${file}: a component has a story beside it, ${path.posix.basename(file, ".tsx")}.story.tsx, which \`mise run ui\` renders (see .agents/skills/build-ui/SKILL.md). If the file draws nothing on its own, say so at its top: \`// no-story: <why>\`.`,
		);
}

/** Runtime packages that won't run in Roblox: only `@rbxts` and `@flamework` packages do. */
export function packageErrors(packageJson: string): string[] {
	const { dependencies = {} } = JSON.parse(packageJson) as { dependencies?: Record<string, string> };
	return Object.keys(dependencies)
		.filter((name) => !/^@(rbxts|rbxts-js|flamework)\//.test(name))
		.map(
			(name) =>
				`package.json: ${name} is a plain npm package, which doesn't run in Roblox. Use an @rbxts package, or move a build tool to devDependencies (pnpm add -D).`,
		);
}

/**
 * Packages that hold state the whole game shares (a renderer, a store, an ECS world, Flamework's
 * registry): two copies of one don't see each other's, which breaks the game in ways no type shows.
 */
const ONE_COPY = new Set([
	"@rbxts/react",
	"@rbxts/react-roblox",
	"@rbxts/ripple",
	"@rbxts/vide",
	"@rbxts/charm",
	"@rbxts/reflex",
	"@rbxts/jecs",
	"@flamework/core",
	"@flamework/networking",
	"@flamework/components",
]);

/** Such packages the lockfile holds in more than one version, as when one is updated past what another package depends on. */
export function duplicateErrors(lockfile: string): string[] {
	const versions = new Map<string, Set<string>>();
	for (const [, name = "", version = ""] of lockfile.matchAll(
		/^ {2}'?(@(?:rbxts|rbxts-js|flamework)\/[^@'\s]+)@([^('\s:]+)/gm,
	)) {
		versions.set(name, (versions.get(name) ?? new Set()).add(version));
	}
	return [...versions]
		.filter(([name, found]) => found.size > 1 && ONE_COPY.has(name))
		.map(
			([name, found]) =>
				`pnpm-lock.yaml: ${name} is installed in versions ${[...found].sort().join(" and ")}, so the game would load two copies that don't share state. Pin the version the other packages need (\`pnpm why ${name}\` shows who needs which).`,
		);
}
