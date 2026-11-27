import fs from "node:fs";
import path from "node:path";
import { cycleErrors, layerErrors, requireEdges, type SourcemapNode, structureErrors } from "./layers.ts";
import { type Side, sideErrors } from "./sides.ts";
import {
	dataStoreErrors,
	duplicateErrors,
	e2eErrors,
	focusedErrors,
	namingErrors,
	silencedErrors,
	specErrors,
	storyErrors,
} from "./source-rules.ts";
import { unguardedRemotes } from "./unguarded-remotes.ts";

const SERVER_ENTRY = "app/server/Main.server.luau";
const CLIENT_ENTRY = "app/client/Start.luau";
const SKIPPED = new Set([
	"node_modules",
	"Packages",
	"ServerPackages",
	"DevPackages",
	"build",
	"dist",
	".git",
	".luau-lsp",
]);

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
		return /\.luau?$/.test(entry.name) ? [at] : [];
	});
}

const sources = sourceRoots.flatMap(filesUnder);
const inSources = new Set(sources);

for (const file of sources) {
	if (/\.test\.luau?$/.test(file)) {
		errors.push(
			`${file}: Jest here runs *.spec.luau files only, so this one never runs. Name it ${file.replace(/\.test\.luau?$/, ".spec.luau")}.`,
		);
	}
}
for (const file of filesUnder(".")) {
	if (/\.spec\.luau?$/.test(file) && !inSources.has(file)) {
		errors.push(
			`${file}: a spec outside ${sourceRoots.join(", ")} is in no project file, so it never runs. Move it next to the code it tests.`,
		);
	}
}

const code = (file: string) =>
	fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/--\[(=*)\[[\s\S]*?\]\1\]|--.*$/gm, "") : "";

const entries = places.map((place) => {
	const root = multi ? `projects/${place}/src` : "src";
	return { root, server: code(`${root}/${SERVER_ENTRY}`), client: code(`${root}/${CLIENT_ENTRY}`) };
});

const ROUTE = /^(server|shared|client)$/;
const SUFFIX = /@(server|client|shared)$/;

/**
 * Where Rogen routes a source file, and its instance names below the route's target: the governing
 * route is the outermost routing folder (`server/`) or `@` suffix (`Bank@server.luau`), and that
 * folder leaves no instance, while the suffix comes off the name.
 */
function routeOf(file: string): { side: string; names: string[] } | undefined {
	const root = sourceRoots.find((dir) => file.startsWith(`${dir}/`)) ?? "";
	const parts = file
		.slice(root.length + 1)
		.replace(/\.luau?$/, "")
		.split("/");
	let side: string | undefined;
	const names: string[] = [];
	for (const part of parts) {
		const folder = side === undefined ? ROUTE.exec(part)?.[0] : undefined;
		if (folder !== undefined) {
			side = folder;
			continue;
		}
		const suffix = SUFFIX.exec(part)?.[1];
		if (side === undefined && suffix !== undefined) side = suffix;
		names.push(part.replace(SUFFIX, ""));
	}
	return side === undefined ? undefined : { side, names };
}

function lists(entry: string, names: string[]): boolean {
	const tail = names.slice(-2).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	return new RegExp(`\\b${tail.join("\\s*\\.\\s*")}\\s*\\)`).test(entry);
}

for (const file of sources) {
	const route = routeOf(file);
	const name = route?.names.at(-1) ?? "";
	const side =
		route?.side === "server" && name.endsWith("Service")
			? "server"
			: route?.side === "client" && name.endsWith("Controller")
				? "client"
				: undefined;
	if (route === undefined || side === undefined) continue;
	const owners = entries.filter(
		(entry) => !multi || file.startsWith("projects/common/") || file.startsWith(`${entry.root}/`),
	);
	if (owners.some((entry) => lists(side === "server" ? entry.server : entry.client, route.names))) continue;
	const kind = side === "server" ? "service" : "controller";
	const root = multi ? "projects/<place>/src" : "src";
	const where = side === "server" ? SERVER_ENTRY : CLIENT_ENTRY;
	errors.push(
		`${file}: a ${kind} no entry script lists, so it never starts. Add its require to the ${kind === "service" ? "services" : "controllers"} in ${root}/${where}.`,
	);
}

errors.push(...structureErrors(sources, sourceRoots));

for (const file of sources) {
	const side = routeOf(file)?.side;
	if (side === "server" || side === "client" || side === "shared") {
		errors.push(...sideErrors(file, side as Side, fs.readFileSync(file, "utf8")));
	}
}

const sourceSet = new Set(sources);
const edgeKeys = new Set<string>();
const edges: [string, string][] = [];
for (const place of places) {
	const dir = multi ? `projects/${place}` : ".";
	const sourcemap = path.posix.join(dir, "sourcemap.json");
	if (!fs.existsSync(sourcemap)) {
		errors.push(`${sourcemap} is missing, and the layers are checked through it: run \`mise run generate\`.`);
		continue;
	}
	const tree = JSON.parse(fs.readFileSync(sourcemap, "utf8")) as SourcemapNode;
	for (const edge of requireEdges(tree, dir, sourceSet, (file) => fs.readFileSync(file, "utf8"))) {
		if (edgeKeys.has(edge.join(">"))) continue;
		edgeKeys.add(edge.join(">"));
		edges.push(edge);
	}
}
errors.push(...layerErrors(edges, sourceRoots), ...cycleErrors(edges, sourceRoots));

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
	...sources.flatMap((file) => [
		...silencedErrors(file, read(file)),
		...dataStoreErrors(file, read(file)),
		...focusedErrors(file, read(file)),
	]),
	...specErrors(sources, read),
	...e2eErrors(sources, e2eTests, read, testFolder),
	...storyErrors(sources, read),
	...(fs.existsSync("wally.lock") ? duplicateErrors(read("wally.lock")) : []),
);

for (const error of errors) console.error(error);
if (errors.length > 0) process.exit(1);
