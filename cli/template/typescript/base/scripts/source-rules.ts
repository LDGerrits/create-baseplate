import path from "node:path";

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

const optedOut = (source: string, marker: string) => new RegExp(`//\\s*${marker}:\\s*\\S`).test(source);

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

export function clientSends(network: string): boolean {
	if (/\bNetworking\.createFunction\b/.test(network)) return true;
	const sent = /\bNetworking\.createEvent\s*<\s*(\w+|\{)/.exec(network)?.[1];
	if (sent === undefined) return false;
	const body =
		sent === "{"
			? network.slice(network.indexOf("{", network.indexOf("createEvent")))
			: (new RegExp(`(?:interface|type)\\s+${sent}\\b[^{;\\n]*\\{([^}]*)\\}`).exec(network)?.[1] ?? "x");
	return /\w+\s*[(:]/.test(body.slice(0, body.indexOf("}") === -1 ? undefined : body.indexOf("}") + 1));
}

export function e2eErrors(
	files: string[],
	tests: string[],
	read: (file: string) => string,
	testFolder: (file: string) => string = () => "tests/e2e",
): string[] {
	const present = new Set(tests);
	return files.flatMap((file) => {
		const feature = /(?:^|\/)features\/([^/]+)\/shared\/[^/]+-network\.ts$/.exec(file)?.[1];
		if (feature === undefined || optedOut(read(file), "no-e2e") || !clientSends(read(file))) return [];
		const test = `${testFolder(file)}/${feature}.luau`;
		if (present.has(test)) return [];
		return [
			`${file}: the ${feature} feature's remotes have no end-to-end test: add ${test}, which sends each request a client sends through the real server (\`mise run feature\` writes one to start from; see .agents/skills/write-tests/SKILL.md).`,
		];
	});
}

export function storyErrors(files: string[], read: (file: string) => string): string[] {
	const present = new Set(files);
	return files
		.filter((file) => file.endsWith(".tsx") && !/\.(story|spec)\.tsx$|-controller\.tsx$|(^|\/)app\//.test(file))
		.filter((file) => !present.has(file.replace(/\.tsx$/, ".story.tsx")) && !optedOut(read(file), "no-story"))
		.map(
			(file) =>
				`${file}: a component has a story beside it, ${path.posix.basename(file, ".tsx")}.story.tsx, which \`mise run ui\` renders (see .agents/skills/build-ui/SKILL.md). If the file draws nothing on its own, say so at its top: \`// no-story: <why>\`.`,
		);
}

export function mountedScopes(projectFiles: string[]): Set<string> {
	return new Set(
		projectFiles.flatMap((text) =>
			[...text.matchAll(/"\$path"\s*:\s*"[^"]*node_modules\/(@[\w.-]+)"/g)].map(([, scope = ""]) => scope),
		),
	);
}

/**
 * Runtime packages that won't run in Roblox: a package runs only from a scope the project files
 * mount, as they do `@rbxts` and `@flamework`.
 */
export function packageErrors(packageJson: string, mounted: Set<string>): string[] {
	const { dependencies = {} } = JSON.parse(packageJson) as { dependencies?: Record<string, string> };
	return Object.keys(dependencies)
		.filter((name) => !mounted.has(name.split("/")[0] ?? ""))
		.map((name) =>
			name.startsWith("@")
				? `package.json: ${name} is from a scope the game doesn't mount. If it's a roblox-ts package, mount ${name.split("/")[0]} under ReplicatedStorage.rbxts_include.node_modules in default.rogen.json, like @rbxts; if it's a build tool, move it to devDependencies (pnpm add -D).`
				: `package.json: ${name} is a plain npm package, which doesn't run in Roblox. Use an @rbxts package, or move a build tool to devDependencies (pnpm add -D).`,
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
