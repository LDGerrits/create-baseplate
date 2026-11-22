import { createProducer } from "@rbxts/reflex";

/** The clicker's part of the client's Reflex store (src/store/client/client-store.ts). */
export const clickerSlice = createProducer(
	{ clicks: 0 },
	{
		setClicks: (state, clicks: number) => ({ ...state, clicks }),
	},
);
