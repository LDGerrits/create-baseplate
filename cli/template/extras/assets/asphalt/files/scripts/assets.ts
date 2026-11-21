// Uploads the new and changed files in assets/ to Roblox with Asphalt, and writes their IDs as typed
// code. `mise run assets` runs it; Asphalt reads ASPHALT_API_KEY, which the task loads from .env.
import fs from "node:fs";
import spawn from "cross-spawn";

if (/^id = 0$/m.test(fs.readFileSync("asphalt.toml", "utf8"))) {
	console.error('Set [creator] in asphalt.toml first: your Roblox user ID, or type = "group" and the group ID.');
	process.exit(1);
}
const run = spawn.sync("asphalt", ["sync", "cloud"], { stdio: "inherit" });
process.exit(run.status ?? 1);
