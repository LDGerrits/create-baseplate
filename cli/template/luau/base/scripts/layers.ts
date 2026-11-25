// The game's four layers, and what the check says about them. Code under src/ (in a multi-place game,
// under each source root: projects/common/src and each place's src) sits in one of:
//   app/<side>/                 entry scripts and composition; may import every layer
//   features/<feature>/<side>/  what the game could ship without; imports game, platform and other features
//   game/<module>/<side>/       always-on systems; never imports features or app
//   platform/<module>/<side>/   game-agnostic Roblox code; never imports game, features or app
// where <side> is server, client or shared. check-sources.ts runs `structureErrors`, and, on the
// requires `requireEdges` reads out of the game's sourcemap, `layerErrors` and `cycleErrors`.

import path from "node:path";

export const LAYERS = ["app", "features", "game", "platform"] as const;
export type Layer = (typeof LAYERS)[number];
export const SIDES = ["server", "client", "shared"];
/** Names that say nothing about what a module holds. */
export const REFUSED_MODULES = ["util", "utils", "lib", "libs"];

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
		if (!/^[a-z][a-z0-9]*$/.test(moduleName) && !SIDES.includes(moduleName)) {
			once(
				`${root}/${layer}/${moduleName}`,
				`${root}/${layer}/${moduleName}/: a ${kind}'s folder is lowercase letters and digits, since it is a part of the require path (ServerScriptService.${layer}.<name>.<Module>). Rename it.`,
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

/** One instance of Rojo's sourcemap (`rojo sourcemap`). */
export interface SourcemapNode {
	name: string;
	className?: string;
	filePaths?: string[];
	children?: SourcemapNode[];
}

interface Instance {
	name: string;
	parent: Instance | undefined;
	children: Map<string, Instance>;
	/** The module's file, by path from the repo root. */
	file: string | undefined;
}

const SCRIPT_FILE = /\.luau?$/;

/** Rojo's tree as instances that know their parent, and the files that are modules in it. */
function instancesOf(sourcemap: SourcemapNode, dir: string) {
	const byFile = new Map<string, Instance>();
	const build = (node: SourcemapNode, parent: Instance | undefined): Instance => {
		const found = node.filePaths?.find((file) => SCRIPT_FILE.test(file));
		const instance: Instance = {
			name: node.name,
			parent,
			children: new Map(),
			file: found === undefined ? undefined : toRepoPath(found, dir),
		};
		if (instance.file !== undefined && !byFile.has(instance.file)) byFile.set(instance.file, instance);
		for (const child of node.children ?? []) {
			const built = build(child, instance);
			if (!instance.children.has(built.name)) instance.children.set(built.name, built);
		}
		return instance;
	};
	return { root: build(sourcemap, undefined), byFile };
}

/** A sourcemap's file path (from the folder `rojo sourcemap` ran in, or absolute) from the repo root. */
function toRepoPath(file: string, dir: string): string {
	const normal = file.replaceAll("\\", "/");
	const absolute = /^([A-Za-z]:)?\//.test(normal);
	return (
		absolute ? path.posix.relative(process.cwd().replaceAll("\\", "/"), normal) : path.posix.join(dir, normal)
	).replace(/^\.\//, "");
}

/** Source without comments, with strings kept: `--` inside one stays. */
function withoutComments(source: string): string {
	return source.replace(/--\[(=*)\[[\s\S]*?\]\1\]|--.*$/gm, "");
}

/** The text between the parentheses of the call that opens at `open`. */
function argumentOf(text: string, open: number): string | undefined {
	let depth = 0;
	for (let at = open; at < text.length; at++) {
		if (text[at] === "(") depth++;
		else if (text[at] === ")" && --depth === 0) return text.slice(open + 1, at);
	}
	return undefined;
}

/** `local name = <path>` lines whose right side is an instance path, by name. */
function aliasesOf(text: string): Map<string, string> {
	const aliases = new Map<string, string>();
	for (const [, name, expression] of text.matchAll(/^local\s+(\w+)\s*(?::[^=\n]+)?=\s*(.+?)\s*$/gm)) {
		if (name !== undefined && expression !== undefined) aliases.set(name, expression);
	}
	return aliases;
}

/**
 * Follows an instance path written in code (`ServerScriptService.game.bank.Bank`,
 * `script.Parent.Parent.features.shop.ShopController`, `game:GetService("X")`, `:WaitForChild("X")`,
 * `["X"]`, `.Parent`, and locals that hold one) through the tree. Undefined when it isn't one this
 * can follow, such as a package's or a computed one.
 */
function follow(
	expression: string,
	script: Instance,
	root: Instance,
	aliases: Map<string, string>,
	depth = 0,
): Instance | undefined {
	if (depth > 8) return undefined;
	const text = expression.trim();
	const head = /^([A-Za-z_]\w*)/.exec(text);
	if (head === null || head[1] === undefined) return undefined;
	let current: Instance | undefined;
	let rest = text.slice(head[0].length);
	const name = head[1];
	if (name === "script") current = script;
	else if (name === "game") current = root;
	else if (name === "workspace") current = root.children.get("Workspace");
	else if (aliases.has(name)) {
		const target = aliases.get(name) as string;
		// A local that names itself, or one defined from another: follow it, once per step.
		const own = new Map(aliases);
		own.delete(name);
		current = follow(target, script, root, own, depth + 1);
	} else current = root.children.get(name);
	const step =
		/^(?:\s*\.\s*([A-Za-z_]\w*)|\s*\[\s*["']([^"']+)["']\s*\]|\s*:\s*(GetService|WaitForChild|FindFirstChild)\s*\(\s*["']([^"']+)["'][^)]*\))/;
	while (current !== undefined && rest.trim() !== "") {
		const match = step.exec(rest);
		if (match === null) return undefined;
		rest = rest.slice(match[0].length);
		const child = match[1] ?? match[2] ?? match[4];
		if (match[1] === "Parent") current = current.parent;
		else if (child !== undefined) current = current.children.get(child);
		else return undefined;
	}
	return rest.trim() === "" ? current : undefined;
}

/**
 * The requires between the game's own files, as [requirer, required] by path from the repo root,
 * read through the sourcemap Rojo writes (`rojo sourcemap game.project.json`): every instance path
 * and every `script.Parent` chain resolves where Rojo and Rogen put the file, not where its folder
 * looks like it goes. `dir` is the folder the sourcemap was written in, `read` gives a file's text.
 */
export function requireEdges(
	sourcemap: SourcemapNode,
	dir: string,
	files: Set<string>,
	read: (file: string) => string,
): [string, string][] {
	const { root, byFile } = instancesOf(sourcemap, dir);
	const edges: [string, string][] = [];
	for (const [file, script] of byFile) {
		if (!files.has(file)) continue;
		const text = withoutComments(read(file));
		const aliases = aliasesOf(text);
		for (const call of text.matchAll(/\brequire\s*\(/g)) {
			const argument = argumentOf(text, call.index + call[0].length - 1);
			if (argument === undefined) continue;
			const target = follow(argument, script, root, aliases)?.file;
			if (target !== undefined && files.has(target) && target !== file) edges.push([file, target]);
		}
	}
	return edges;
}

/** Which layer imports which: a violation for each file pair, with the next move. */
export function layerErrors(edges: [string, string][], roots: string[]): string[] {
	const errors: string[] = [];
	const seen = new Set<string>();
	const module = (file: string) => {
		const root = rootOf(file, roots) as string;
		const [layer, name] = file.slice(root.length + 1).split("/");
		return { root, layer: layer as string, name: name as string, label: layer === "app" ? "app" : `${layer}/${name}` };
	};
	for (const [from, to] of edges) {
		const a = module(from);
		const b = module(to);
		const lower = LAYERS.indexOf(a.layer as Layer);
		const upper = LAYERS.indexOf(b.layer as Layer);
		let error: string | undefined;
		if (a.root === "projects/common/src" && b.root.startsWith("projects/") && b.root !== a.root) {
			error = `${from} requires ${to}: the shared code never requires a place, whose code the other places lack. Move what both need into projects/common/src.`;
		} else if (
			a.root !== b.root &&
			a.root.startsWith("projects/") &&
			b.root.startsWith("projects/") &&
			b.root !== "projects/common/src"
		) {
			error = `${from} requires ${to}: a place never requires another place. Move what both need into projects/common/src.`;
		} else if (lower >= 0 && upper >= 0 && upper < lower) {
			if (a.layer === "features")
				error = `${a.label} requires app/: a feature never requires app/, which only starts it. Move what it needs into the feature, game/<system>/ or platform/<module>/.`;
			else if (a.layer === "game" && b.layer === "features")
				error = `${a.label} requires ${b.label}. game/ never knows a feature: have the feature register with ${a.label}, or move the code into the feature.`;
			else if (a.layer === "game")
				error = `${a.label} requires app/. game/ never knows app/: move what it needs into game/<system>/ or platform/<module>/.`;
			else
				error = `${a.label} requires ${b.label}. platform/ is game-agnostic and never requires game/, features/ or app/: move the code into game/<system>/, or pass what it needs in as arguments.`;
		}
		if (error === undefined) continue;
		const key = error.startsWith(a.label) ? `${a.root}|${a.label}|${b.label}` : `${from}|${to}`;
		if (seen.has(key)) continue;
		seen.add(key);
		errors.push(error.startsWith(from) ? error : `${error} (${from} requires ${to})`);
	}
	return errors;
}
