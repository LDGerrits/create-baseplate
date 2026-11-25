// The game's four layers, and what the check says about them. Code under src/ (in a multi-place game,
// under each source root: projects/common/src and each place's src) sits in one of:
//   app/<side>/                 entry scripts and composition; may import every layer
//   features/<feature>/<side>/  what the game could ship without; imports game, platform and other features
//   game/<module>/<side>/       always-on systems; never imports features or app
//   platform/<module>/<side>/   game-agnostic Roblox code; never imports game, features or app
// where <side> is server, client or shared. check-sources.ts runs `structureErrors` and `cycleErrors`;
// eslint.config.ts turns `layerZones` into import-x/no-restricted-paths zones.

export const LAYERS = ["app", "features", "game", "platform"] as const;
export type Layer = (typeof LAYERS)[number];
export const SIDES = ["server", "client", "shared"];
/** Names that say nothing about what a module holds. */
export const REFUSED_MODULES = ["util", "utils", "lib", "libs", "helper", "helpers", "common", "misc"];

/** What each layer may not import, and the next move for each. */
const FORBIDDEN: Record<Layer, { from: Layer[]; message: string }> = {
	app: { from: [], message: "" },
	features: {
		from: ["app"],
		message:
			"A feature never imports app/, which only starts it. Move what it needs into the feature, game/<system>/ or platform/<module>/.",
	},
	game: {
		from: ["features", "app"],
		message:
			"game/ never knows a feature or app/: have the feature register with game/<system> (a registry in game/), or move the code into the feature.",
	},
	platform: {
		from: ["game", "features", "app"],
		message:
			"platform/ is game-agnostic and never imports game/, features/ or app/: move the code into game/<system>/, or pass what it needs in as arguments.",
	},
};

/** A file's source root: the longest of `roots` it sits under. */
export function rootOf(file: string, roots: string[]): string | undefined {
	return roots.filter((root) => file.startsWith(`${root}/`)).sort((a, b) => b.length - a.length)[0];
}

/** The layer a file sits in, or undefined outside the layers. */
export function layerOf(file: string, roots: string[]): Layer | undefined {
	const root = rootOf(file, roots);
	if (root === undefined) return undefined;
	const first = file.slice(root.length + 1).split("/")[0];
	return LAYERS.find((layer) => layer === first);
}

/**
 * ESLint's import-x/no-restricted-paths zones for the layers, over every source root, plus the places:
 * a place may import the shared code, the shared code never a place, and a place never another.
 * Paths are anchored to the root, so node_modules is never matched.
 */
export function layerZones(roots: string[], places: string[] = []) {
	const zones: { target: string; from: string; message: string }[] = [];
	for (const layer of LAYERS) {
		const { from, message } = FORBIDDEN[layer];
		for (const root of roots) {
			for (const upper of from) {
				for (const other of roots) {
					zones.push({ target: `./${root}/${layer}/**`, from: `./${other}/${upper}/**`, message });
				}
			}
		}
	}
	for (const place of places) {
		zones.push({
			target: "./projects/common/**",
			from: `./projects/${place}/**`,
			message: `The shared code never imports a place: projects/${place} imports it, and the other places lack ${place}'s code. Move what both need into projects/common/src.`,
		});
		for (const other of places.filter((name) => name !== place)) {
			zones.push({
				target: `./projects/${place}/**`,
				from: `./projects/${other}/**`,
				message: `A place never imports another place: move what ${place} and ${other} share into projects/common/src.`,
			});
		}
	}
	return zones;
}

/**
 * Where each file may sit. `files` are source files by path from the repo root, `roots` the source
 * roots: `src`, or `projects/common/src` and each place's `src`.
 */
