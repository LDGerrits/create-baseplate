## Entities

Flamework Components (`@flamework/components`) attach behaviour to tagged instances: `SpinnerComponent` spins each part tagged `Spinner`. A component is a class with `@Component({ tag })`, extending `BaseComponent<Attributes, InstanceType>`; import it in `src/app/server/main.server.ts` (or the client's main), and clean up in `destroy()`. Tag parts in Studio; `tests/e2e/spinner.luau` makes its own tagged part and checks it turns.
