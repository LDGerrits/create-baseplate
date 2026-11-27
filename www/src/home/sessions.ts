// Three recorded Claude Code sessions in new Luau games, each asked for one feature; the demo on
// the home page replays them. Each step is a moment in the recording (seconds from its start): the
// files written, the checks that failed and the one that passed, and when the agent opened the
// picture of its UI. Each task ended with "Make the UI look like a simulator game.", left out here.
// The pictures are rur's renders of the agents' own UI stories, cropped to the UI on a transparent
// background; `crop` is where that UI sat in rur's 1200x900 picture.

export interface Step {
	readonly t: number;
	readonly text: string;
	readonly kind?: "fail" | "pass";
	/** The check's duration, after a passing check. */
	readonly note?: string;
	/** The first line of what failed. */
	readonly error?: string;
}

export interface Session {
	readonly id: string;
	readonly task: string;
	readonly duration: number;
	readonly steps: readonly Step[];
	readonly component: string;
	/** When the agent opened the picture of its UI. */
	readonly lookAt: number;
	readonly picture: string;
	readonly crop: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
}

export const RENDER = { width: 1200, height: 900 };

export const SESSIONS: readonly Session[] = [
	{
		id: "shop",
		task: "Add a shop where players spend coins on a speed boost.",
		duration: 162,
		steps: [
			{ t: 100.3, text: "Wrote 17 files, tests included" },
			{ t: 104.3, kind: "pass", text: "Check passed", note: "3.6s" },
		],
		component: "ShopScreen",
		lookAt: 108.6,
		picture: "/home/shop.png",
		crop: { x: 22, y: 109, w: 904, h: 651 },
	},
	{
		id: "quests",
		task: "Add daily quests that reward coins.",
		duration: 306.3,
		steps: [
			{ t: 188.5, text: "Wrote 16 files" },
			{
				t: 193.4,
				kind: "fail",
				text: "Check failed twice",
				error: "TypeError: Unknown type used in * operation; consider adding a type annotation to 'value'",
			},
			{ t: 213.3, text: "Fixed" },
			{ t: 219.4, kind: "pass", text: "Check passed", note: "5.6s" },
		],
		component: "QuestWindow",
		lookAt: 231.9,
		picture: "/home/quests.png",
		crop: { x: 215, y: 107, w: 779, h: 671 },
	},
	{
		id: "daily-reward",
		task: "Add a daily login reward.",
		duration: 221.6,
		steps: [
			{ t: 145.7, text: "Wrote 18 files, tests included" },
			{
				t: 152.7,
				kind: "fail",
				text: "Check failed",
				error: "TypeError: Expected this to be 'nil', but got '() -> ()'",
			},
			{ t: 156.6, text: "Fixed" },
			{ t: 164.1, kind: "pass", text: "Check passed", note: "6.9s" },
		],
		component: "DailyRewardPanel",
		lookAt: 173.2,
		picture: "/home/daily-reward.png",
		crop: { x: 109, y: 40, w: 1009, h: 759 },
	},
];
