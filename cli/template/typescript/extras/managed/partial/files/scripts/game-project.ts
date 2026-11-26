// Writes game.project.json, the code as a whole game: default.project.json (which Rogen writes)
// under the name "game". Builds, the place check and the tests use it. The world isn't in it: it
// lives in the user's place in Studio, so the tests run in a place made of the code alone.
//
// Also writes test.project.json, the same game with loadstring() on, for jest-roblox: Jest needs
// it, and a live game shouldn't have it, so only the place the engine tests upload gets it.
import fs from "node:fs";
import path from "node:path";

/** Writes `text` to `file` only when it differs, so watchers (the ESLint server, luau-lsp) see no change. */
const write = (file: string, text: string) => {
	if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) fs.writeFileSync(file, text);
};

type ProjectNode = Record<string, unknown>;

const code = JSON.parse(fs.readFileSync("default.project.json", "utf8"));
const tree = code.tree as ProjectNode;

const game = { ...code, name: "game" };
write("game.project.json", `${JSON.stringify(game, undefined, "\t")}\n`);

const serverScripts = (tree.ServerScriptService ?? { $className: "ServerScriptService" }) as ProjectNode;
const test = {
	...game,
	name: "test",
	tree: {
		...tree,
		ServerScriptService: {
			...serverScripts,
			$properties: { ...(serverScripts.$properties as ProjectNode | undefined), LoadStringEnabled: true },
		},
	},
};
write("test.project.json", `${JSON.stringify(test, undefined, "\t")}\n`);

// In a multi-place game this runs in projects/<place>/. jest-roblox matches its compiled folders
// against the project's $path strings as written, which here start with ../../, so it also gets a
// copy at the repo root with paths from there: test.<place>.project.json.
const placesDir = path.dirname(process.cwd());
if (path.basename(placesDir) === "projects") {
	const place = path.basename(process.cwd());
	const fromRoot = (node: unknown): unknown => {
		if (Array.isArray(node) || node === null || typeof node !== "object") return node;
		return Object.fromEntries(
			Object.entries(node).map(([key, value]) => {
				if (key !== "$path") return [key, fromRoot(value)];
				const rebase = (p: string) => path.posix.normalize(path.posix.join("projects", place, p));
				return [
					key,
					typeof value === "string"
						? rebase(value)
						: { ...value, optional: rebase((value as { optional: string }).optional) },
				];
			}),
		);
	};
	write(
		path.join(placesDir, "..", `test.${place}.project.json`),
		`${JSON.stringify(fromRoot(test), undefined, "\t")}\n`,
	);
}
