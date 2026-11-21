import { combineProducers, type InferState } from "@rbxts/reflex";
import { clickerSlice } from "../features/clicker/client/clicker-slice";

/** The client's Reflex store: one slice per feature. UI reads it with `useSelector`. */
export const store = combineProducers({
	clicker: clickerSlice,
});

export type RootState = InferState<typeof store>;
