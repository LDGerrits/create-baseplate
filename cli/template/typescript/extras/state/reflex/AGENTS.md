## State

Client state lives in one Reflex store, `src/store/client/client-store.ts` (in a `client` folder, so it ships only to players), made of a slice per feature (`clicker-slice.ts`). Controllers change it through the store's actions, as `ClickerController` calls `store.setClicks`; UI reads it with `useSelector` from `@rbxts/react-reflex`, inside the `ReflexProvider` in `app.tsx`. Give a new feature a slice and add it to `combineProducers` in the store.
