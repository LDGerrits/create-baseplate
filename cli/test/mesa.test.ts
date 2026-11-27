import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";

const script = new URL("../../.github/scripts/mesa.sh", import.meta.url).pathname;
const temps: string[] = [];
after(() => {
	for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true });
});

function machine() {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "mesa-"));
	temps.push(root);
	const bin = path.join(root, "bin");
	const archives = path.join(root, "archives");
	fs.mkdirSync(bin);
	fs.mkdirSync(archives);
	fs.writeFileSync(path.join(bin, "sudo"), '#!/bin/sh\nexec "$@"\n', { mode: 0o755 });
	fs.writeFileSync(
		path.join(bin, "apt-get"),
		`#!/bin/sh
echo "$*" >> "${root}/calls"
case "$*" in
*.deb*) [ -z "$FAIL_LOCAL" ] ;;
*mesa-vulkan-drivers*) echo deb > "${archives}/mesa.deb" ;;
esac
`,
		{ mode: 0o755 },
	);
	const debs = path.join(root, "cache", "mesa-debs");
	const install = (env: Record<string, string> = {}) =>
		spawnSync("sh", [script, "install"], {
			encoding: "utf8",
			env: {
				...process.env,
				PATH: `${bin}:${process.env.PATH}`,
				MESA_DEBS: debs,
				MESA_APT_ARCHIVES: archives,
				...env,
			},
		});
	const calls = () =>
		fs.existsSync(path.join(root, "calls")) ? fs.readFileSync(path.join(root, "calls"), "utf8") : "";
	return { debs, install, calls };
}

test("a first install comes from the network and keeps the downloaded packages", () => {
	const { debs, install, calls } = machine();
	assert.equal(install().status, 0);
	assert.match(calls(), /install -y -q --no-install-recommends mesa-vulkan-drivers/);
	assert.deepEqual(fs.readdirSync(debs), ["mesa.deb"]);
});

test("with the packages cached it installs them and downloads nothing", () => {
	const { debs, install, calls } = machine();
	fs.mkdirSync(debs, { recursive: true });
	fs.writeFileSync(path.join(debs, "mesa.deb"), "deb");
	assert.equal(install().status, 0);
	assert.equal(calls().trim().split("\n").length, 1);
	assert.match(calls(), /mesa\.deb/);
	assert.doesNotMatch(calls(), /mesa-vulkan-drivers/);
});

test("cached packages that don't install fall back to the network install", () => {
	const { debs, install, calls } = machine();
	fs.mkdirSync(debs, { recursive: true });
	fs.writeFileSync(path.join(debs, "old.deb"), "deb");
	assert.equal(install({ FAIL_LOCAL: "1" }).status, 0);
	assert.match(calls(), /mesa-vulkan-drivers/);
});

test("the cache key names the package and the runner image", () => {
	const key = spawnSync("sh", [script, "key"], {
		encoding: "utf8",
		env: { ...process.env, ImageOS: "ubuntu24", ImageVersion: "20261101.1" },
	});
	assert.equal(key.stdout.trim(), "key=mesa-vulkan-drivers-ubuntu24-20261101.1");
});

test("each template's scripts/mesa.sh is this repository's, so the games' CI caches the driver the same way", () => {
	const mine = fs.readFileSync(script, "utf8");
	for (const language of ["typescript", "luau"]) {
		const copy = new URL(`../template/${language}/base/scripts/mesa.sh`, import.meta.url);
		assert.equal(fs.readFileSync(copy, "utf8"), mine, language);
	}
});