export function structureErrors(files: string[], roots: string[]): string[] {
	const errors: string[] = [];
	const seen = new Set<string>();
	const once = (key: string, error: string) => {
		if (seen.has(key)) return;
		seen.add(key);
		errors.push(error);
	};
	for (const file of files) {
		const root = rootOf(file, roots);
		if (root === undefined) continue;
		const parts = file.slice(root.length + 1).split("/");
		const layer = LAYERS.find((name) => name === parts[0]);
		const isCommon = root === "projects/common/src";

		if (layer === undefined || parts.length === 1) {
			errors.push(
				`${file}: ${root}/ holds four folders, app/, features/, game/ and platform/, and nothing else. Move it into one: a feature if the game could ship without it, game/<system>/ if it is always on, platform/<module>/ if it would move unchanged to another game.`,
			);
			continue;
		}
		if (layer === "app") {
			if (isCommon) {
				once(
					`${root}/app`,
					`${root}/app/: app/ holds a place's entry scripts, so it belongs in projects/<place>/src/app/. Shared code goes in features/, game/ or platform/.`,
				);
			} else if (!SIDES.includes(parts[1] ?? "") || parts.length < 3) {
				errors.push(
					`${file}: app/ holds only side folders, app/server/, app/client/ and app/shared/, with the files in them.`,
				);
			} else if (parts.slice(2, -1).some((part) => SIDES.includes(part))) {
				errors.push(wrongDepth(file, root, layer, parts));
			}
			continue;
		}

		const moduleName = parts[1] ?? "";
		const kind = layer === "features" ? "feature" : "module";
		const where = layer === "features" ? "features/<feature>" : `${layer}/<module>`;
		if (parts.length === 2) {
			errors.push(
				layer === "features"
					? `${file}: a feature is a folder: put this in ${root}/features/<feature>/server/, client/ or shared/.`
					: `${file}: no loose files directly in ${layer}/. A module is a folder named for what it holds: put this in ${root}/${layer}/<module>/server/, client/ or shared/.`,
			);
			continue;
		}
		if (REFUSED_MODULES.includes(moduleName.toLowerCase())) {
			once(
				`${root}/${layer}/${moduleName}`,
				`${root}/${layer}/${moduleName}/: "${moduleName}" says nothing about what the module holds. Name each folder for the one thing it does (game/currency, platform/sound), and split this one up.`,
			);
			continue;
		}
		if (SIDES.includes(moduleName)) {
			once(
				`${root}/${layer}/${moduleName}`,
				`${root}/${layer}/${moduleName}/: "${moduleName}" is a side folder, which sits inside ${where}/, not in place of it. Name the ${kind} for what it holds.`,
			);
			continue;
		}
		if (!SIDES.includes(parts[2] ?? "") || parts.length < 4) {
			errors.push(
				parts.slice(2, -1).some((part) => SIDES.includes(part))
					? wrongDepth(file, root, layer, parts)
					: `${file}: a file outside a side folder isn't placed in the game. Put it in ${root}/${layer}/${moduleName}/server/, client/ or shared/.`,
			);
			continue;
		}
		if (parts.slice(3, -1).some((part) => SIDES.includes(part))) errors.push(wrongDepth(file, root, layer, parts));
	}
	return errors;
}

function wrongDepth(file: string, root: string, layer: Layer, parts: string[]): string {
	const at = layer === "app" ? "app/<side>/" : `${layer}/<${layer === "features" ? "feature" : "module"}>/<side>/`;
	return `${file}: a side folder at the wrong depth. Server, client and shared folders sit only at ${at}, and Rogen routes by the outermost one: move ${parts.filter((part) => SIDES.includes(part)).at(-1)}/'s files up into ${root}/${parts[0]}/${layer === "app" ? "" : `${parts[1]}/`}<side>/.`;
}

/** The feature a file belongs to, as `<root>|<name>`, or undefined. */
export function featureOf(file: string, roots: string[]): string | undefined {
	const root = rootOf(file, roots);
	if (root === undefined) return undefined;
	const [layer, name, side] = file.slice(root.length + 1).split("/");
	return layer === "features" && name !== undefined && side !== undefined ? `${root}|${name}` : undefined;
}

/**
 * Cycles between feature folders, from the files' imports (`edges`: [importer, imported]). Folder
 * level: two features that import each other through different files are a cycle too.
 */
