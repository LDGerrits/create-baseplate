// Run by the pre-commit hook through scripts/pre-commit.ts, with unstaged changes and untracked files
// set aside, so the check sees exactly what is being committed. Biome formats the staged files and
// lint-staged re-stages them; then the whole check runs once, because type errors and failing tests
// reach past the staged files. The hook includes deleted files, so a commit that only deletes is
// checked too.
import fs from "node:fs";
import type { Configuration } from "lint-staged";

export default {
	"*": [
		(files: readonly string[]) => {
			const present = files.filter((file) => fs.existsSync(file));
			if (present.length === 0) return [];
			const paths = present.map((file) => JSON.stringify(file)).join(" ");
			return `biome check --write --no-errors-on-unmatched --files-ignore-unknown=true ${paths}`;
		},
		() => "mise run ci",
	],
} satisfies Configuration;
