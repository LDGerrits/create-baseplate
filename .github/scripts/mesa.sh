#!/bin/sh
# Mesa's software Vulkan driver, which rur needs to render the stories on GitHub's Linux machines
# (they have no GPU). The install takes 6 to 39 seconds, more than anything else a job sets up, and
# nothing needs it before the first check, so `start` runs it in the background while the job sets up
# its tools and creates the first game, and `wait` (before that check) blocks until it is done.
# The runner's package lists are usually fresh enough; `apt-get update` takes most of an install, so
# it runs only when the install fails without it.
#   sh .github/scripts/mesa.sh start
#   sh .github/scripts/mesa.sh wait
set -u
dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
status="$dir/mesa.status"
pidfile="$dir/mesa.pid"
log="$dir/mesa.log"

install() {
	sudo apt-get install -y -q --no-install-recommends mesa-vulkan-drivers ||
		{ sudo apt-get update -q && sudo apt-get install -y -q --no-install-recommends mesa-vulkan-drivers; }
}

case "${1:-}" in
install)
	install
	;;
start)
	rm -f "$status"
	nohup sh -c 'sh "$0" install; echo $? > "$1.tmp" && mv "$1.tmp" "$1"' "$0" "$status" > "$log" 2>&1 &
	echo $! > "$pidfile"
	;;
wait)
	# A background install that vanished without a status (the runner stopped it) is done here.
	while [ ! -f "$status" ]; do
		if ! kill -0 "$(cat "$pidfile" 2>/dev/null)" 2>/dev/null; then
			[ -f "$status" ] && break
			echo "The background install of Mesa's Vulkan driver is gone; installing it now."
			install
			exit $?
		fi
		sleep 1
	done
	echo "::group::Mesa's Vulkan driver (installed in the background)"
	cat "$log"
	echo "::endgroup::"
	[ "$(cat "$status")" = 0 ] || { echo "::error::Installing Mesa's Vulkan driver failed"; exit 1; }
	;;
*)
	echo "usage: mesa.sh start|wait" >&2
	exit 2
	;;
esac