export function cycleErrors(edges: [string, string][], roots: string[]): string[] {
	const multi = roots.length > 1;
	const label = (feature: string) => {
		const [root, name] = feature.split("|");
		return multi ? `${root}/features/${name}` : `features/${name}`;
	};
	const graph = new Map<string, Map<string, [string, string]>>();
	for (const [from, to] of edges) {
		const a = featureOf(from, roots);
		const b = featureOf(to, roots);
		if (a === undefined || b === undefined || a === b) continue;
		if (!graph.has(a)) graph.set(a, new Map());
		if (!graph.get(a)?.has(b)) graph.get(a)?.set(b, [from, to]);
	}

	// Tarjan's strongly connected components: each one of two or more features is a cycle.
	const index = new Map<string, number>();
	const low = new Map<string, number>();
	const stack: string[] = [];
	const onStack = new Set<string>();
	const components: string[][] = [];
	let counter = 0;
	const visit = (node: string) => {
		index.set(node, counter);
		low.set(node, counter);
		counter++;
		stack.push(node);
		onStack.add(node);
		for (const next of graph.get(node)?.keys() ?? []) {
			if (!index.has(next)) {
				visit(next);
				low.set(node, Math.min(low.get(node) ?? 0, low.get(next) ?? 0));
			} else if (onStack.has(next)) {
				low.set(node, Math.min(low.get(node) ?? 0, index.get(next) ?? 0));
			}
		}
		if (low.get(node) === index.get(node)) {
			const component: string[] = [];
			let member: string | undefined;
			do {
				member = stack.pop();
				if (member === undefined) break;
				onStack.delete(member);
				component.push(member);
			} while (member !== node);
			if (component.length > 1) components.push(component.sort());
		}
	};
	for (const node of [...graph.keys()].sort()) if (!index.has(node)) visit(node);

	const next =
		"Merge them, move what both need into game/<system>/, or have one register with the other (a registry in game/) or listen to a signal it exports.";
	return components.map((component) => {
		const inside = new Set(component);
		const names = component.map(label);
		const first = component[0] as string;
		const path = cyclePath(graph, inside, first);
		const examples = path
			.slice(0, -1)
			.map((feature, at) => graph.get(feature)?.get(path[at + 1] as string))
			.map((edge) => (edge === undefined ? "" : `${edge[0]} imports ${edge[1]}`))
			.join("; ");
		const subject =
			component.length === 2
				? `${names[0]} and ${names[1]} import each other.`
				: `${names.slice(0, -1).join(", ")} and ${names.at(-1)} import each other in a cycle (${path.map(label).join(" -> ")}).`;
		return `${subject} ${next} (${examples})`;
	});
}

/** A path from `start` back to `start` inside one component. */
function cyclePath(graph: Map<string, Map<string, [string, string]>>, inside: Set<string>, start: string): string[] {
	const previous = new Map<string, string>();
	const queue = [start];
	while (queue.length > 0) {
		const node = queue.shift() as string;
		for (const next of graph.get(node)?.keys() ?? []) {
			if (!inside.has(next)) continue;
			if (next === start) {
				const path = [start];
				for (let at: string | undefined = node; at !== undefined && at !== start; at = previous.get(at)) {
					path.splice(1, 0, at);
				}
				return [...path, start];
			}
			if (!previous.has(next)) {
				previous.set(next, node);
				queue.push(next);
			}
		}
	}
	return [start, start];
}

const SPECIFIER = /\b(?:import|export)\b(?:[^"';]*?\bfrom)?\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)/g;

/** The files each source file imports, by relative specifier: [importer, imported] for sources only. */
export function importEdges(
	sources: Map<string, string>,
	posixJoin: (...parts: string[]) => string,
): [string, string][] {
	const edges: [string, string][] = [];
	for (const [file, source] of sources) {
		const text = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
		const dir = file.slice(0, file.lastIndexOf("/"));
		for (const match of text.matchAll(SPECIFIER)) {
			const specifier = match[1] ?? match[2];
			if (specifier === undefined || !specifier.startsWith(".")) continue;
			const base = posixJoin(dir, specifier);
			const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((candidate) =>
				sources.has(candidate),
			);
			if (target !== undefined) edges.push([file, target]);
		}
	}
	return edges;
}
