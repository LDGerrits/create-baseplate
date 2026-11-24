---
name: release
description: Prepare the game for a release or a publish, and tell the user how to ship it. Use when asked to release, publish, deploy, ship a version or tag.
---

# Prepare a release

You don't publish: a hook stops `mise run publish` and Studio's live tools, and publishing replaces the game players join. You make the commit ready, and the user ships it.

1. **Start from a clean base.** `git status` shows nothing you didn't mean to commit, and the branch has the latest main (`git fetch`, then merge it in).
2. **Run the full check:** `mise run check` (`mise run ci` is the same without writing fixes). If `mise tasks` lists `release` (the Darklua add-on), run it once before tagging: it builds from the code Darklua processed and runs the tests on it, and a rule that breaks the code fails there and not in the check.
3. **Look at what the world and the UI do.** The tests don't see a map that looks wrong. Render the world (`edit-world` skill) and the stories you changed, and play it in Studio when the change is about feel (`drive-studio` skill).
4. **Publishing is the user's.** Tell them which commit is ready, and how it goes out (`mise run doc publishing` has the details):
   - `dev`: merging to main publishes it when `.github/workflows/publish.yml` has the dev place set.
   - `stable`, if the game uses it: a tag, `git tag v1.2.0 && git push origin v1.2.0`, for testers.
   - `prod`: a tag (the same one, after stable), once a reviewer approves the `prod` environment.
5. **Say what changed for players**, in a few lines, for the tag or the release notes: what they will see and do differently, and anything that resets or migrates their data.

When asked to deploy and the keys aren't set up, point to `mise run doc publishing` and `.env.example`; don't ask for a key in the chat or put one in a file.
