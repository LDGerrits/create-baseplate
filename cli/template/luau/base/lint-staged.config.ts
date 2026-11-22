// Run by the pre-commit hook through scripts/pre-commit.ts, with unstaged changes and untracked files
// set aside, so the check sees exactly what is being committed. StyLua formats the staged Luau and
// Biome the other files, and lint-staged re-stages them; then the whole check runs once, because
// type errors and failing tests reach past the staged files. The hook includes deleted files, so a
// commit that only deletes is checked too.
import fs from "node:fs";
import type { Configuration } from "lint-staged";

const quoted = (files: string[]) => files.map((file) => JSON.stringify(file)).join(" ");

export default {
	"*": [
		(files: readonly string[]) => {
			const present = files.filter((file) => fs.existsSync(file));
			const luau = present.filter((file) => /\.luau?$/.test(file));
			const other = present.filter((file) => !/\.luau?$/.test(file));
			return [
				...(luau.length === 0 ? [] : [`stylua ${quoted(luau)}`]),
				...(other.length === 0
					? []
					: [`biome check --write --no-errors-on-unmatched --files-ignore-unknown=true ${quoted(other)}`]),
			];
		},
		() => "mise run ci",
	],
} satisfies Configuration;
