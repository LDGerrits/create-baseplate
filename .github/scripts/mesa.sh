#!/bin/sh
# Mesa's software Vulkan driver, which rur needs to render the stories on GitHub's Linux machines
# (they have no GPU). The install takes 6 to 39 seconds, more than anything else a job sets up, and
# nothing needs it before the first check, so `start` runs it in the background while the job sets up
# its tools and creates the first game, and `wait` (before that check) blocks until it is done.
# The runner's package lists are usually fresh enough; `apt-get update` takes most of an install, so
# it runs only when the install fails without it.
# The downloaded .deb files are kept in $MESA_DEBS (default: mesa-debs in the runner's temp folder),
# which the workflow caches by runner image version (`key` prints the cache key). With them present the
# install uses them and needs no download; when they're missing, or don't install, it's the plain
# install above, which then fills the folder for the next run.
#   sh .github/scripts/mesa.sh key >> "$GITHUB_OUTPUT"
#   sh .github/scripts/mesa.sh start
#   sh .github/scripts/mesa.sh wait
set -u
dir="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
status="$dir/mesa.status"
pidfile="$dir/mesa.pid"
log="$dir/mesa.log"
debs="${MESA_DEBS:-$dir/mesa-debs}"
package=mesa-vulkan-drivers
archives="${MESA_APT_ARCHIVES:-/var/cache/apt/archives}"

install_from_network() {
	sudo apt-get install -y -q --no-install-recommends "$package" ||
		{ sudo apt-get update -q && sudo apt-get install -y -q --no-install-recommends "$package"; }
}

# What the network install downloaded is in apt's archive: keep it for the cache.
keep_debs() {
	mkdir -p "$debs" &&
		sudo find "$archives" -maxdepth 1 -name '*.deb' -exec cp -t "$debs" {} + &&
		sudo chown -R "$(id -u):$(id -g)" "$debs"
	rmdir "$debs" 2>/dev/null
	return 0
}

install() {
	if ls "$debs"/*.deb > /dev/null 2>&1; then
		sudo apt-get install -y -q --no-install-recommends "$debs"/*.deb && return 0
		echo "The cached packages didn't install; installing from the network."
	fi
	install_from_network || return 1
	[ -n "$(ls "$debs" 2>/dev/null)" ] || keep_debs
	return 0
}

case "${1:-}" in
key)
	echo "key=$package-${ImageOS:-unknown}-${ImageVersion:-unknown}"
	;;
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
