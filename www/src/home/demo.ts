// Replays the recorded sessions (sessions.ts), one after another: the task typed in, the steps
// landing at their recorded times, sped up, then the UI the agent built on a Baseplate place.

import { RENDER, SESSIONS, type Session } from "./sessions.ts";

const TYPE_AT = 0.5;
const PER_CHAR = 0.034;
const SPEED = 26;
const GAP = 1.0;
const HOLD = 4.2;
const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const mmss = (seconds: number) => {
	const s = Math.round(seconds);
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** A session on the page's clock: when it starts, when each step and the picture land, when it ends. */
interface Timed {
	readonly session: Session;
	readonly typed: number;
	readonly steps: readonly number[];
	readonly look: number;
	readonly total: number;
	/** Page time and recorded time at each landing, for the running clock. */
	readonly keys: readonly (readonly [number, number])[];
}

const timed: Timed[] = SESSIONS.map((session) => {
	const typed = TYPE_AT + session.task.length * PER_CHAR + 0.6;
	const steps: number[] = [];
	let previous = typed;
	for (const step of session.steps) {
		previous = Math.max(typed + step.t / SPEED, previous + GAP);
		steps.push(previous);
	}
	const look = Math.max(typed + session.lookAt / SPEED, previous + 0.7);
	const keys: [number, number][] = [
		[typed, 0],
		...session.steps.map((step, i): [number, number] => [steps[i] ?? 0, step.t]),
		[look, session.lookAt],
	];
	return { session, typed, steps, look, total: look + HOLD, keys };
});

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const tabs = byId("tabs");
const left = byId("left");
const screen = byId("screen");
const ui = byId("ui");
const uiImage = ui.querySelector("img") as HTMLImageElement;
const tag = byId("tag");
const control = byId<HTMLButtonElement>("ctl");

for (const { session } of timed) {
	tabs.insertAdjacentHTML(
		"beforeend",
		`<button class="tab" role="tab" id="tab-${session.id}" aria-controls="sess-${session.id}" aria-selected="false" tabindex="-1"><span>${escapeHtml(session.id)}</span><span class="dur"><span class="vh">took </span>${mmss(session.duration)}</span><span class="bar" aria-hidden="true"><i></i></span></button>`,
	);
	const steps = session.steps
		.map(
			(step) =>
				`<li class="step ${step.kind ?? ""}"><span class="at">${mmss(step.t)}</span><span class="mk" aria-hidden="true"></span><span class="txt">${escapeHtml(step.text)}${step.note ? ` <span class="n">· ${escapeHtml(step.note)}</span>` : ""}${step.error ? `<span class="err"><span><code>${escapeHtml(step.error)}</code></span></span>` : ""}</span></li>`,
		)
		.join("");
	left.insertAdjacentHTML(
		"beforeend",
		`<div class="sess" id="sess-${session.id}" role="tabpanel" aria-labelledby="tab-${session.id}"><p class="task"><span class="vh">${escapeHtml(session.task)}</span><span class="ty" aria-hidden="true"></span><span class="caret" aria-hidden="true"></span><span class="rest" aria-hidden="true"></span></p><ol class="steps">${steps}</ol></div>`,
	);
}
const tabEls = [...tabs.children] as HTMLElement[];
const sessionEls = [...left.children] as HTMLElement[];
const barOf = (i: number) => tabEls[i]?.querySelector(".bar i") as HTMLElement;

// The UI goes where it sat in rur's picture, in a view of that picture scaled to the screen.
let shown = -1;
const layout = () => {
	const session = SESSIONS[shown];
	if (!session) return;
	const { x, y, w, h } = session.crop;
	const ratio = screen.clientWidth / screen.clientHeight;
	let viewW = Math.max(w * 1.22, RENDER.width * 0.78);
	let viewH = viewW / ratio;
	if (viewH < h * 1.28) {
		viewH = h * 1.28;
		viewW = viewH * ratio;
	}
	const scale = screen.clientWidth / viewW;
	const left = (x - (RENDER.width - viewW) / 2) * scale;
	const top = (y - (RENDER.height - viewH) / 2) * scale;
	Object.assign(ui.style, { left: `${left}px`, top: `${top}px`, width: `${w * scale}px`, height: `${h * scale}px` });
};
new ResizeObserver(layout).observe(screen);

const showUI = (i: number, on: boolean) => {
	const session = SESSIONS[i];
	if (on && session) {
		if (shown !== i) {
			shown = i;
			uiImage.src = session.picture;
			uiImage.alt = `${session.component}, the UI the ${session.id} session built, rendered from its story`;
			layout();
		}
		tag.textContent = `${session.component}, rendered headless`;
		ui.classList.remove("off");
		ui.classList.add("on");
		screen.classList.add("has");
	} else if (ui.classList.contains("on")) {
		ui.classList.remove("on");
		ui.classList.add("off");
		screen.classList.remove("has");
	}
};

let index = 0;
let position = 0;
let userPaused = false;
let seen = false;
let last = 0;

const clockAt = (t: Timed, p: number) => {
	if (p <= t.typed) return 0;
	for (let i = 1; i < t.keys.length; i++) {
		const [p0, t0] = t.keys[i - 1] ?? [0, 0];
		const [p1, t1] = t.keys[i] ?? [0, 0];
		if (p <= p1) return t0 + ((p - p0) / (p1 - p0)) * (t1 - t0);
	}
	return t.session.lookAt + (p - t.look) * SPEED;
};

const draw = (i: number, p: number) => {
	const t = timed[i];
	const el = sessionEls[i];
	if (!t || !el) return;
	const task = t.session.task;
	const typedChars = Math.max(0, Math.min(task.length, Math.floor((p - TYPE_AT) / PER_CHAR)));
	(el.querySelector(".ty") as HTMLElement).textContent = task.slice(0, typedChars);
	(el.querySelector(".rest") as HTMLElement).textContent = task.slice(typedChars);
	el.classList.toggle("typing", p > 0.15 && p < t.typed);
	// The next step's time runs as a clock until the step lands at its recorded time.
	const next = t.steps.findIndex((at) => p < at);
	el.querySelectorAll(".step").forEach((row, j) => {
		const at = t.steps[j] ?? 0;
		const recorded = t.session.steps[j]?.t ?? 0;
		row.classList.toggle("in", p >= at);
		row.classList.toggle("next", j === next && p >= t.typed);
		(row.querySelector(".at") as HTMLElement).textContent = mmss(
			j === next ? Math.min(clockAt(t, p), recorded) : recorded,
		);
	});
	if (i === index) showUI(i, p >= t.look);
	const bar = barOf(i);
	if (!bar.classList.contains("out")) bar.style.setProperty("--p", Math.min(1, p / t.total).toFixed(4));
};

// Applies a change without its transition.
const instant = (el: HTMLElement, change: () => void) => {
	el.classList.add("reset");
	change();
	void el.offsetWidth;
	el.classList.remove("reset");
};

const go = (i: number, p = 0, animate = !reduce) => {
	const previous = index;
	index = (i + timed.length) % timed.length;
	position = p;
	const el = sessionEls[index] as HTMLElement;
	instant(el, () => draw(index, position));
	tabEls.forEach((tab, j) => {
		tab.setAttribute("aria-selected", String(j === index));
		tab.tabIndex = j === index ? 0 : -1;
	});
	if (previous === index) {
		el.classList.add("on");
		return;
	}
	// A finished bar hands over by sliding out to the right; an interrupted one fades with its track.
	const bar = barOf(previous);
	const finished = Number.parseFloat(bar.style.getPropertyValue("--p") || "0") > 0.97;
	if (finished && animate) {
		bar.classList.add("out");
		setTimeout(() => {
			instant(bar, () => {
				bar.classList.remove("out");
				bar.style.setProperty("--p", "0");
			});
		}, 520);
	} else {
		setTimeout(() => instant(bar, () => bar.style.setProperty("--p", "0")), animate ? 420 : 0);
	}
	const old = sessionEls[previous] as HTMLElement;
	if (animate) {
		for (const a of old.getAnimations()) a.cancel();
		const out = old.animate(
			[
				{ opacity: 1, transform: "none" },
				{ opacity: 0, transform: "translateY(-6px)" },
			],
			{ duration: 240, easing: EASE, fill: "forwards" },
		);
		out.onfinish = () => {
			if (sessionEls[index] !== old) old.classList.remove("on");
			out.cancel();
		};
		el.classList.add("on");
		for (const a of el.getAnimations()) a.cancel();
		el.animate(
			[
				{ opacity: 0, transform: "translateY(8px)" },
				{ opacity: 1, transform: "none" },
			],
			{ duration: 440, delay: 170, easing: EASE, fill: "backwards" },
		);
	} else {
		old.classList.remove("on");
		el.classList.add("on");
	}
	const look = timed[index]?.look ?? 0;
	if (position < look) showUI(index, false);
	else if (animate) {
		showUI(previous, false);
		setTimeout(() => {
			if (position >= look) showUI(index, true);
		}, 300);
	} else instant(ui, () => showUI(index, true));
};

const tick = (now: number) => {
	const dt = Math.min(0.1, (now - last) / 1000);
	last = now;
	if (!userPaused && seen) {
		position += dt;
		if (position >= (timed[index]?.total ?? 0)) go(index + 1);
		else draw(index, position);
	}
	requestAnimationFrame(tick);
};

const setControl = () => {
	control.dataset.state = userPaused ? "paused" : "playing";
	(control.querySelector("span") as HTMLElement).textContent = userPaused ? "Play" : "Pause";
};

go(0, 0);
control.addEventListener("click", () => {
	userPaused = !userPaused;
	setControl();
});
const jump = (i: number) => go(i, userPaused ? (timed[(i + timed.length) % timed.length]?.look ?? 0) : 0);
tabs.addEventListener("click", (event) => {
	const tab = (event.target as Element).closest<HTMLElement>(".tab");
	if (tab) jump(tabEls.indexOf(tab));
});
tabs.addEventListener("keydown", (event) => {
	const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
	if (!step) return;
	event.preventDefault();
	const i = (index + step + timed.length) % timed.length;
	jump(i);
	tabEls[i]?.focus();
});
new IntersectionObserver(
	(entries) => {
		for (const entry of entries) seen = entry.isIntersecting;
	},
	{ threshold: 0.2 },
).observe(byId("win"));
requestAnimationFrame((now) => {
	last = now;
	requestAnimationFrame(tick);
});
