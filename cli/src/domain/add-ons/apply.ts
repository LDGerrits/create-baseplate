import fs from "node:fs";
import path from "node:path";
import { templateExtras } from "../../base/template.ts";
import { replaceExact, replaceSection } from "../../base/text-edit.ts";
import type { Language } from "./language.ts";
import { manifestOf } from "./manifest.ts";
import { type AddOnChoices, addOnsByLanguage, managedOf } from "./questions.ts";

/**
 * Applies each chosen add-on to the project in `dir`, in the order of the language's questions: the
 * UI first. What the managed question chooses goes last, so it changes the game as the other
 * add-ons have left it.
 */
export function installAddOns(dir: string, language: Language, chosen: AddOnChoices) {
	const questions = addOnsByLanguage[language];
	const ordered = [...questions.filter((q) => q.name !== "managed"), ...questions.filter((q) => q.name === "managed")];
	for (const addOn of ordered) {
		const name = addOn.name;
		const value = chosen[name] ?? addOn.defaultValue;
		const manifest = manifestOf(language, name, value);
		if (manifest === undefined) continue;
		const from = path.join(templateExtras(language), name, value);
		const variant = manifest.byUi?.[chosen.ui ?? ""];
		const managedVariant = manifest.byManaged?.[managedOf(chosen)];

		for (const file of manifest.removeFiles ?? []) fs.rmSync(path.join(dir, file), { force: true, recursive: true });
		const files = path.join(from, "files");
		if (fs.existsSync(files)) fs.cpSync(files, dir, { recursive: true });
		if (managedVariant?.files !== undefined) fs.cpSync(path.join(from, managedVariant.files), dir, { recursive: true });
		for (const task of manifest.removeMiseTasks ?? []) removeMiseTask(dir, task);
		const remove = manifest.removeDependencies ?? [];
		if (language === "luau") {
			editWally(dir, "dependencies", variant?.dependencies ?? manifest.dependencies ?? {}, remove);
			editWally(dir, "server-dependencies", manifest.serverDependencies ?? {}, remove);
			editWally(dir, "dev-dependencies", {}, remove);
		} else {
			editPackage(dir, variant?.dependencies ?? manifest.dependencies ?? {}, remove);
		}
		const mise = path.join(from, "mise.toml");
		if (fs.existsSync(mise)) addMise(dir, fs.readFileSync(mise, "utf8"));
		for (const [file, imports] of Object.entries(manifest.imports ?? {})) addImports(path.join(dir, file), imports);
		const agents = fs.readFileSync(path.join(from, managedVariant?.agents ?? variant?.agents ?? "AGENTS.md"), "utf8");
		const heading = manifest.replaceAgentsSection;
		if (heading === undefined) addAgentsSection(dir, agents);
		else editFile(dir, "AGENTS.md", (text) => replaceSection(text, heading, agents, "AGENTS.md"));
		for (const { file, from: text, to } of manifest.replaceText ?? []) {
			editFile(dir, file, (content) => replaceExact(content, text, to, `${name}: ${file}`));
		}
	}
}

function editPackage(dir: string, add: Record<string, string>, remove: string[]) {
	const file = path.join(dir, "package.json");
	const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, Record<string, string> | undefined>;
	const sorted = (entries: Record<string, string>) =>
		Object.fromEntries(
			Object.entries(entries)
				.filter(([name]) => !remove.includes(name))
				.sort(([a], [b]) => a.localeCompare(b)),
		);
	pkg.dependencies = sorted({ ...pkg.dependencies, ...add });
	if (pkg.devDependencies !== undefined) pkg.devDependencies = sorted(pkg.devDependencies);
	fs.writeFileSync(file, `${JSON.stringify(pkg, undefined, "\t")}\n`);
}

