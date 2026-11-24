// `mise run dev`: serves the code with Rogen, which writes the project file again on every change.
// Open your place in Studio and press Connect in the Rojo plugin. Runs in a place's folder (see
// each-place.ts); a multi-place game's place has its config at the repo root.
import path from "node:path";
import spawn from "cross-spawn";

const placesDir = path.dirname(process.cwd());
const config =
	path.basename(placesDir) === "projects"
		? [path.join(path.dirname(placesDir), `${path.basename(process.cwd())}.rogen.json`)]
		: [];
const run = spawn.sync("rogen", ["serve", ...config], { stdio: "inherit" });
process.exit(run.status ?? 1);
