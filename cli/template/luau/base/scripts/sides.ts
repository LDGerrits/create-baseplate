// Roblox APIs that work on one side only, and the check that keeps them out of the wrong folder:
// the type checker can't tell, so `Players.LocalPlayer` in server/ analyzes cleanly and is nil at
// runtime, and `DataStoreService` in client/ throws or is a design error. check-sources.ts runs
// `sideErrors` on every file under a side folder. The lists hold only APIs the Roblox docs say are
// client-only or server-only; an API that works on both (`HttpService:JSONEncode`, `StarterGui` as a
// container) isn't listed.
//
// shared/ runs on both sides, so both lists apply there. A call guarded by `RunService:IsClient()`
// or `IsServer()` carries `-- guarded: <why>` on its line, and the check lets it through.

/** Services that exist only on the client. */
export const CLIENT_ONLY_SERVICES = [
	"UserInputService",
	"ContextActionService",
	"GuiService",
	"HapticService",
	"VRService",
];
/** Members that only work on the client, whatever object they're read from. */
export const CLIENT_ONLY_MEMBERS = [
	"LocalPlayer",
	"RenderStepped",
	"BindToRenderStep",
	"UnbindFromRenderStep",
	"CurrentCamera",
	"SetCore",
	"SetCoreGuiEnabled",
	"PlayLocalSound",
];
/** Services that exist only on the server. */
export const SERVER_ONLY_SERVICES = [
	"DataStoreService",
	"MessagingService",
	"MemoryStoreService",
	"ServerStorage",
	"ServerScriptService",
];
/** Members that only work on the server. */
export const SERVER_ONLY_MEMBERS = ["AwardBadge", "ProcessReceipt", "SetNetworkOwner", "LoadCharacter"];
/** HttpService's requests are the server's: a client can't call them. */
export const SERVER_ONLY_HTTP = ["RequestAsync", "GetAsync", "PostAsync"];

export type Side = "server" | "client" | "shared";
type Works = "server" | "client";

const WHERE: Record<Works, string> = { server: "runs only on the server", client: "runs only on the client" };
const NEXT: Record<Works, string> = {
	client: "move this into client/ and send the result through a remote",
	server: "move this into server/ and have the client ask for it through a remote",
};

const message = (name: string, works: Works, side: Side) =>
	side === "shared"
		? `${name} ${WHERE[works]}, and shared/ runs on both sides: ${NEXT[works]}. If the call is guarded by RunService:IsServer()/IsClient(), add \`-- guarded: <why>\` to its line.`
		: `${name} ${WHERE[works]}: ${NEXT[works]}.`;

interface Pattern {
	pattern: RegExp;
	name: string;
	works: Works;
}

const services = (list: string[], works: Works): Pattern[] =>
	list.map((name) => ({
		// game:GetService("X"), game.X and game["X"]
		pattern: new RegExp(
			`\\bGetService\\s*\\(?\\s*["']${name}["']|\\bgame\\s*\\.\\s*${name}\\b|\\bgame\\s*\\[\\s*["']${name}["']\\s*\\]`,
		),
		name,
		works,
	}));
const members = (list: string[], works: Works): Pattern[] =>
	list.map((name) => ({ pattern: new RegExp(`[.:]\\s*${name}\\b`), name, works }));

const CLIENT_ONLY: Pattern[] = [...services(CLIENT_ONLY_SERVICES, "client"), ...members(CLIENT_ONLY_MEMBERS, "client")];
const SERVER_ONLY: Pattern[] = [
	...services(SERVER_ONLY_SERVICES, "server"),
	...members(SERVER_ONLY_MEMBERS, "server"),
	...SERVER_ONLY_HTTP.map((name) => ({
		pattern: new RegExp(`\\bHttpService\\s*:\\s*${name}\\b`),
		name: `HttpService:${name}`,
		works: "server" as const,
	})),
];

/** The code without comments, line for line, so a line number still points at the file. */
const withoutComments = (source: string) =>
	source
		.replace(/--\[(=*)\[[\s\S]*?\]\1\]/g, (block) => block.replace(/[^\n]/g, " "))
		.replace(/--.*$/gm, (comment) => " ".repeat(comment.length));

/**
 * One `<file>:<line>: ...` per use of an API that doesn't work on the side of the folder the file
 * sits in. `side` is where Rogen routes the file.
 */
export function sideErrors(file: string, side: Side, source: string): string[] {
	const patterns = side === "server" ? CLIENT_ONLY : side === "client" ? SERVER_ONLY : [...CLIENT_ONLY, ...SERVER_ONLY];
	const raw = source.split("\n");
	const errors: string[] = [];
	withoutComments(source)
		.split("\n")
		.forEach((line, index) => {
			if (/--\s*guarded:\s*\S/.test(raw[index] ?? "")) return;
			for (const { pattern, name, works } of patterns) {
				if (pattern.test(line)) errors.push(`${file}:${index + 1}: ${message(name, works, side)}`);
			}
		});
	return errors;
}