function addImports(file: string, imports: string[]) {
	const lines = fs.readFileSync(file, "utf8").split("\n");
	if (file.endsWith(".luau")) {
		const last = lines.findLastIndex((line) => /^\s+require\(/.test(line));
		if (last !== -1) {
			const indent = /^\s+/.exec(lines[last] ?? "")?.[0] ?? "\t";
			lines.splice(last + 1, 0, ...imports.map((module) => `${indent}require(${module}),`));
		} else {
			const empty = lines.findIndex((line) => /^local \w+: .* = \{\}$/.test(line));
			if (empty === -1) throw new Error(`${file} has no list of required modules to add to`);
			const service = "ServerScriptService";
			const needsService =
				imports.some((module) => module.startsWith(`${service}.`)) &&
				!lines.some((line) => line.startsWith(`local ${service} `));
			lines.splice(
				empty,
				1,
				...(needsService ? [`local ${service} = game:GetService("${service}")`, ""] : []),
				(lines[empty] ?? "").slice(0, -1),
				...imports.map((module) => `\trequire(${module}),`),
				"}",
			);
		}
	} else {
		const last = lines.findLastIndex((line) => line.startsWith("import "));
		lines.splice(last + 1, 0, ...imports.map((module) => `import "${module}";`));
	}
	fs.writeFileSync(file, lines.join("\n"));
}

function editWally(dir: string, table: string, add: Record<string, string>, remove: string[]) {
	const file = path.join(dir, "wally.toml");
	const toml = fs.readFileSync(file, "utf8");
	const header = `[${table}]`;
	const start = toml.indexOf(`${header}\n`);
	const bodyStart = start === -1 ? toml.length : start + header.length + 1;
	const next = toml.indexOf("\n[", bodyStart);
	const bodyEnd = start === -1 ? toml.length : next === -1 ? toml.length : next + 1;
	const entries = new Map<string, string>();
	for (const line of toml.slice(bodyStart, bodyEnd).split("\n")) {
		const match = /^\s*([\w-]+)\s*=\s*"([^"]*)"/.exec(line);
		if (match?.[1] !== undefined && match[2] !== undefined) entries.set(match[1], match[2]);
	}
	for (const [alias, spec] of Object.entries(add)) entries.set(alias, spec);
	for (const alias of remove) entries.delete(alias);
	if (start === -1 && entries.size === 0) return;
	const body = [...entries]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([alias, spec]) => `${alias} = "${spec}"\n`)
		.join("");
	const rest = toml.slice(bodyEnd);
	fs.writeFileSync(
		file,
		start === -1
			? `${toml.trimEnd()}\n\n${header}\n${body}`
			: `${toml.slice(0, bodyStart)}${body}${rest === "" ? "" : `\n${rest.replace(/^\n+/, "")}`}`,
	);
}

function removeMiseTask(dir: string, name: string) {
	const file = path.join(dir, "mise.toml");
	const mise = fs.readFileSync(file, "utf8");
	const header = [`[tasks.${name}]`, `[tasks."${name}"]`].find((candidate) => mise.includes(`\n${candidate}\n`));
	if (header === undefined) throw new Error(`mise.toml has no task ${name} to remove`);
	const start = mise.indexOf(`\n${header}\n`) + 1;
	const next = mise.indexOf("\n[", start);
	fs.writeFileSync(file, `${mise.slice(0, start)}${next === -1 ? "" : mise.slice(next + 1)}`.replace(/\n+$/, "\n"));
}

const editFile = (dir: string, file: string, edit: (text: string) => string) => {
	const at = path.join(dir, file);
	fs.writeFileSync(at, edit(fs.readFileSync(at, "utf8")));
};

/** Puts the add-on's section before the Rogen section, which Rogen manages at the end of AGENTS.md. */
function addAgentsSection(dir: string, section: string) {
	const file = path.join(dir, "AGENTS.md");
	const agents = fs.readFileSync(file, "utf8");
	const marker = agents.indexOf("<!-- rogen -->");
	const at = marker === -1 ? agents.length : marker;
	fs.writeFileSync(file, `${agents.slice(0, at)}${section.trim()}\n\n${agents.slice(at)}`);
}

const TOOLS = /^\[tools\]\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m;

/** The lines of a mise.toml's [tools] table, which its mise.lock covers. */
export const miseTools = (mise: string) => TOOLS.exec(mise)?.[1];

function addMise(dir: string, fragment: string) {
	const file = path.join(dir, "mise.toml");
	let mise = fs.readFileSync(file, "utf8");
	const tools = TOOLS.exec(fragment);
	if (tools !== null) {
		const start = mise.indexOf("[tools]\n");
		if (start === -1) throw new Error("mise.toml has no [tools] table");
		const next = mise.indexOf("\n[", start);
		const end = mise.slice(0, next).trimEnd().length;
		mise = `${mise.slice(0, end)}\n${tools[1]?.trim()}${mise.slice(end)}`;
		fragment = fragment.replace(tools[0], "");
	}
	const rest = fragment.trim();
	fs.writeFileSync(file, `${mise.trimEnd()}\n${rest === "" ? "" : `\n${rest}\n`}`);
}
