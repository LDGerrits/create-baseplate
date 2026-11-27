import fs from "node:fs";
import spawn from "cross-spawn";

if (process.argv.includes("--check")) {
	const dry = spawn.sync("asphalt", ["sync", "cloud", "--dry-run", "--quiet"], { encoding: "utf8" });
	if (dry.error) {
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

const config = fs.readFileSync("asphalt.toml", "utf8");
const MODULE = `${/^output_path = "([^"]+)"/m.exec(config)?.[1] ?? "src/game/assets/shared"}/Assets.luau`;

if (/^id = 0$/m.test(config)) {
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
// Asphalt writes the module even when some uploads fail, so format it either way.
if (fs.existsSync(MODULE)) spawn.sync("stylua", [MODULE], { stdio: "inherit" });
process.exit(run.status ?? 1);
