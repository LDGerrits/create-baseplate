// Rules for the game's source files that no compiler or linter has (scripts/check-sources.ts runs them).
import path from "node:path";

/** Files are kebab-case, with dotted suffixes such as `.server`, `.spec` or `.story`. */
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z]+)*\.tsx?$/;

export function namingErrors(files: string[]): string[] {
	return files
		.filter((file) => !KEBAB.test(path.posix.basename(file)))
		.map((file) => {
			const name = path.posix.basename(file);
			const kebab = name
				.replace(/([a-z0-9])([A-Z])/g, "$1-$2")
				.replace(/_/g, "-")
				.toLowerCase();
			return `${file}: file names are kebab-case: ${kebab}.`;
		});
}

/** An eslint-disable comment with no reason after ` -- `. */
const BARE_DISABLE = /(?:\/\/|\/\*)\s*eslint-disable(?:-next-line|-line)?\b(?![^\n]*\s--\s+\S)/;

export function disableErrors(file: string, source: string): string[] {
	return source
		.split("\n")
		.flatMap((line, index) =>
			BARE_DISABLE.test(line)
				? [
						`${file}:${index + 1}: say why the rule is wrong here, after the rules: \`// eslint-disable-next-line <rule> -- <why>\`.`,
					]
				: [],
		);
}
