import fs from "node:fs";

export type ProjectNode = Record<string, unknown>;

export const writeIfChanged = (file: string, text: string) => {
	if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== text) fs.writeFileSync(file, text);
};

const pathOf = (value: unknown) => (typeof value === "string" ? value : (value as { optional: string }).optional);

/** Every `$path` in a project tree, in tree order. */
export function pathsIn(node: unknown): string[] {
	if (Array.isArray(node) || node === null || typeof node !== "object") return [];
	return Object.entries(node).flatMap(([key, value]) => (key === "$path" ? [pathOf(value)] : pathsIn(value)));
}

/** The project with each path in it, `$path` and `globIgnorePaths`, moved by `move`. */
export function mapPaths<T>(node: T, move: (path: string) => string): T {
	if (Array.isArray(node) || node === null || typeof node !== "object") return node;
	return Object.fromEntries(
		Object.entries(node).map(([key, value]) => {
			if (key === "globIgnorePaths" && Array.isArray(value)) return [key, value.map((glob: string) => move(glob))];
			if (key !== "$path") return [key, mapPaths(value, move)];
			return [key, typeof value === "string" ? move(value) : { ...value, optional: move(pathOf(value)) }];
		}),
	) as T;
}

/** The game with loadstring() on, which Jest needs and a live game shouldn't have. */
export function testProjectOf(game: ProjectNode): ProjectNode {
	const tree = game.tree as ProjectNode;
	const serverScripts = (tree.ServerScriptService ?? { $className: "ServerScriptService" }) as ProjectNode;
	return {
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
}
