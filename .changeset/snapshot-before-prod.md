---
"create-baseplate": minor
---

The publish workflow snapshots the game's DataStores before it publishes to prod, so players' data as it stood stays restorable for 30 days if a release corrupts it. Prod's key needs `universe-datastores.control:snapshot` as well.
