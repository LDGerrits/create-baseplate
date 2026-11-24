## State

Client state lives in one Reflex store, `src/store/client/client-store.ts` (in a `client` folder, so it ships only to players), made of a slice per feature. The game starts without it: write the first feature's slice with `createProducer` in that feature's `client/` folder, then create the store:

```ts
import { combineProducers, type InferState } from "@rbxts/reflex";
import { cartSlice } from "../../features/shop/client/cart-slice";

export const store = combineProducers({ cart: cartSlice });
export type RootState = InferState<typeof store>;
```

Controllers change the store through its actions; UI reads it with `useSelector` from `@rbxts/react-reflex`, inside a `ReflexProvider` (`<ReflexProvider producer={store}>`) around the root component. Give each new feature's slice a spec and add it to `combineProducers`.
