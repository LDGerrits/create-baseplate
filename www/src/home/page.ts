const root = document.documentElement;

const store = {
	get(key: string): string | null {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	},
	set(key: string, value: string): void {
		try {
			localStorage.setItem(key, value);
		} catch {}
	},
};

const themeButton = document.getElementById("theme") as HTMLButtonElement;
const isDark = () =>
	root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
const labelTheme = () =>
	themeButton.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
labelTheme();
themeButton.addEventListener("click", () => {
	root.dataset.theme = isDark() ? "light" : "dark";
	store.set("starlight-theme", root.dataset.theme);
	labelTheme();
});

const render = () => {
	const shown = `${root.dataset.mode}-${root.dataset.lang}`;
	for (const el of document.querySelectorAll<HTMLElement>("[data-v]")) {
		const on = el.dataset.v === shown;
		el.classList.toggle("on", on);
		el.setAttribute("aria-hidden", String(!on));
	}
	for (const button of document.querySelectorAll<HTMLButtonElement>("[data-lang-set]")) {
		const on = button.dataset.langSet === root.dataset.lang;
		button.setAttribute("aria-checked", String(on));
		button.tabIndex = on ? 0 : -1;
	}
	for (const button of document.querySelectorAll(".mode")) {
		button.textContent = root.dataset.mode === "ask" ? "Or run the command yourself" : "Or give your agent a prompt";
	}
};
const setLanguage = (language: string) => {
	root.dataset.lang = language;
	store.set("baseplate-language", language);
	render();
};
document.addEventListener("click", (event) => {
	const target = event.target as Element;
	const language = target.closest<HTMLElement>("[data-lang-set]");
	if (language?.dataset.langSet) setLanguage(language.dataset.langSet);
	if (target.closest(".mode")) {
		root.dataset.mode = root.dataset.mode === "ask" ? "run" : "ask";
		render();
	}
});
document.addEventListener("keydown", (event) => {
	const radio = (event.target as Element).closest?.<HTMLElement>(".lang [role=radio]");
	if (!radio || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
	event.preventDefault();
	const other = [...(radio.parentElement?.children ?? [])].find((el) => el !== radio) as HTMLElement | undefined;
	if (!other?.dataset.langSet) return;
	setLanguage(other.dataset.langSet);
	other.focus();
});
render();

for (const button of document.querySelectorAll<HTMLButtonElement>(".copy")) {
	const tip = button.querySelector(".tip") as HTMLElement;
	let timer: ReturnType<typeof setTimeout> | undefined;
	button.addEventListener("click", async () => {
		const value = button.parentElement?.querySelector(".val.on");
		if (!value) return;
		try {
			await navigator.clipboard.writeText((value.textContent ?? "").replace(/\s+/g, " ").trim());
			tip.textContent = "Copied";
		} catch {
			tip.textContent = "Selected, press Ctrl+C";
			getSelection()?.selectAllChildren(value);
		}
		button.dataset.done = "";
		clearTimeout(timer);
		timer = setTimeout(() => {
			tip.textContent = "Copy";
			delete button.dataset.done;
		}, 1600);
	});
}

// A module, so its names stay its own.
export {};
