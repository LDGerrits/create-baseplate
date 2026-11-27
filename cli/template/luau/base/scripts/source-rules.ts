// Rules for the game's source files that luau-lsp and Selene don't have (scripts/check-sources.ts
// runs them).
import path from "node:path";

/** Files are PascalCase, with dotted suffixes such as `.server`, `.spec` or `.story`; `init` too. */
const PASCAL = /^(?:[A-Z][A-Za-z0-9]*|init)(?:\.[a-z]+)*\.luau?$/;

export function namingErrors(files: string[]): string[] {
	return files
		.filter((file) => !PASCAL.test(path.posix.basename(file)))
		.map((file) => {
			const [stem = "", ...rest] = path.posix.basename(file).split(".");
			const pascal = stem
				.split(/[-_]/)
				.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
				.join("");
			return `${file}: file names are PascalCase, since they're module names: ${[pascal, ...rest].join(".")}.`;
		});
}

/** A comment after the code on the same line: ` -- <why>`. */
const REASON = /--\s*\S/;

/** A `selene: allow` or a `:: any` cast with no reason after it. */
export function silencedErrors(file: string, source: string): string[] {
	return source.split("\n").flatMap((line, index) => {
		const at = `${file}:${index + 1}`;
		const allow = /--\s*selene:\s*allow\([^)]*\)(.*)$/.exec(line);
		if (allow !== null && !REASON.test(allow[1] ?? "")) {
			return [`${at}: say why Selene is wrong here, after the allow: \`-- selene: allow(<lint>) -- <why>\`.`];
		}
		const cast = /::\s*any\b(.*)$/.exec(line);
		if (cast !== null && !line.trimStart().startsWith("--") && !REASON.test(cast[1] ?? "")) {
			return [
				`${at}: \`:: any\` turns the type checker off: fix the type, or say why it can't be typed: \`:: any -- <why>\`.`,
			];
		}
		return [];
	});
}
