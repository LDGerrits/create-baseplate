// Uploads the new and changed files in assets/ to Roblox with Asphalt, writes their IDs to
// src/Shared/Assets.luau, and formats that module as StyLua would, so the check leaves it as it is.
// `mise run assets` runs it; Asphalt reads ASPHALT_API_KEY, which the task loads from .env.
import fs from "node:fs";
import spawn from "cross-spawn";

const MODULE = "src/Shared/Assets.luau";

if (/^id = 0$/m.test(fs.readFileSync("asphalt.toml", "utf8"))) {
	console.error('Set [creator] in asphalt.toml first: your Roblox user ID, or type = "group" and the group ID.');
	process.exit(1);
}
const run = spawn.sync("asphalt", ["sync", "cloud"], { stdio: "inherit" });
// Asphalt writes the module even when some uploads fail, so format it either way.
if (fs.existsSync(MODULE)) spawn.sync("stylua", [MODULE], { stdio: "inherit" });
process.exit(run.status ?? 1);
