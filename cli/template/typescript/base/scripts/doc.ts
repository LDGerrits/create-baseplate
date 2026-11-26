// `mise run doc [topic]`: Baseplate's docs for the create-baseplate version package.json pins, the
// one this game's setup comes from, printed as Markdown. Without a topic, lists them. pnpm fetches
// that version once, so the first run needs the network; later ones come from pnpm's store.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const pin = (JSON.parse(fs.readFileSync("package.json", "utf8")) as { baseplate?: { version?: string } }).baseplate
	?.version;
const doc = spawnSync("pnpm", ["dlx", `create-baseplate@${pin ?? "latest"}`, "doc", ...process.argv.slice(2)], {
	stdio: "inherit",
	shell: process.platform === "win32",
});
// Only when pnpm couldn't fetch it: create-baseplate's own refusals say why themselves.
const fetchable = () =>
	spawnSync("pnpm", ["view", `create-baseplate@${pin ?? "latest"}`, "version"], {
		stdio: "ignore",
		shell: process.platform === "win32",
	}).status === 0;
if (doc.status !== 0 && !fetchable()) {
	console.error(
		`Couldn't run create-baseplate@${pin ?? "latest"}: pnpm needs the network the first time it runs a version, and the version must be published on npm.`,
	);
}
process.exit(doc.status ?? 1);
