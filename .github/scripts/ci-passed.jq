# The "CI passed" job (.github/workflows/ci.yml): which of the jobs it needs must have succeeded or
# been skipped. Input is the `needs` context; $event is the workflow's event. The engine job counts on
# pull requests only (where it runs for Renovate's updates, to gate them); on main, the nightly run and
# by hand it shows its own red without making every other pull request's required check red or stopping
# a release over a Roblox outage.
(if $event == "pull_request" then . else del(.engine) end)
| all(.[]; .result == "success" or .result == "skipped")
