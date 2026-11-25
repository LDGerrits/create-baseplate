## State

Client state lives in one Reflex store, `src/game/store/client/client-store.ts` (in a `client` folder, so it ships only to players), made of a slice per game system (`game/<system>/client/<system>-slice.ts`: the store is always on, so it never imports a feature, and state only one feature uses stays in that feature's controller). The game starts without it: write the first slice with `createProducer`, then create the store:

```ts
import { combineProducers, type InferState } from "@rbxts/reflex";
import { cartSlice } from "../../cart/client/cart-slice";

export const store = combineProducers({ cart: cartSlice });
export type RootState = InferState<typeof store>;
```

Controllers change the store through its actions; UI reads it with `useSelector` from `@rbxts/react-reflex`, inside a `ReflexProvider` (`<ReflexProvider producer={store}>`) around the root component. Give each new slice a spec and add it to `combineProducers`.
