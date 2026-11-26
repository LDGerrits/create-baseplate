// mise's own version is pinned by hand: in this repository's workflows' jdx/mise-action `version:`,
// and in the templates' cloud setup, which also pins the SHA-256 of the binaries it downloads (a
// game's workflows read their version from it, so they hold no pin of their own). This fails when
// they disagree, or when those SHA-256s aren't the ones that release publishes, so a bump (Renovate's
// or a person's) can't leave one behind. CI runs it: `node .github/scripts/check-mise-pins.ts`.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const files = execFileSync("git", ["ls-files", "*.yml", "*.yaml", "*cloud-setup.sh"], { encoding: "utf8" })
	.split("\n")
	.filter((file) => file !== "");

const versions = new Map<string, string[]>();
const pin = (version: string, where: string) => versions.set(version, [...(versions.get(version) ?? []), where]);
let sums: { file: string; arch: string; sum: string }[] = [];

for (const file of files) {
	const text = fs.readFileSync(file, "utf8");
	// Each jdx/mise-action step's `version:`, up to the next step; a game's workflows read it from
	// cloud-setup.sh (an expression), so only a number is a pin.
	const lines = text.split("\n");
	lines.forEach((line, index) => {
		if (!line.includes("uses: jdx/mise-action@")) return;
		for (const next of lines.slice(index + 1)) {
			if (/^\s*- /.test(next) || !/^\s/.test(next)) break;
			const version = /^\s+version: (\d\S*)/.exec(next)?.[1];
			if (version !== undefined) pin(version, file);
		}
	});
	const misePin = /^MISE_VERSION="([^"]+)"/m.exec(text);
	if (misePin?.[1] !== undefined) {
		pin(misePin[1], file);
		sums = [...text.matchAll(/(x86_64|aarch64)[^\n]*arch="(\w+)" sum="([0-9a-f]{64})"/g)].map((match) => ({
			file,
			arch: match[2] ?? "",
			sum: match[3] ?? "",
		}));
	}
}

const problems: string[] = [];
if (versions.size > 1) {
	problems.push(
		`mise is pinned to different versions:\n${[...versions].map(([version, where]) => `  ${version}: ${where.join(", ")}`).join("\n")}`,
	);
}
const [version] = [...versions.keys()];
if (version !== undefined && sums.length > 0) {
	// GitHub's release downloads answer 5xx now and then; a few tries ride that out.
	const url = `https://github.com/jdx/mise/releases/download/v${version}/SHASUMS256.txt`;
	let response = await fetch(url);
	for (let attempt = 1; attempt < 4 && response.status >= 500; attempt++) {
		await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
		response = await fetch(url);
	}
	if (!response.ok) throw new Error(`mise v${version}'s SHASUMS256.txt: HTTP ${response.status}`);
	const published = await response.text();
	for (const { file, arch, sum } of sums) {
		const expected = new RegExp(
			`^([0-9a-f]{64})\\s+\\./mise-v${version.replaceAll(".", "\\.")}-linux-${arch}$`,
			"m",
		).exec(published)?.[1];
		if (expected !== sum) problems.push(`${file}: the linux-${arch} SHA-256 for mise ${version} should be ${expected}`);
	}
}

for (const problem of problems) console.error(problem);
if (problems.length > 0) process.exit(1);
console.log(`mise ${version} everywhere, with the published SHA-256s.`);
