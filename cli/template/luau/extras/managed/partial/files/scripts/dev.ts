import path from "node:path";
import spawn from "cross-spawn";

const placesDir = path.dirname(process.cwd());
const config =
	path.basename(placesDir) === "projects"
		? [path.join(path.dirname(placesDir), `${path.basename(process.cwd())}.rogen.json`)]
		: [];
const run = spawn.sync("rogen", ["serve", ...config], { stdio: "inherit" });
process.exit(run.status ?? 1);
