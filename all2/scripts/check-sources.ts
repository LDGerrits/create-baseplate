// Catches source mistakes that pass the type checker and every test, because the code they concern
// never runs:
// - a test named *.test.luau: Jest here runs *.spec.luau files only, and skips the rest without a word;
// - a spec outside the source folders: no project file mounts it, so it never runs;
// - a service or controller no entry script lists: nothing requires it, so it never starts.
//   Services (*Service.luau in a Server/ folder) start from src/App/Server/Main.server.luau,
//   controllers (*Controller.luau in a Client/ folder) from src/App/Client/Start.luau;
// - a remote the server takes outside Network/Server/Serve.luau, with no rate limit or argument
//   check (see unguarded-remotes.ts).
// `mise run check` runs it. In a multi-place game, a place's entry scripts start its own code and
// the shared code; shared code passes when one place lists it.
import fs from "node:fs";
import path from "node:path";
import { unguardedRemotes } from "./unguarded-remotes.ts";

const SERVER_ENTRY = "App/Server/Main.server.luau";
const CLIENT_ENTRY = "App/Client/Start.luau";
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

/** Without comments, so a module named in one isn't counted as listed. */
const code = (file: string) =>
	fs.existsSync(file) ? fs.readFileSync(file, "utf8").replace(/--\[(=*)\[[\s\S]*?\]\1\]|--.*$/gm, "") : "";

const entries = places.map((place) => {
	const root = multi ? `projects/${place}/src` : "src";
	return { root, server: code(`${root}/${SERVER_ENTRY}`), client: code(`${root}/${CLIENT_ENTRY}`) };
});

/** Whether an entry script's code requires the module at `file`: its folder and name, as `Clicker.ClickerService)`. */
function lists(entry: string, file: string): boolean {
	const parts = file.replace(/\.luau?$/, "").split("/");
	const name = parts.at(-1) ?? "";
	// The routing folder (Server/, Client/) leaves no instance, so the feature folder sits above it.
	const feature = parts.at(-3) ?? "";
	return new RegExp(`\\b${feature}\\s*\\.\\s*${name}\\s*\\)`).test(entry);
}

for (const file of sources) {
	const side = /\/Server\/[^/]+Service\.luau?$/.test(file)
		? "server"
		: /\/Client\/[^/]+Controller\.luau?$/.test(file)
			? "client"
			: undefined;
	if (side === undefined) continue;
	// A place's own file must be started by that place; shared code by any place.
	const owners = entries.filter(
		(entry) => !multi || file.startsWith("projects/common/") || file.startsWith(`${entry.root}/`),
	);
	if (owners.some((entry) => lists(side === "server" ? entry.server : entry.client, file))) continue;
	const kind = side === "server" ? "service" : "controller";
	const root = multi ? "projects/<place>/src" : "src";
	const where = side === "server" ? SERVER_ENTRY : CLIENT_ENTRY;
	errors.push(
		`${file}: a ${kind} no entry script lists, so it never starts. Add its require to the ${kind === "service" ? "services" : "controllers"} in ${root}/${where}.`,
	);
}

errors.push(...unguardedRemotes(new Map(sources.map((file) => [file, fs.readFileSync(file, "utf8")]))));

for (const error of errors) console.error(error);
if (errors.length > 0) process.exit(1);
