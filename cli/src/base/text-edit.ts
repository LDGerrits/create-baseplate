/**
 * Replaces the Markdown section under `## <heading>`, up to the next `## ` heading, with `section`.
 * `where` names the text in the error.
 */
export function replaceSection(text: string, heading: string, section: string, where: string): string {
	const start = text.indexOf(`\n## ${heading}\n`) + 1;
	if (start === 0) throw new Error(`${where} has no "## ${heading}" section to replace`);
	const next = text.indexOf("\n## ", start);
	const end = next === -1 ? text.length : next + 1;
	return `${text.slice(0, start)}${section.trim()}\n${next === -1 ? "" : "\n"}${text.slice(end)}`;
}

/** Replaces the first `from` in `text` with `to`. `where` names the text in the error. */
export function replaceExact(text: string, from: string, to: string, where: string): string {
	if (!text.includes(from)) throw new Error(`${where} no longer has the text to replace: ${from}`);
	return text.replace(from, () => to);
}
