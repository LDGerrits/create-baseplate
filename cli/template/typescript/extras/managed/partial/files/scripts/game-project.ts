// Also writes test.project.json, the same game with loadstring() on, for jest-roblox: Jest needs
// it, and a live game shouldn't have it, so only the place the engine tests upload gets it.
import fs from "node:fs";
import path from "node:path";

const writeIfChanged = (file: string, text: string) => {
	if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) fs.writeFileSync(file, text);
};

type ProjectNode = Record<string, unknown>;

const code = JSON.parse(fs.readFileSync("default.project.json", "utf8"));
const tree = code.tree as ProjectNode;

const game = { ...code, name: "game" };
writeIfChanged("game.project.json", `${JSON.stringify(game, undefined, "\t")}\n`);

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
writeIfChanged("test.project.json", `${JSON.stringify(test, undefined, "\t")}\n`);

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
	writeIfChanged(
		path.join(placesDir, "..", `test.${place}.project.json`),
		`${JSON.stringify(fromRoot(test), undefined, "\t")}\n`,
	);
}
