// Uploads the new and changed files in assets/ to Roblox with Asphalt, and writes their IDs as typed
// code. `mise run assets` runs it; Asphalt reads ASPHALT_API_KEY, which the task loads from .env.
//
//   node scripts/assets.ts --check: what the check runs; fails on a file not uploaded yet.
import fs from "node:fs";
import spawn from "cross-spawn";

if (process.argv.includes("--check")) {
	const dry = spawn.sync("asphalt", ["sync", "cloud", "--dry-run", "--quiet"], { encoding: "utf8" });
	if (dry.error !== undefined) {
		console.log(`asphalt: ${dry.error.message}; run \`mise install\`, or the check through mise.`);
		process.exit(1);
	}
	if (dry.status !== 0) {
		const output = `${dry.stdout ?? ""}${dry.stderr ?? ""}`.trim();
		console.log(output);
		if (/would be synced/.test(output)) console.log("Upload the new files in assets/ with `mise run assets`.");
	}
	process.exit(dry.status ?? 1);
}

if (/^id = 0$/m.test(fs.readFileSync("asphalt.toml", "utf8"))) {
	console.error('Set [creator] in asphalt.toml first: your Roblox user ID, or type = "group" and the group ID.');
	process.exit(1);
}
if ((process.env.ASPHALT_API_KEY ?? "") === "") {
	console.error(
		"ASPHALT_API_KEY isn't set: put it in .env (see .env.example) and run `mise run assets`, which loads it.",
	);
	process.exit(1);
}
const run = spawn.sync("asphalt", ["sync", "cloud"], { stdio: "inherit" });
process.exit(run.status ?? 1);
