// Which skill covers a file, from the path rules in .claude/rules/ (`paths:` in each rule's front
// matter; Cursor's and Copilot's rules repeat them). Claude Code, Cursor and Copilot load a rule
// themselves when the agent works on a matching file. Codex and Gemini CLI have nothing like it, so
// for them the edit hook names the skill the first time in a session the agent writes such a file.
import fs from "node:fs";
import path from "node:path";
import type { Payload } from "./guard.ts";
import { projectRoot } from "./project.ts";

/** A glob as the rules write it (`**`, `*`), as a regular expression over a path from the root. */
export function globPattern(glob: string): RegExp {
	let pattern = "";
	for (let i = 0; i < glob.length; i++) {
		const char = glob[i] ?? "";
		if (glob.startsWith("**/", i)) {
			pattern += "(?:.*/)?";
			i += 2;
		} else if (glob.startsWith("**", i)) {
			pattern += ".*";
			i += 1;
		} else if (char === "*") pattern += "[^/]*";
		else pattern += char.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
	}
	return new RegExp(`^${pattern}$`);
}

/** Each rule's skill and the globs of the files it covers. */
export function readRules(root: string): { skill: string; globs: string[] }[] {
	const dir = path.join(root, ".claude", "rules");
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir)
		.filter((file) => file.endsWith(".md"))
		.map((file) => {
			const text = fs.readFileSync(path.join(dir, file), "utf8");
			const front = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? "";
			const globs = [...front.matchAll(/^\s*-\s*"([^"]+)"\s*$/gm)].map(([, glob = ""]) => glob);
			return { skill: path.basename(file, ".md"), globs };
		});
}

/** Where a session's named skills are kept. */
const recordOf = (root: string, session: string) =>
	path.join(root, "node_modules", ".cache", "baseplate-skills", `${session}.json`);

/**
 * The skills that cover these files (paths from the root) and haven't been named yet in this
 * session, recording them as named. Without a session there's nothing to remember them by: none.
 */
export function newSkills(root: string, files: string[], session: string | undefined): string[] {
	if (session === undefined || !/^[\w-]+$/.test(session)) return [];
	const skills = readRules(root)
		.filter(({ globs }) => files.some((file) => globs.some((glob) => globPattern(glob).test(file))))
		.map(({ skill }) => skill);
	if (skills.length === 0) return [];
	const record = recordOf(root, session);
	let named: string[] = [];
	try {
		named = JSON.parse(fs.readFileSync(record, "utf8")) as string[];
	} catch {}
	const fresh = skills.filter((skill) => !named.includes(skill));
	if (fresh.length > 0) {
		try {
			fs.mkdirSync(path.dirname(record), { recursive: true });
			fs.writeFileSync(record, JSON.stringify([...named, ...fresh]));
		} catch {}
	}
	return fresh;
}

/** The note for the agent about each skill. */
export const skillNote = (skill: string) =>
	`Before you go on, read .agents/skills/${skill}/SKILL.md: it covers the kind of file you just wrote.`;

/** Forgets the skills named in a session, so each is named again. */
export function forgetSkills(root: string, session: string | undefined) {
	if (session !== undefined && /^[\w-]+$/.test(session)) fs.rmSync(recordOf(root, session), { force: true });
}

// When the conversation is compacted, what the skills said is summarized away; Claude Code loads its
// own path rules again then, so the skills this hook named are named again too.
if (import.meta.main) {
	let payload: Payload = {};
	try {
		payload = JSON.parse(fs.readFileSync(0, "utf8")) as Payload;
	} catch {}
	const root = projectRoot(payload.cwd ?? process.cwd());
	const session = payload.session_id;
	if (root !== undefined) forgetSkills(root, session);
}
