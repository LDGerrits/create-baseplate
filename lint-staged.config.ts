// The pre-commit hook runs lint-staged, which sets unstaged changes aside first, so the check sees
// exactly what is being committed. Biome formats the staged files and lint-staged re-stages them;
// then the whole check runs once, because type errors and failing tests reach past the staged files.
import type { Configuration } from "lint-staged";

export default {
	"*": ["biome check --write --no-errors-on-unmatched --files-ignore-unknown=true", () => "mise run ci"],
} satisfies Configuration;
