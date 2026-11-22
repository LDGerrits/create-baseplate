// `mise run doc [topic]`: Baseplate's docs for the create-baseplate version package.json pins, the
// one this game's setup comes from, printed offline as Markdown. Without a topic, lists them.
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const pin = (JSON.parse(fs.readFileSync("package.json", "utf8")) as { baseplate?: { version?: string } }).baseplate
	?.version;
const doc = spawnSync("pnpm", ["dlx", `create-baseplate@${pin ?? "latest"}`, "doc", ...process.argv.slice(2)], {
	stdio: "inherit",
	shell: process.platform === "win32",
});
process.exit(doc.status ?? 1);
