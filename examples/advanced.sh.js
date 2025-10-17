#!/usr/bin/env -S deno run --allow-all
import fs from "node:fs"
import * as dax from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts" // see: https://github.com/dsherret/dax
import * as path from "https://esm.sh/jsr/@std/path@1.1.2"
import { env, aliases, $stdout, $stderr, initHelpers, iterateOver } from "https://esm.sh/gh/jeff-hykin/bash2deno@0.1.0.0/helpers.js"
let { $, appendTo, overwrite, hasCommand, makeScope, settings, exitCodeOfLastChildProcess } = initHelpers({ dax })


// general dependencies:
//    bash (to run this script)
//    util-linux (for getopt)
//    procps or procps-ng
//    hostapd
//    iproute2
//    iw
//    iwconfig (you only need this if 'iw' can not recognize your adapter)
//    haveged (optional)

// dependencies for 'nat' or 'none' Internet sharing method
//    dnsmasq
//    iptables

env.VERSION = `0.4.9`
env.PROGNAME = path.basename(env["0"])

// make sure that all command outputs are in english
// so we can parse them correctly
env.LC_ALL = `C`

// all new files and directories must be readable only by root.
// in special cases we must use chmod to give any other permissions.
env.SCRIPT_UMASK = 0077
await $`umask ${env.SCRIPT_UMASK}`

// FIXME: you'll need to custom verify this function usage: usage
async function usage(...args) { const { local, env } = makeScope({ args })

    console.log(`Usage: ${env.PROGNAME} [options] <wifi-interface> [<interface-with-internet>] [<access-point-name> [<passphrase>]]`)
    console.log(``)
    console.log(`Options:`)
    console.log(`  -h, --help              Show this help`)
    console.log(`  --version               Print version number`)
    console.log(`  -c <channel>            Channel number (default: 1 or fallback to currently connected channel)`)
    console.log(`  -w <WPA version>        Use 1 for WPA, use 2 for WPA2, use 1+2 for both (default: 2)`)
    console.log(`  -n                      Disable Internet sharing (if you use this, don't pass`)
    console.log(`                          the <interface-with-internet> argument)`)
    console.log(`  -m <method>             Method for Internet sharing.`)
    console.log(`                          Use: 'nat' for NAT (default)`)
    console.log(`                               'bridge' for bridging`)
    console.log(`                               'none' for no Internet sharing (equivalent to -n)`)
    console.log(`  --psk                   Use 64 hex digits pre-shared-key instead of passphrase`)
    console.log(`  --hidden                Make the Access Point hidden (do not broadcast the SSID)`)
    console.log(`  --mac-filter            Enable MAC address filtering`)
    console.log(`  --mac-filter-accept     Location of MAC address filter list (defaults to /etc/hostapd/hostapd.accept)`)
    console.log(`  --redirect-to-localhost If -n is set, redirect every web request to localhost (useful for public information networks)`)
    console.log(`  --hostapd-debug <level> With level between 1 and 2, passes arguments -d or -dd to hostapd for debugging.`)
    console.log(`  --hostapd-timestamps    Include timestamps in hostapd debug messages.`)
    console.log(`  --isolate-clients       Disable communication between clients`)
    console.log(`  --ieee80211n            Enable IEEE 802.11n (HT)`)
    console.log(`  --ieee80211ac           Enable IEEE 802.11ac (VHT)`)
    console.log(`  --ieee80211ax           Enable IEEE 802.11ax (VHT)`)
    console.log(`  --ht_capab <HT>         HT capabilities (default: [HT40+])`)
    console.log(`  --vht_capab <VHT>       VHT capabilities`)
    console.log(`  --country <code>        Set two-letter country code for regularity (example: US)`)
    console.log(`  --freq-band <GHz>       Set frequency band. Valid inputs: 2.4, 5 (default: Use 5GHz if the interface supports it)`)
    console.log(`  --driver                Choose your WiFi adapter driver (default: nl80211)`)
    console.log(`  --no-virt               Do not create virtual interface`)
    console.log(`  --no-haveged            Do not run 'haveged' automatically when needed`)
    console.log(`  --fix-unmanaged         If NetworkManager shows your interface as unmanaged after you`)
    console.log(`                          close create_ap, then use this option to switch your interface`)
    console.log(`                          back to managed`)
    console.log(`  --mac <MAC>             Set MAC address`)
    console.log(`  --dhcp-dns <IP1[,IP2]>  Set DNS returned by DHCP`)
    console.log(`  --dhcp-hosts <H1[,H2]>  Add list of dnsmasq.conf 'dhcp-host=' values`)
    console.log(`                          If ETC_HOSTS=1, it will use the ip addresses for the named hosts in that /etc/hosts.`)
    console.log(`                          Othwise, the following syntax would work --dhcp-hosts "host1,192.168.12.2 host2,192.168.12.3"`)
    console.log(`                          See https://github.com/imp/dnsmasq/blob/770bce967cfc9967273d0acfb3ea018fb7b17522/dnsmasq.conf.example#L238`)
    console.log(`                          for other valid dnsmasq dhcp-host parameters.`)
    console.log(`  --daemon                Run create_ap in the background`)
    console.log(`  --pidfile <pidfile>     Save daemon PID to file`)
    console.log(`  --logfile <logfile>     Save daemon messages to file`)
    console.log(`  --dns-logfile <logfile> Log DNS queries to file`)
    console.log(`  --stop <id>             Send stop command to an already running create_ap. For an <id>`)
    console.log(`                          you can put the PID of create_ap or the WiFi interface. You can`)
    console.log(`                          get them with --list-running`)
    console.log(`  --list-running          Show the create_ap processes that are already running`)
    console.log(`  --list-clients <id>     List the clients connected to create_ap instance associated with <id>.`)
    console.log(`                          For an <id> you can put the PID of create_ap or the WiFi interface.`)
    console.log(`                          If virtual WiFi interface was created, then use that one.`)
    console.log(`                          You can get them with --list-running`)
    console.log(`  --mkconfig <conf_file>  Store configs in conf_file`)
    console.log(`  --config <conf_file>    Load configs from conf_file`)
    console.log(``)
    console.log(`Non-Bridging Options:`)
    console.log(`  --no-dns                Disable dnsmasq DNS server`)
    console.log(`  --no-dnsmasq            Disable dnsmasq server completely`)
    console.log(`  -g <gateway>            IPv4 Gateway for the Access Point (default: 192.168.12.1)`)
    console.log(`  -d                      DNS server will take into account /etc/hosts`)
    console.log(`  -e <hosts_file>         DNS server will take into account additional hosts file`)
    console.log(``)
    console.log(`Useful informations:`)
    console.log(`  * If you're not using the --no-virt option, then you can create an AP with the same`)
    console.log(`    interface you are getting your Internet connection.`)
    console.log(`  * You can pass your SSID and password through pipe or through arguments (see examples).`)
    console.log(`  * On bridge method if the <interface-with-internet> is not a bridge interface, then`)
    console.log(`    a bridge interface is created automatically.`)
    console.log(``)
    console.log(`Examples:`)
    console.log(``)
    console.log(`  echo -e 'MyAccessPoint\nMyPassPhrase' | ${env.PROGNAME} wlan0 eth0`)
    console.log(``)
    console.log(`  echo 'MyAccessPoint' | ${env.PROGNAME} wlan0 eth0`)
    console.log(``)
    console.log(``)
    console.log(``)
    console.log(``)
    console.log(``)
    console.log(``)
    console.log(``)

}

// Busybox polyfills
// cp --help 2>&1 | grep -q -- --no-clobber
if (/* FIXME: cp --help 2>&1 | grep -q -- --no-clobber */0) {
    // FIXME: you'll need to custom verify this function usage: cp_n
    async function cp_n(...args) { const { local, env } = makeScope({ args })

        await $`cp -n ${env["@"]}`
    
    }
} else {
    // FIXME: you'll need to custom verify this function usage: cp_n
    async function cp_n(...args) { const { local, env } = makeScope({ args })

        await $`yes n | cp -i ${env["@"]}`
    
    }
}

// on success it echos a non-zero unused FD
// on error it echos 0
// FIXME: you'll need to custom verify this function usage: get_avail_fd
async function get_avail_fd(...args) { const { local, env } = makeScope({ args })

    local.x = ""
    // for x in $(seq 1 $(ulimit -n)); 
    for (env.x of iterateOver(await $.str`seq 1 `)) {

        // [[ ! -a "/proc/$BASHPID/fd/$x" ]]
        if ([object Object]) {
            console.log(`${env.x}`)
            return exitCodeOfLastChildProcess = ``
        }
    
    }
    console.log(`0`)

}

// lock file for the mutex counter
env.COUNTER_LOCK_FILE = `/tmp/create_ap.${env.$}.lock`

// FIXME: you'll need to custom verify this function usage: cleanup_lock
async function cleanup_lock(...args) { const { local, env } = makeScope({ args })

    await $`rm -f ${env.COUNTER_LOCK_FILE}`

}

// FIXME: you'll need to custom verify this function usage: init_lock
async function init_lock(...args) { const { local, env } = makeScope({ args })

    local.LOCK_FILE = `/tmp/create_ap.all.lock`

    // we initialize only once
    // [[ $LOCK_FD -ne 0 ]]
    if (env.LOCK_FD != 0) {
        return exitCodeOfLastChildProcess = 0
    }

    env.LOCK_FD = await $.str`get_avail_fd`
    // [[ $LOCK_FD -eq 0 ]]
    if (env.LOCK_FD == 0) {
        return exitCodeOfLastChildProcess = 1
    }

    // open/create lock file with write access for all users
    // otherwise normal users will not be able to use it.
    // to avoid race conditions on creation, we need to
    // use umask to set the permissions.
    await $`umask 0555`
    // !  eval "exec $LOCK_FD>$LOCK_FILE" > /dev/null 2>&1
    if ((await $`! eval exec ${env.LOCK_FD}>${env.LOCK_FILE}`.stdout(...$stdout)).code==0)) {
        return exitCodeOfLastChildProcess = 1
    }
    await $`umask ${env.SCRIPT_UMASK}`

    // there is a case where lock file was created from a normal
    // user. change the owner to root as soon as we can.
    await $`[[ $(id -u) -eq 0 ]] && chown 0:0 ${env.LOCK_FILE}`

    // create mutex counter lock file
    await $`echo 0 > $COUNTER_LOCK_FILE`

    return exitCodeOfLastChildProcess

}

// recursive mutex lock for all create_ap processes
// FIXME: you'll need to custom verify this function usage: mutex_lock
async function mutex_lock(...args) { const { local, env } = makeScope({ args })

    local.counter_mutex_fd = ""
    local.counter = ""

    // lock local mutex and read counter
    env.counter_mutex_fd = await $.str`get_avail_fd`
    // [[ $counter_mutex_fd -ne 0 ]]
    if (env.counter_mutex_fd != 0) {
        await $`eval exec ${env.counter_mutex_fd}<>${env.COUNTER_LOCK_FILE}`
        await $`flock ${env.counter_mutex_fd}`
        env.counter = prompt() /* FIXME: this was a read from ${env.counter_mutex_fd}, (e.g. ["-u","${env.counter_mutex_fd}","counter"]) but I'm only able to translate reading from stdin */
    } else {
        await $`echo Failed to lock mutex counter >&2`
        return exitCodeOfLastChildProcess = 1
    }

    // lock global mutex and increase counter
    await $`[[ $counter -eq 0 ]] && flock ${env.LOCK_FD}`
    env.counter =  env.counter + 1 

    // write counter and unlock local mutex
    await $`echo ${env.counter} > /proc/$BASHPID/fd/$counter_mutex_fd`
    await $`eval exec $counter_mutex_fd<&-`
    return exitCodeOfLastChildProcess = 0

}

// recursive mutex unlock for all create_ap processes
// FIXME: you'll need to custom verify this function usage: mutex_unlock
async function mutex_unlock(...args) { const { local, env } = makeScope({ args })

    local.counter_mutex_fd = ""
    local.counter = ""

    // lock local mutex and read counter
    env.counter_mutex_fd = await $.str`get_avail_fd`
    // [[ $counter_mutex_fd -ne 0 ]]
    if (env.counter_mutex_fd != 0) {
        await $`eval exec ${env.counter_mutex_fd}<>${env.COUNTER_LOCK_FILE}`
        await $`flock ${env.counter_mutex_fd}`
        env.counter = prompt() /* FIXME: this was a read from ${env.counter_mutex_fd}, (e.g. ["-u","${env.counter_mutex_fd}","counter"]) but I'm only able to translate reading from stdin */
    } else {
        await $`echo Failed to lock mutex counter >&2`
        return exitCodeOfLastChildProcess = 1
    }

    // decrease counter and unlock global mutex
    // [[ $counter -gt 0 ]]
    if (env.counter > 0) {
        env.counter =  env.counter - 1 
        await $`[[ $counter -eq 0 ]] && flock -u ${env.LOCK_FD}`
    }

    // write counter and unlock local mutex
    await $`echo ${env.counter} > /proc/$BASHPID/fd/$counter_mutex_fd`
    await $`eval exec $counter_mutex_fd<&-`
    return exitCodeOfLastChildProcess = 0

}

// it takes 2 arguments
// returns:
//  0 if v1 (1st argument) and v2 (2nd argument) are the same
//  1 if v1 is less than v2
//  2 if v1 is greater than v2
// FIXME: you'll need to custom verify this function usage: version_cmp
async function version_cmp(...args) { const { local, env } = makeScope({ args })

    local.V1 = "";local.V2 = "";local.VN = "";local.x = ""
    await $`[[ ! $1 =~ ^[0-9]+(\\.[0-9]+)*$ ]] && die Wrong version format!`
    await $`[[ ! $2 =~ ^[0-9]+(\\.[0-9]+)*$ ]] && die Wrong version format!`

    env.V1 = [await $.str`echo ${env["1"]} | tr .  `]
    env.V2 = [await $.str`echo ${env["2"]} | tr .  `]
    env.VN = env.V1.length
    /* FIXME: [[ $VN -lt ${#V2[@]} ]] && VN=${#V2[@]} */0

    for (env.x = 0; env.x < env.VN; env.x++) {

        // [[ ${V1[x]} -lt ${V2[x]} ]]
        if (0 < 0) {
            return exitCodeOfLastChildProcess = 1
        }
        // [[ ${V1[x]} -gt ${V2[x]} ]]
        if (0 > 0) {
            return exitCodeOfLastChildProcess = 2
        }
    
    }

    return exitCodeOfLastChildProcess = 0

}

env.USE_IWCONFIG = 0

// FIXME: you'll need to custom verify this function usage: is_interface
async function is_interface(...args) { const { local, env } = makeScope({ args })

    // [[ -z "$1" ]]
    if (env["1"].length == 0) {
        return exitCodeOfLastChildProcess = 1
    }
    await $`[[ -d "/sys/class/net/\${1}" ]]`

}

// FIXME: you'll need to custom verify this function usage: is_wifi_interface
async function is_wifi_interface(...args) { const { local, env } = makeScope({ args })

    // which iw > /dev/null 2>&1 && iw dev $1 info > /dev/null 2>&1
    if (/* FIXME: which iw > /dev/null 2>&1 && iw dev $1 info > /dev/null 2>&1 */0) {
        return exitCodeOfLastChildProcess = 0
    }
    // which iwconfig > /dev/null 2>&1 && iwconfig $1 > /dev/null 2>&1
    if (/* FIXME: which iwconfig > /dev/null 2>&1 && iwconfig $1 > /dev/null 2>&1 */0) {
        env.USE_IWCONFIG = 1
        return exitCodeOfLastChildProcess = 0
    }
    return exitCodeOfLastChildProcess = 1

}

// FIXME: you'll need to custom verify this function usage: is_bridge_interface
async function is_bridge_interface(...args) { const { local, env } = makeScope({ args })

    // [[ -z "$1" ]]
    if (env["1"].length == 0) {
        return exitCodeOfLastChildProcess = 1
    }
    await $`[[ -d "/sys/class/net/\${1}/bridge" ]]`

}

// FIXME: you'll need to custom verify this function usage: get_phy_device
async function get_phy_device(...args) { const { local, env } = makeScope({ args })

    local.x = ""
    // for x in /sys/class/ieee80211/*; 
    for (env.x of iterateOver(`/sys/class/ieee80211/*`)) {

        // [[ ! -e "$x" ]]
        if (fs.existsSync(`${env.x}`)) {
            continue
        }
        // [[ "${x##*/}" = "$1" ]]
        if (0 === env["1"]) {
            console.log(`${env["1"]}`)
            return exitCodeOfLastChildProcess = 0
        // [[ -e "$x/device/net/$1" ]]
        } else if (fs.existsSync(`${env.x}/device/net/${env["1"]}`)) {
            console.log(``)
            return exitCodeOfLastChildProcess = 0
        // [[ -e "$x/device/net:$1" ]]
        } else if (fs.existsSync(`${env.x}/device/net:${env["1"]}`)) {
            console.log(``)
            return exitCodeOfLastChildProcess = 0
        }
    
    }
    await $`echo Failed to get phy interface >&2`
    return exitCodeOfLastChildProcess = 1

}

// FIXME: you'll need to custom verify this function usage: get_adapter_info
async function get_adapter_info(...args) { const { local, env } = makeScope({ args })

    local.PHY = ""
    env.PHY = await $.str`get_phy_device ${env["1"]}`
    // [[ $? -ne 0 ]]
    if (env["?"] != 0) {
        return exitCodeOfLastChildProcess = 1
    }
    await $`iw phy ${env.PHY} info`

}

// FIXME: you'll need to custom verify this function usage: get_adapter_kernel_module
async function get_adapter_kernel_module(...args) { const { local, env } = makeScope({ args })

    local.MODULE = ""
    env.MODULE = await $.str`readlink -f /sys/class/net/${env["1"]}/device/driver/module`
    console.log(``)

}

// FIXME: you'll need to custom verify this function usage: can_be_sta_and_ap
async function can_be_sta_and_ap(...args) { const { local, env } = makeScope({ args })

    // iwconfig does not provide this information, assume false
    // [[ $USE_IWCONFIG -eq 1 ]]
    if (env.USE_IWCONFIG == 1) {
        return exitCodeOfLastChildProcess = 1
    }
    // [[ "$(get_adapter_kernel_module "$1")" == "brcmfmac" ]]
    if (0 === `brcmfmac`) {
        await $`echo WARN: brmfmac driver doesn't work properly with virtual interfaces and >&2`
        await $`echo       it can cause kernel panic. For this reason we disallow virtual >&2`
        await $`echo       interfaces for your adapter. >&2`
        await $`echo       For more info: https://github.com/oblique/create_ap/issues/203 >&2`
        return exitCodeOfLastChildProcess = 1
    }
    // get_adapter_info "$1" | grep -E '{.* managed.* AP.*}' > /dev/null 2>&1
    if ((await $`get_adapter_info ${env["1"]} | grep -E {.* managed.* AP.*}`.stdout(...$stdout)).code==0)) {
        return exitCodeOfLastChildProcess = 0
    }
    // get_adapter_info "$1" | grep -E '{.* AP.* managed.*}' > /dev/null 2>&1
    if ((await $`get_adapter_info ${env["1"]} | grep -E {.* AP.* managed.*}`.stdout(...$stdout)).code==0)) {
        return exitCodeOfLastChildProcess = 0
    }
    return exitCodeOfLastChildProcess = 1

}

// FIXME: you'll need to custom verify this function usage: can_be_ap
async function can_be_ap(...args) { const { local, env } = makeScope({ args })

    // iwconfig does not provide this information, assume true
    // [[ $USE_IWCONFIG -eq 1 ]]
    if (env.USE_IWCONFIG == 1) {
        return exitCodeOfLastChildProcess = 0
    }
    // get_adapter_info "$1" | grep -E '\* AP$' > /dev/null 2>&1
    if ((await $`get_adapter_info ${env["1"]} | grep -E \\* AP$`.stdout(...$stdout)).code==0)) {
        return exitCodeOfLastChildProcess = 0
    }
    return exitCodeOfLastChildProcess = 1

}

// FIXME: you'll need to custom verify this function usage: can_transmit_to_channel
async function can_transmit_to_channel(...args) { const { local, env } = makeScope({ args })

    local.IFACE = "";local.CHANNEL_NUM = "";local.CHANNEL_INFO = ""
    env.IFACE = env["1"]
    env.CHANNEL_NUM = env["2"]

    // [[ $USE_IWCONFIG -eq 0 ]]
    if (env.USE_IWCONFIG == 0) {
        // [[ $FREQ_BAND == 2.4 ]]
        if (env.FREQ_BAND === 2.4) {
            env.CHANNEL_INFO = await $.str`get_adapter_info  | grep  24[0-9][0-9]\\(\\.0\\+\\)\\? MHz \\[$CHANNEL_NUM\\]`
        } else {
            env.CHANNEL_INFO = await $.str`get_adapter_info  | grep  \\(49[0-9][0-9]\\|5[0-9]\\{3\\}\\)\\(\\.0\\+\\)\\? MHz \\[$CHANNEL_NUM\\]`
        }
        // [[ -z "${CHANNEL_INFO}" ]]
        if (``.length == 0) {
            return exitCodeOfLastChildProcess = 1
        }
        // [[ "${CHANNEL_INFO}" == *no\ IR* ]]
        if (0 === `*no\\ IR*`) {
            return exitCodeOfLastChildProcess = 1
        }
        // [[ "${CHANNEL_INFO}" == *disabled* ]]
        if (0 === `*disabled*`) {
            return exitCodeOfLastChildProcess = 1
        }
        return exitCodeOfLastChildProcess = 0
    } else {
        env.CHANNEL_NUM = await $.str`printf %02d `
        env.CHANNEL_INFO = await $.str`iwlist  channel | grep -E Channel[[:blank:]]$CHANNEL_NUM[[:blank:]]?:`
        // [[ -z "${CHANNEL_INFO}" ]]
        if (``.length == 0) {
            return exitCodeOfLastChildProcess = 1
        }
        return exitCodeOfLastChildProcess = 0
    }

}

// taken from iw/util.c
// FIXME: you'll need to custom verify this function usage: ieee80211_frequency_to_channel
async function ieee80211_frequency_to_channel(...args) { const { local, env } = makeScope({ args })

    local.FREQ_MAYBE_FRACTIONAL = env["1"]
    local.FREQ = env.FREQ_MAYBE_FRACTIONAL/* FIXME: FREQ_MAYBE_FRACTIONAL%.* */

    // [[ $FREQ -lt 1000 ]]
    if (env.FREQ < 1000) {
        console.log(`0`)
    // [[ $FREQ -eq 2484 ]]
    } else if (env.FREQ == 2484) {
        console.log(`14`)
    // [[ $FREQ -eq 5935 ]]
    } else if (env.FREQ == 5935) {
        console.log(`2`)
    // [[ $FREQ -lt 2484 ]]
    } else if (env.FREQ < 2484) {
        console.log(`${ (env.FREQ - 2407) / 5 }`)
    // [[ $FREQ -ge 4910 && $FREQ -le 4980 ]]
    } else if (env.FREQ >= 4910) {
        console.log(`${ (env.FREQ - 4000) / 5 }`)
    // [[ $FREQ -lt 5950 ]]
    } else if (env.FREQ < 5950) {
        console.log(`${ (env.FREQ - 5000) / 5 }`)
    // [[ $FREQ -le 45000 ]]
    } else if (env.FREQ <= 45000) {
        console.log(`${ (env.FREQ - 5950) / 5 }`)
    // [[ $FREQ -ge 58320 && $FREQ -le 70200 ]]
    } else if (env.FREQ >= 58320) {
        console.log(`${ (env.FREQ - 56160) / 2160 }`)
    } else {
        console.log(`0`)
    }

}

// FIXME: you'll need to custom verify this function usage: is_5ghz_frequency
async function is_5ghz_frequency(...args) { const { local, env } = makeScope({ args })

    await $`[[ $1 =~ ^(49[0-9]{2})|(5[0-9]{3})(\\.0+)?$ ]]`

}

// FIXME: you'll need to custom verify this function usage: is_wifi_connected
async function is_wifi_connected(...args) { const { local, env } = makeScope({ args })

    // [[ $USE_IWCONFIG -eq 0 ]]
    if (env.USE_IWCONFIG == 0) {
        // iw dev "$1" link 2>&1 | grep -E '^Connected to' > /dev/null 2>&1
        if (/* FIXME: iw dev "$1" link 2>&1 | grep -E '^Connected to' > /dev/null 2>&1 */0) {
            return exitCodeOfLastChildProcess = 0
        }
    } else {
        // iwconfig "$1" 2>&1 | grep -E 'Access Point: [0-9a-fA-F]{2}:' > /dev/null 2>&1
        if (/* FIXME: iwconfig "$1" 2>&1 | grep -E 'Access Point: [0-9a-fA-F]{2}:' > /dev/null 2>&1 */0) {
            return exitCodeOfLastChildProcess = 0
        }
    }
    return exitCodeOfLastChildProcess = 1

}

// FIXME: you'll need to custom verify this function usage: is_macaddr
async function is_macaddr(...args) { const { local, env } = makeScope({ args })

    await $`echo ${env["1"]} | grep -E ^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}\$`.stdout(...$stdout)

}

// FIXME: you'll need to custom verify this function usage: is_unicast_macaddr
async function is_unicast_macaddr(...args) { const { local, env } = makeScope({ args })

    local.x = ""
    // !  is_macaddr "$1"
    if ((await is_macaddr(env["1"])) != 0) {
        return exitCodeOfLastChildProcess = 1
    }
    env.x = await $.str`echo ${env["1"]} | cut -d: -f1`
    env.x = await $.str`printf %d 0x$x`
    await $`[[ $(expr $x % 2) -eq 0 ]]`

}

// FIXME: you'll need to custom verify this function usage: get_macaddr
async function get_macaddr(...args) { const { local, env } = makeScope({ args })

    // !  is_interface "$1"
    if ((await is_interface(env["1"])) != 0) {
        return exitCodeOfLastChildProcess = ``
    }
    await $`cat /sys/class/net/$1/address`

}

// FIXME: you'll need to custom verify this function usage: get_mtu
async function get_mtu(...args) { const { local, env } = makeScope({ args })

    // !  is_interface "$1"
    if ((await is_interface(env["1"])) != 0) {
        return exitCodeOfLastChildProcess = ``
    }
    await $`cat /sys/class/net/$1/mtu`

}

// FIXME: you'll need to custom verify this function usage: alloc_new_iface
async function alloc_new_iface(...args) { const { local, env } = makeScope({ args })

    local.prefix = env["1"]
    local.i = 0

    await mutex_lock()
    while (true) {

        // ! is_interface $prefix$i && [[ ! -f $COMMON_CONFDIR/ifaces/$prefix$i ]]
        if ((await $`! is_interface ${env.prefix}${env.i} && [[ ! -f $COMMON_CONFDIR/ifaces/$prefix$i ]]`).code==0)) {
            await $`mkdir -p ${env.COMMON_CONFDIR}/ifaces`
            await $`touch ${env.COMMON_CONFDIR}/ifaces/${env.prefix}${env.i}`
            console.log(`${env.prefix}${env.i}`)
            await mutex_unlock()
            return exitCodeOfLastChildProcess = ``
        }
        env.i = env.i + 1
    
    }
    await mutex_unlock()

}

// FIXME: you'll need to custom verify this function usage: dealloc_iface
async function dealloc_iface(...args) { const { local, env } = makeScope({ args })

    await $`rm -f ${env.COMMON_CONFDIR}/ifaces/\$1`

}

// FIXME: you'll need to custom verify this function usage: get_all_macaddrs
async function get_all_macaddrs(...args) { const { local, env } = makeScope({ args })

    await $`cat /sys/class/net/*/address`

}

// FIXME: you'll need to custom verify this function usage: get_new_macaddr
async function get_new_macaddr(...args) { const { local, env } = makeScope({ args })

    local.OLDMAC = "";local.NEWMAC = "";local.LAST_BYTE = "";local.i = ""
    env.OLDMAC = await $.str`get_macaddr ${env["1"]}`
    env.LAST_BYTE = await $.str`printf %d 0x$OLDMAC`
    await mutex_lock()
    for (env.i = 1; env.i <= 255; env.i++) {

        env.NEWMAC = `$OLDMAC:${await $.str`printf %02x ${ (env.LAST_BYTE + env.i) % 256 }`}`
        // !  (get_all_macaddrs | grep "$NEWMAC" > /dev/null 2>&1)
        if ((await get_all_macaddrs()) != 0) {
            break
        }
    
    }
    await mutex_unlock()
    console.log(`${env.NEWMAC}`)

}

// start haveged when needed
// FIXME: you'll need to custom verify this function usage: haveged_watchdog
async function haveged_watchdog(...args) { const { local, env } = makeScope({ args })

    local.show_warn = 1
    while (true) {

        // [[ $(cat /proc/sys/kernel/random/entropy_avail) -lt 1000 ]]
        if (0 < 1000) {
            // ! which haveged > /dev/null 2>&1
            if ((await $`! which haveged`.stdout(...$stdout)).code==0)) {
                // [[ $show_warn -eq 1 ]]
                if (env.show_warn == 1) {
                    console.log(`WARN: Low entropy detected. We recommend you to install \`haveged'`)
                    env.show_warn = 0
                }
            // ! pidof haveged > /dev/null 2>&1
            } else if ((await $`! pidof haveged`.stdout(...$stdout)).code==0)) {
                console.log(`Low entropy detected, starting haveged`)
                // boost low-entropy
                await mutex_lock()
                await $`haveged -w 1024 -p ${env.COMMON_CONFDIR}/haveged.pid`
                await mutex_unlock()
            }
        }
        await $`sleep 2`
    
    }

}

env.NETWORKMANAGER_CONF = `/etc/NetworkManager/NetworkManager.conf`
env.NM_OLDER_VERSION = 1

// FIXME: you'll need to custom verify this function usage: networkmanager_exists
async function networkmanager_exists(...args) { const { local, env } = makeScope({ args })

    local.NM_VER = ""
    // !  which nmcli > /dev/null 2>&1
    if ((await $`! which nmcli`.stdout(...$stdout)).code==0)) {
        return exitCodeOfLastChildProcess = 1
    }
    env.NM_VER = await $.str`nmcli -v | grep -m1 -oE [0-9]+(\\.[0-9]+)*\\.[0-9]+`
    await version_cmp(env.NM_VER, `0.9.9`, )
    // [[ $? -eq 1 ]]
    if (env["?"] == 1) {
        env.NM_OLDER_VERSION = 1
    } else {
        env.NM_OLDER_VERSION = 0
    }
    return exitCodeOfLastChildProcess = 0

}

// FIXME: you'll need to custom verify this function usage: networkmanager_is_running
async function networkmanager_is_running(...args) { const { local, env } = makeScope({ args })

    local.NMCLI_OUT = ""
    // !  networkmanager_exists
    if ((await networkmanager_exists()) != 0) {
        return exitCodeOfLastChildProcess = 1
    }
    // [[ $NM_OLDER_VERSION -eq 1 ]]
    if (env.NM_OLDER_VERSION == 1) {
        env.NMCLI_OUT = /* FIXME: nmcli -t -f RUNNING nm 2>&1 | grep -E '^running$' */0
    } else {
        env.NMCLI_OUT = /* FIXME: nmcli -t -f RUNNING g 2>&1 | grep -E '^running$' */0
    }
    await $`[[ -n "$NMCLI_OUT" ]]`

}

// FIXME: you'll need to custom verify this function usage: networkmanager_knows_iface
async function networkmanager_knows_iface(...args) { const { local, env } = makeScope({ args })

    // check if the interface $1 is known to NetworkManager
    // an interface may exist but may not be known to NetworkManager if it is in a different network namespace than NetworkManager
    /* FIXME: nmcli -t -f DEVICE d 2>&1 | grep -Fxq "$1" */0

}

// FIXME: you'll need to custom verify this function usage: networkmanager_iface_is_unmanaged
async function networkmanager_iface_is_unmanaged(...args) { const { local, env } = makeScope({ args })

    // !  is_interface "$1"
    if ((await is_interface(env["1"])) != 0) {
        return exitCodeOfLastChildProcess = 2
    }
    // !  networkmanager_knows_iface "$1"
    if ((await networkmanager_knows_iface(env["1"])) != 0) {
        return exitCodeOfLastChildProcess = 0
    }
    // !  (nmcli -t -f DEVICE,STATE d 2>&1 | grep -E "^$1:unmanaged$" > /dev/null 2>&1)
    if ((await $`nmcli -t -f DEVICE,STATE d`).code!=0)) {
        return exitCodeOfLastChildProcess = 1
    }

}

env.ADDED_UNMANAGED = ""

// FIXME: you'll need to custom verify this function usage: networkmanager_add_unmanaged
async function networkmanager_add_unmanaged(...args) { const { local, env } = makeScope({ args })

    local.MAC = "";local.UNMANAGED = "";local.WAS_EMPTY = "";local.x = ""
    // !  networkmanager_exists
    if ((await networkmanager_exists()) != 0) {
        return exitCodeOfLastChildProcess = 1
    }

    await $`[[ -d \${NETWORKMANAGER_CONF%/*} ]] || mkdir -p `
    await $`[[ -f \${NETWORKMANAGER_CONF} ]] || touch `

    // [[ $NM_OLDER_VERSION -eq 1 ]]
    if (env.NM_OLDER_VERSION == 1) {
        // [[ -z "$2" ]]
        if (env["2"].length == 0) {
            env.MAC = await $.str`get_macaddr ${env["1"]}`
        } else {
            env.MAC = env["2"]
        }
        // [[ -z "$MAC" ]]
        if (env.MAC.length == 0) {
            return exitCodeOfLastChildProcess = 1
        }
    }

    await mutex_lock()
    env.UNMANAGED = await $.str`grep -m1 -Eo ^unmanaged-devices=[[:alnum:]:;,?*~=-]* /etc/NetworkManager/NetworkManager.conf`

    env.WAS_EMPTY = 0
    /* FIXME: [[ -z "$UNMANAGED" ]] && WAS_EMPTY=1 */0
    env.UNMANAGED = await $.str`echo ${env.UNMANAGED} | sed s/unmanaged-devices=// | tr ;,  `

    // if it exists, do nothing
    // for x in $UNMANAGED; 
    for (env.x of iterateOver(env.UNMANAGED)) {

        // [[ $x == "mac:${MAC}" ]] ||
               [[ $NM_OLDER_VERSION -eq 0 && $x == "interface-name:${1}" ]]
        if ((await $`[[ $x == "mac:\${MAC}" ]] || [[ $NM_OLDER_VERSION -eq 0 && $x == "interface-name:\${1}" ]]`).code==0)) {
            await mutex_unlock()
            return exitCodeOfLastChildProcess = 2
        }
    
    }

    // [[ $NM_OLDER_VERSION -eq 1 ]]
    if (env.NM_OLDER_VERSION == 1) {
        env.UNMANAGED = `$UNMANAGED mac:$MAC`
    } else {
        env.UNMANAGED = `$UNMANAGED interface-name:$1`
    }

    env.UNMANAGED = await $.str`echo ${env.UNMANAGED} | sed -e s/^ //`
    env.UNMANAGED = env.UNMANAGED/* FIXME: UNMANAGED// /; */
    env.UNMANAGED = `unmanaged-devices=$UNMANAGED`

    // ! grep -E '^\[keyfile\]' ${NETWORKMANAGER_CONF} > /dev/null 2>&1
    if ((await $`! grep -E ^\\[keyfile\\] `.stdout(...$stdout)).code==0)) {
        await $`echo -e 

[keyfile]
$UNMANAGED >> ${NETWORKMANAGER_CONF}`
    // [[ $WAS_EMPTY -eq 1 ]]
    } else if (env.WAS_EMPTY == 1) {
        await $`sed -e s/^\\(\\[keyfile\\].*\\)\$/
$UNMANAGED/ -i `
    } else {
        await $`sed -e s/^unmanaged-devices=.*/$UNMANAGED/ -i `
    }

    env.ADDED_UNMANAGED = `$ADDED_UNMANAGED$1`
    await mutex_unlock()

    local.nm_pid = await $.str`pidof NetworkManager`
    await $`[[ -n "$nm_pid" ]] && kill -HUP ${env.nm_pid}`

    return exitCodeOfLastChildProcess = 0

}

// FIXME: you'll need to custom verify this function usage: networkmanager_rm_unmanaged
async function networkmanager_rm_unmanaged(...args) { const { local, env } = makeScope({ args })

    local.MAC = "";local.UNMANAGED = ""
    // !  networkmanager_exists
    if ((await networkmanager_exists()) != 0) {
        return exitCodeOfLastChildProcess = 1
    }
    // [[ ! -f ${NETWORKMANAGER_CONF} ]]
    if ([object Object]) {
        return exitCodeOfLastChildProcess = 1
    }

    // [[ $NM_OLDER_VERSION -eq 1 ]]
    if (env.NM_OLDER_VERSION == 1) {
        // [[ -z "$2" ]]
        if (env["2"].length == 0) {
            env.MAC = await $.str`get_macaddr ${env["1"]}`
        } else {
            env.MAC = env["2"]
        }
        // [[ -z "$MAC" ]]
        if (env.MAC.length == 0) {
            return exitCodeOfLastChildProcess = 1
        }
    }

    await mutex_lock()
    env.UNMANAGED = await $.str`grep -m1 -Eo ^unmanaged-devices=[[:alnum:]:;,?*~=-]* /etc/NetworkManager/NetworkManager.conf | sed s/unmanaged-devices=// | tr ;,  `

    // [[ -z "$UNMANAGED" ]]
    if (env.UNMANAGED.length == 0) {
        await mutex_unlock()
        return exitCodeOfLastChildProcess = 1
    }

    /* FIXME: [[ -n "$MAC" ]] && UNMANAGED=$(echo $UNMANAGED | sed -e "s/mac:${MAC}\( \|$\)//g") */0
    env.UNMANAGED = await $.str`echo ${env.UNMANAGED} | sed -e s/interface-name:$1\\( \\|\$\\)//g`
    env.UNMANAGED = await $.str`echo ${env.UNMANAGED} | sed -e s/ $//`

    // [[ -z "$UNMANAGED" ]]
    if (env.UNMANAGED.length == 0) {
        await $`sed -e /^unmanaged-devices=.*/d -i `
    } else {
        env.UNMANAGED = env.UNMANAGED/* FIXME: UNMANAGED// /; */
        env.UNMANAGED = `unmanaged-devices=$UNMANAGED`
        await $`sed -e s/^unmanaged-devices=.*/$UNMANAGED/ -i `
    }

    env.ADDED_UNMANAGED = env.ADDED_UNMANAGED/* FIXME: ADDED_UNMANAGED/ ${1} / */
    await mutex_unlock()

    local.nm_pid = await $.str`pidof NetworkManager`
    await $`[[ -n "$nm_pid" ]] && kill -HUP ${env.nm_pid}`

    return exitCodeOfLastChildProcess = 0

}

// FIXME: you'll need to custom verify this function usage: networkmanager_fix_unmanaged
async function networkmanager_fix_unmanaged(...args) { const { local, env } = makeScope({ args })

    // !  [[ -f ${NETWORKMANAGER_CONF} ]]
    if (![object Object]) {
        return exitCodeOfLastChildProcess = ``
    }

    await mutex_lock()
    await $`sed -e /^unmanaged-devices=.*/d -i `
    await mutex_unlock()

    local.nm_pid = await $.str`pidof NetworkManager`
    await $`[[ -n "$nm_pid" ]] && kill -HUP ${env.nm_pid}`

}

// FIXME: you'll need to custom verify this function usage: networkmanager_rm_unmanaged_if_needed
async function networkmanager_rm_unmanaged_if_needed(...args) { const { local, env } = makeScope({ args })

    await $`[[ $ADDED_UNMANAGED =~ .*\\ \${1}\\ .* ]] && networkmanager_rm_unmanaged ${env["1"]} ${env["2"]}`

}

// FIXME: you'll need to custom verify this function usage: networkmanager_wait_until_unmanaged
async function networkmanager_wait_until_unmanaged(...args) { const { local, env } = makeScope({ args })

    local.RES = ""
    // !  networkmanager_is_running
    if ((await networkmanager_is_running()) != 0) {
        return exitCodeOfLastChildProcess = 1
    }
    while (true) {

        await networkmanager_iface_is_unmanaged(env["1"])
        env.RES = env["?"]
        // [[ $RES -eq 0 ]]
        if (env.RES == 0) {
            break
        }
        await $`[[ $RES -eq 2 ]] && die `
        await $`sleep 1`
    
    }
    await $`sleep 2`
    return exitCodeOfLastChildProcess = 0

}


env.CHANNEL = `default`
env.GATEWAY = `192.168.12.1`
env.WPA_VERSION = 2
env.ETC_HOSTS = 0
env.ADDN_HOSTS = ""
env.DHCP_HOSTS = ""
env.DHCP_DNS = `gateway`
env.NO_DNS = 0
env.NO_DNSMASQ = 0
env.DNS_PORT = ""
env.HIDDEN = 0
env.MAC_FILTER = 0
env.MAC_FILTER_ACCEPT = `/etc/hostapd/hostapd.accept`
env.ISOLATE_CLIENTS = 0
env.SHARE_METHOD = `nat`
env.IEEE80211N = 0
env.IEEE80211AC = 0
env.IEEE80211AX = 0
env.HT_CAPAB = `[HT40+]`
env.VHT_CAPAB = ""
env.DRIVER = `nl80211`
env.NO_VIRT = 0
env.COUNTRY = ""
env.FREQ_BAND = `2.4`
env.NEW_MACADDR = ""
env.DAEMONIZE = 0
env.DAEMON_PIDFILE = ""
env.DAEMON_LOGFILE = `/dev/null`
env.DNS_LOGFILE = ""
env.NO_HAVEGED = 0
env.USE_PSK = 0

env.HOSTAPD_DEBUG_ARGS = ""
env.REDIRECT_TO_LOCALHOST = 0

env.CONFIG_OPTS = [`CHANNEL`, `GATEWAY`, `WPA_VERSION`, `ETC_HOSTS`, `DHCP_DNS`, `NO_DNS`, `NO_DNSMASQ`, `HIDDEN`, `MAC_FILTER`, `MAC_FILTER_ACCEPT`, `ISOLATE_CLIENTS`, `SHARE_METHOD`, `IEEE80211N`, `IEEE80211AC`, `IEEE80211AX`, `HT_CAPAB`, `VHT_CAPAB`, `DRIVER`, `NO_VIRT`, `COUNTRY`, `FREQ_BAND`, `NEW_MACADDR`, `DAEMONIZE`, `DAEMON_PIDFILE`, `DAEMON_LOGFILE`, `DNS_LOGFILE`, `NO_HAVEGED`, `WIFI_IFACE`, `INTERNET_IFACE`, `SSID`, `PASSPHRASE`, `USE_PSK`, `ADDN_HOSTS`, `DHCP_HOSTS`, ]

env.FIX_UNMANAGED = 0
env.LIST_RUNNING = 0
env.STOP_ID = ""
env.LIST_CLIENTS_ID = ""

env.STORE_CONFIG = ""
env.LOAD_CONFIG = ""

env.CONFDIR = ""
env.WIFI_IFACE = ""
env.VWIFI_IFACE = ""
env.INTERNET_IFACE = ""
env.BRIDGE_IFACE = ""
env.OLD_MACADDR = ""
env.IP_ADDRS = ""
env.ROUTE_ADDRS = ""

env.HAVEGED_WATCHDOG_PID = ""

// FIXME: you'll need to custom verify this function usage: _cleanup
async function _cleanup(...args) { const { local, env } = makeScope({ args })

    local.PID = "";local.x = ""

    await $`trap  SIGINT SIGUSR1 SIGUSR2 EXIT`
    await mutex_lock()
    await $`disown -a`

    // kill haveged_watchdog
    await $`[[ -n "$HAVEGED_WATCHDOG_PID" ]] && kill ${env.HAVEGED_WATCHDOG_PID}`

    // kill processes
    // for x in $CONFDIR/*.pid; 
    for (env.x of iterateOver(`${env.CONFDIR}/*.pid`)) {

        // even if the $CONFDIR is empty, the for loop will assign
        // a value in $x. so we need to check if the value is a file
        await $`[[ -f $x ]] && kill -9 `
    
    }

    await $`rm -rf ${env.CONFDIR}`

    local.found = 0
    // for x in $(list_running_conf); 
    for (env.x of iterateOver(await $.str`list_running_conf`)) {

        // [[ -f $x/nat_internet_iface && $(cat $x/nat_internet_iface) == $INTERNET_IFACE ]]
        if (`-f ${env.x}/nat_internet_iface` === env.INTERNET_IFACE) {
            env.found = 1
            break
        }
    
    }

    // [[ $found -eq 0 ]]
    if (env.found == 0) {
        await $`cp -f ${env.COMMON_CONFDIR}/$INTERNET_IFACE_forwarding /proc/sys/net/ipv4/conf/${env.INTERNET_IFACE}/forwarding`
        await $`rm -f ${env.COMMON_CONFDIR}/$INTERNET_IFACE_forwarding`
    }

    // if we are the last create_ap instance then set back the common values
    // ! has_running_instance
    if ((await $`has_running_instance`).code!=0)) {
        // kill common processes
        // for x in $COMMON_CONFDIR/*.pid; 
        for (env.x of iterateOver(`${env.COMMON_CONFDIR}/*.pid`)) {

            await $`[[ -f $x ]] && kill -9 `
        
        }

        // set old ip_forward
        // [[ -f $COMMON_CONFDIR/ip_forward ]]
        if ([object Object]) {
            await $`cp -f ${env.COMMON_CONFDIR}/ip_forward /proc/sys/net/ipv4`
            await $`rm -f ${env.COMMON_CONFDIR}/ip_forward`
        }

        // set old bridge-nf-call-iptables
        // [[ -f $COMMON_CONFDIR/bridge-nf-call-iptables ]]
        if ([object Object]) {
            // [[ -e /proc/sys/net/bridge/bridge-nf-call-iptables ]]
            if (fs.existsSync(`/proc/sys/net/bridge/bridge-nf-call-iptables`)) {
                await $`cp -f ${env.COMMON_CONFDIR}/bridge-nf-call-iptables /proc/sys/net/bridge`
            }
            await $`rm -f ${env.COMMON_CONFDIR}/bridge-nf-call-iptables`
        }

        await $`rm -rf ${env.COMMON_CONFDIR}`
    }

    // [[ "$SHARE_METHOD" != "none" ]]
    if (env.SHARE_METHOD !== `none`) {
        // [[ "$SHARE_METHOD" == "nat" ]]
        if (env.SHARE_METHOD === `nat`) {
            await $`iptables -w -t nat -D POSTROUTING -s $GATEWAY.0/24 ! -o  -j MASQUERADE`
            await $`iptables -w -D FORWARD -i  -s $GATEWAY.0/24 -j ACCEPT`
            await $`iptables -w -D FORWARD -i  -d $GATEWAY.0/24 -j ACCEPT`
        // [[ "$SHARE_METHOD" == "bridge" ]]
        } else if (env.SHARE_METHOD === `bridge`) {
            // ! is_bridge_interface $INTERNET_IFACE
            if ((await is_bridge_interface(env.INTERNET_IFACE)) != 0) {
                await $`ip link set dev ${env.BRIDGE_IFACE} down`
                await $`ip link set dev ${env.INTERNET_IFACE} down`
                await $`ip link set dev ${env.INTERNET_IFACE} promisc off`
                await $`ip link set dev ${env.INTERNET_IFACE} nomaster`
                await $`ip link delete ${env.BRIDGE_IFACE} type bridge`
                await $`ip addr flush ${env.INTERNET_IFACE}`
                await $`ip link set dev ${env.INTERNET_IFACE} up`
                await dealloc_iface(env.BRIDGE_IFACE)

                // for x in "${IP_ADDRS[@]}"; 
                for (env.x of iterateOver(env.IP_ADDRS/* FIXME: IP_ADDRS[@] */)) {

                    env.x = env.x/* FIXME: x/inet/ */
                    env.x = env.x/* FIXME: x/secondary/ */
                    env.x = env.x/* FIXME: x/dynamic/ */
                    env.x = await $.str`echo ${env.x} | sed s/\\([0-9]\\)sec/\\1/g`
                    env.x = env.x/* FIXME: x/${INTERNET_IFACE}/ */
                    await $`ip addr add ${env.x} dev ${env.INTERNET_IFACE}`
                
                }

                await $`ip route flush dev ${env.INTERNET_IFACE}`

                // for x in "${ROUTE_ADDRS[@]}"; 
                for (env.x of iterateOver(env.ROUTE_ADDRS/* FIXME: ROUTE_ADDRS[@] */)) {

                    // [[ -z "$x" ]]
                    if (env.x.length == 0) {
                        continue
                    }
                    // [[ "$x" == default* ]]
                    if (env.x === `default*`) {
                        continue
                    }
                    await $`ip route add ${env.x} dev ${env.INTERNET_IFACE}`
                
                }

                // for x in "${ROUTE_ADDRS[@]}"; 
                for (env.x of iterateOver(env.ROUTE_ADDRS/* FIXME: ROUTE_ADDRS[@] */)) {

                    // [[ -z "$x" ]]
                    if (env.x.length == 0) {
                        continue
                    }
                    // [[ "$x" != default* ]]
                    if (env.x !== `default*`) {
                        continue
                    }
                    await $`ip route add ${env.x} dev ${env.INTERNET_IFACE}`
                
                }

                await networkmanager_rm_unmanaged_if_needed(env.INTERNET_IFACE)
            }
        }
    }

    // [[ "$SHARE_METHOD" != "bridge" ]]
    if (env.SHARE_METHOD !== `bridge`) {
        // [[ $NO_DNS -eq 0 ]]
        if (env.NO_DNS == 0) {
            await $`iptables -w -D INPUT -p tcp -m tcp --dport ${env.DNS_PORT} -j ACCEPT`
            await $`iptables -w -D INPUT -p udp -m udp --dport ${env.DNS_PORT} -j ACCEPT`
            await $`iptables -w -t nat -D PREROUTING -s $GATEWAY.0/24 -d  -p tcp -m tcp --dport 53 -j REDIRECT --to-ports ${env.DNS_PORT}`
            await $`iptables -w -t nat -D PREROUTING -s $GATEWAY.0/24 -d  -p udp -m udp --dport 53 -j REDIRECT --to-ports ${env.DNS_PORT}`
        }
        await $`iptables -w -D INPUT -p udp -m udp --dport 67 -j ACCEPT`
    }

    // [[ $NO_VIRT -eq 0 ]]
    if (env.NO_VIRT == 0) {
        // [[ -n "$VWIFI_IFACE" ]]
        if (env.VWIFI_IFACE.length > 0) {
            await $`ip link set down dev `
            await $`ip addr flush `
            await networkmanager_rm_unmanaged_if_needed(env.VWIFI_IFACE, env.OLD_MACADDR, )
            await $`iw dev  del`
            await dealloc_iface(env.VWIFI_IFACE)
        }
    } else {
        await $`ip link set down dev `
        await $`ip addr flush `
        // [[ -n "$NEW_MACADDR" ]]
        if (env.NEW_MACADDR.length > 0) {
            await $`ip link set dev  address `
        }
        await networkmanager_rm_unmanaged_if_needed(env.WIFI_IFACE, env.OLD_MACADDR, )
    }

    await mutex_unlock()
    await cleanup_lock()

    // [[ $RUNNING_AS_DAEMON -eq 1 && -n "$DAEMON_PIDFILE" && -f "$DAEMON_PIDFILE" ]]
    if (env.RUNNING_AS_DAEMON == 1) {
        await $`rm ${env.DAEMON_PIDFILE}`
    }

}

// FIXME: you'll need to custom verify this function usage: cleanup
async function cleanup(...args) { const { local, env } = makeScope({ args })

    console.log(``)
    console.log(`-n Doing cleanup.. `)
    await $`_cleanup`.stdout(...$stdout)
    console.log(`done`)

}

// FIXME: you'll need to custom verify this function usage: die
async function die(...args) { const { local, env } = makeScope({ args })

    await $`[[ -n "$1" ]] && echo -e 
ERROR: ${env["1"]}
 >&2`
    // send die signal to the main process
    await $`[[ $BASHPID -ne $$ ]] && kill -USR2 ${env.$}`
    // we don't need to call cleanup because it's traped on EXIT
    await $`exit 1`

}

// FIXME: you'll need to custom verify this function usage: clean_exit
async function clean_exit(...args) { const { local, env } = makeScope({ args })

    // send clean_exit signal to the main process
    await $`[[ $BASHPID -ne $$ ]] && kill -USR1 ${env.$}`
    // we don't need to call cleanup because it's traped on EXIT
    await $`exit 0`

}

// FIXME: you'll need to custom verify this function usage: list_running_conf
async function list_running_conf(...args) { const { local, env } = makeScope({ args })

    local.x = ""
    await mutex_lock()
    // for x in /tmp/create_ap.*; 
    for (env.x of iterateOver(`/tmp/create_ap.*`)) {

        // [[ -f $x/pid && -f $x/wifi_iface && -d /proc/$(cat $x/pid) ]]
        if ([object Object]) {
            console.log(`${env.x}`)
        }
    
    }
    await mutex_unlock()

}

// FIXME: you'll need to custom verify this function usage: list_running
async function list_running(...args) { const { local, env } = makeScope({ args })

    local.IFACE = "";local.wifi_iface = "";local.x = ""
    await mutex_lock()
    // for x in $(list_running_conf); 
    for (env.x of iterateOver(await $.str`list_running_conf`)) {

        env.IFACE = env.x/* FIXME: x#*. */
        env.IFACE = env.IFACE/* FIXME: IFACE%%.* */
        env.wifi_iface = await $.str`cat ${env.x}/wifi_iface`

        // [[ $IFACE == $wifi_iface ]]
        if (env.IFACE === env.wifi_iface) {
            console.log(` ${env.IFACE}`)
        } else {
            console.log(` ${env.IFACE} (${await $.str`cat ${env.x}/wifi_iface`})`)
        }
    
    }
    await mutex_unlock()

}

// FIXME: you'll need to custom verify this function usage: get_wifi_iface_from_pid
async function get_wifi_iface_from_pid(...args) { const { local, env } = makeScope({ args })

    await $`list_running | awk {print $1 " " $NF} | tr -d \\(\\) | grep -E ^$1 | cut -d  -f2`

}

// FIXME: you'll need to custom verify this function usage: get_pid_from_wifi_iface
async function get_pid_from_wifi_iface(...args) { const { local, env } = makeScope({ args })

    await $`list_running | awk {print $1 " " $NF} | tr -d \\(\\) | grep -E $1\$ | cut -d  -f1`

}

// FIXME: you'll need to custom verify this function usage: get_confdir_from_pid
async function get_confdir_from_pid(...args) { const { local, env } = makeScope({ args })

    local.IFACE = "";local.x = ""
    await mutex_lock()
    // for x in $(list_running_conf); 
    for (env.x of iterateOver(await $.str`list_running_conf`)) {

        // [[ $(cat $x/pid) == "$1" ]]
        if (0 === env["1"]) {
            console.log(`${env.x}`)
            break
        }
    
    }
    await mutex_unlock()

}

// FIXME: you'll need to custom verify this function usage: print_client
async function print_client(...args) { const { local, env } = makeScope({ args })

    local.line = "";local.ipaddr = "";local.hostname = ""
    local.mac = env["1"]

    // [[ -f $CONFDIR/dnsmasq.leases ]]
    if ([object Object]) {
        env.line = await $.str`grep ${env[" $mac"]} ${env.CONFDIR}/dnsmasq.leases | tail -n 1`
        env.ipaddr = await $.str`echo ${env.line} | cut -d  -f3`
        env.hostname = await $.str`echo ${env.line} | cut -d  -f4`
    }

    /* FIXME: [[ -z "$ipaddr" ]] && ipaddr="*" */0
    /* FIXME: [[ -z "$hostname" ]] && hostname="*" */0

    await $`printf %-20s %-18s %s
 ${env.mac} ${env.ipaddr} ${env.hostname}`

}

// FIXME: you'll need to custom verify this function usage: list_clients
async function list_clients(...args) { const { local, env } = makeScope({ args })

    local.wifi_iface = "";local.pid = ""

    // If PID is given, get the associated wifi iface
    // [[ "$1" =~ ^[1-9][0-9]*$ ]]
    if (env["1"].match(/^[1-9][0-9]*\$/)) {
        env.pid = env["1"]
        env.wifi_iface = await $.str`get_wifi_iface_from_pid ${env.pid}`
        await $`[[ -z "$wifi_iface" ]] && die '${env.pid}' is not the pid of a running ${env.PROGNAME} instance.`
    }

    /* FIXME: [[ -z "$wifi_iface" ]] && wifi_iface="$1" */0
    await $`is_wifi_interface ${env.wifi_iface} || die '${env.wifi_iface}' is not a WiFi interface.`

    /* FIXME: [[ -z "$pid" ]] && pid=$(get_pid_from_wifi_iface "$wifi_iface") */0
    await $`[[ -z "$pid" ]] && die '${env.wifi_iface}' is not used from ${env.PROGNAME} instance.
\\
       Maybe you need to pass the virtual interface instead.
\\
       Use --list-running to find it out.`
    /* FIXME: [[ -z "$CONFDIR" ]] && CONFDIR=$(get_confdir_from_pid "$pid") */0

    // [[ $USE_IWCONFIG -eq 0 ]]
    if (env.USE_IWCONFIG == 0) {
        local.awk_cmd = `($1 ~ /Station$/) {print $2}`
        local.client_list = await $.str`iw dev ${env.wifi_iface} station dump | awk ${env.awk_cmd}`

        // [[ -z "$client_list" ]]
        if (env.client_list.length == 0) {
            console.log(`No clients connected`)
            return exitCodeOfLastChildProcess = ``
        }

        await $`printf %-20s %-18s %s
 MAC IP Hostname`

        local.mac = ""
        // for mac in $client_list; 
        for (env.mac of iterateOver(env.client_list)) {

            await print_client(env.mac)
        
        }
    } else {
        await die(`This option is not supported for the current driver.`)
    }

}

// FIXME: you'll need to custom verify this function usage: has_running_instance
async function has_running_instance(...args) { const { local, env } = makeScope({ args })

    local.PID = "";local.x = ""

    await mutex_lock()
    // for x in /tmp/create_ap.*; 
    for (env.x of iterateOver(`/tmp/create_ap.*`)) {

        // [[ -f $x/pid ]]
        if ([object Object]) {
            env.PID = await $.str`cat ${env.x}/pid`
            // [[ -d /proc/$PID ]]
            if (fs.existsSync(`/proc/${env.PID}`) && fs.lstatSync(`/proc/${env.PID}`).isDirectory()) {
                await mutex_unlock()
                return exitCodeOfLastChildProcess = 0
            }
        }
    
    }
    await mutex_lock()

    return exitCodeOfLastChildProcess = 1

}

// FIXME: you'll need to custom verify this function usage: is_running_pid
async function is_running_pid(...args) { const { local, env } = makeScope({ args })

    await $`list_running | grep -E ^$1`.stdout(...$stdout)

}

// FIXME: you'll need to custom verify this function usage: send_stop
async function send_stop(...args) { const { local, env } = makeScope({ args })

    local.x = ""

    await mutex_lock()
    // send stop signal to specific pid
    // is_running_pid $1
    if ((await is_running_pid(env["1"])) == 0) {
        await $`kill -USR1 ${env["1"]}`
        await mutex_unlock()
        return exitCodeOfLastChildProcess = ``
    }

    // send stop signal to specific interface
    // for x in $(list_running | grep -E " \(?${1}( |\)?\$)" | cut -f1 -d' '); 
    for (env.x of iterateOver(await $.str`list_running | grep -E  \\(?$1( |\\)?$) | cut -f1 -d `)) {

        await $`kill -USR1 ${env.x}`
    
    }
    await mutex_unlock()

}

// Storing configs
// FIXME: you'll need to custom verify this function usage: write_config
async function write_config(...args) { const { local, env } = makeScope({ args })

    local.i = 1

    // If using pkexec, evaluate permissions before writing.
    //   However, the /etc/create_ap.conf
    //   location is excepted.
    // [[ "$STORE_CONFIG" != "/etc/create_ap.conf" && $PKEXEC_UID ]]
    if (env.STORE_CONFIG !== `/etc/create_ap.conf`) {
        // [ -e "$STORE_CONFIG" ]
        if (fs.existsSync(`${env.STORE_CONFIG}`)) {
            // ! pkexec --user "$(id -nu $PKEXEC_UID)" test -w "$STORE_CONFIG"
            if ((await $`pkexec --user  test -w ${env.STORE_CONFIG}`).code!=0)) {
                console.log(`ERROR: 1 ${await $.str`id -nu ${env.PKEXEC_UID}`} has insufficient permissions to write to config file ${env.STORE_CONFIG}`)
                await $`exit 1`
            }
        // ! pkexec --user "$(id -nu $PKEXEC_UID)" test -w "$(dirname "$STORE_CONFIG")"
        } else if ((await $`pkexec --user  test -w `).code!=0)) {
            console.log(`ERROR: 2 ${await $.str`id -nu ${env.PKEXEC_UID}`} has insufficient permissions to write to config file ${env.STORE_CONFIG}`)
            await $`exit 1`
        }
        // Assume that the user is making a conf file in a directory they normally
        // have control over, and keep permissions strictly private. (i.e. they will
        // need to run create_ap directly with sudo in order to write to, say, /etc/create_ap2.conf)
        await $`touch ${env.STORE_CONFIG}`
        await $`chown ${await $.str`id -nu ${env.PKEXEC_UID}`}:${await $.str`id -ng ${env.PKEXEC_GID}`} ${env.STORE_CONFIG}`
        await $`chmod 600 ${env.STORE_CONFIG}`
    // ! eval 'echo -n > "$STORE_CONFIG"' > /dev/null 2>&1
    } else if ((await $`! eval echo -n > "$STORE_CONFIG"`.stdout(...$stdout)).code==0)) {
        await $`echo ERROR: Unable to create config file ${env.STORE_CONFIG} >&2`
        await $`exit 1`
    }

    env.WIFI_IFACE = env["1"]
    // [[ "$SHARE_METHOD" == "none" ]]
    if (env.SHARE_METHOD === `none`) {
        env.SSID = env["2"]
        env.PASSPHRASE = env["3"]
    } else {
        env.INTERNET_IFACE = env["2"]
        env.SSID = env["3"]
        env.PASSPHRASE = env["4"]
    }

    // [[ $FREQ_BAND_SET -eq 0 ]]
    if (env.FREQ_BAND_SET == 0) {
        env.FREQ_BAND = `default`
    }

    /* FIXME: for config_opt in "${CONFIG_OPTS[@]}"; do
        eval echo $config_opt=\$$config_opt
    done >> "$STORE_CONFIG" */0

    console.log(`-e Config options written to '${env.STORE_CONFIG}'`)
    await $`exit 0`

}

// FIXME: you'll need to custom verify this function usage: is_config_opt
async function is_config_opt(...args) { const { local, env } = makeScope({ args })

    local.opt = env["1"]

    // for elem in "${CONFIG_OPTS[@]}"; 
    for (env.elem of iterateOver(env.CONFIG_OPTS/* FIXME: CONFIG_OPTS[@] */)) {

        // [[ "$elem" == "$opt" ]]
        if (env.elem === env.opt) {
            return exitCodeOfLastChildProcess = 0
        }
    
    }
    return exitCodeOfLastChildProcess = 1

}

// Load options from config file
// FIXME: you'll need to custom verify this function usage: read_config
async function read_config(...args) { const { local, env } = makeScope({ args })

    local.opt_name = "";local.opt_val = "";local.line = ""

    /* FIXME: while read line; do
        # Read switches and their values
        opt_name="${line%%=*}"
        opt_val="${line#*=}"

        if [[ $opt_name == "FREQ_BAND" && $opt_val != "default" ]] ; then
            FREQ_BAND_SET=1
        fi

        if is_config_opt "$opt_name" ; then
            eval $opt_name="\$opt_val"
        else
            echo "WARN: Unrecognized configuration entry. Please check your config file." >&2
        fi
    done < "$LOAD_CONFIG" */0

}


env.ARGS = [env["@"]]

env.FREQ_BAND_SET = 0

// Preprocessing for --config before option-parsing starts
for (env.i=0; env.i<$#; env.i++) {

    // [[ "${ARGS[i]}" = "--config" ]]
    if (0 === `--config`) {
        // [[ -f "${ARGS[i+1]}" ]]
        if ([object Object]) {
            env.LOAD_CONFIG = env.ARGS/* FIXME: ARGS[i+1] */
            await read_config()
        } else {
            await $`echo ERROR: No config file found at given location >&2`
            await $`exit 1`
        }
        break
    }

}

env.GETOPT_ARGS = await $.str`getopt -o hc:w:g:de:nm: -l help,hidden,hostapd-debug:,hostapd-timestamps,redirect-to-localhost,mac-filter,mac-filter-accept:,isolate-clients,ieee80211n,ieee80211ac,ieee80211ax,ht_capab:,vht_capab:,driver:,no-virt,fix-unmanaged,country:,freq-band:,mac:,dhcp-dns:,daemon,pidfile:,logfile:,dns-logfile:,stop:,list,list-running,list-clients:,version,psk,no-haveged,no-dns,no-dnsmasq,mkconfig:,config:,dhcp-hosts: -n ${env.PROGNAME} -- ${env["@"]}`
await $`[[ $? -ne 0 ]] && exit 1`
await $`eval set -- ${env.GETOPT_ARGS}`

while (true) {

    /* FIXME: case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        --version)
            echo $VERSION
            exit 0
            ;;
        --hidden)
            shift
            HIDDEN=1
            ;;
        --mac-filter)
            shift
            MAC_FILTER=1
            ;;
        --mac-filter-accept)
            shift
            MAC_FILTER_ACCEPT="$1"
            shift
            ;;
        --isolate-clients)
            shift
            ISOLATE_CLIENTS=1
            ;;
        -c)
            shift
            CHANNEL="$1"
            shift
            ;;
        -w)
            shift
            WPA_VERSION="$1"
            [[ "$WPA_VERSION" == "2+1" ]] && WPA_VERSION=1+2
            shift
            ;;
        -g)
            shift
            GATEWAY="$1"
            shift
            ;;
        -d)
            shift
            ETC_HOSTS=1
            ;;
        -e)
            shift
            ADDN_HOSTS="$1"
            shift
            ;;
        --dhcp-hosts)
            shift
            DHCP_HOSTS="$1"
            shift
            ;;
        -n)
            shift
            SHARE_METHOD=none
            ;;
        -m)
            shift
            SHARE_METHOD="$1"
            shift
            ;;
        --ieee80211n)
            shift
            IEEE80211N=1
            ;;
        --ieee80211ac)
            shift
            IEEE80211AC=1
            ;;
	--ieee80211ax)
	    shift
	    IEEE80211AX=1
	    ;;
        --ht_capab)
            shift
            HT_CAPAB="$1"
            shift
            ;;
        --vht_capab)
            shift
            VHT_CAPAB="$1"
            shift
            ;;
        --driver)
            shift
            DRIVER="$1"
            shift
            ;;
        --no-virt)
            shift
            NO_VIRT=1
            ;;
        --fix-unmanaged)
            shift
            FIX_UNMANAGED=1
            ;;
        --country)
            shift
            COUNTRY="$1"
            shift
            ;;
        --freq-band)
            shift
            FREQ_BAND="$1"
            FREQ_BAND_SET=1
            shift
            ;;
        --mac)
            shift
            NEW_MACADDR="$1"
            shift
            ;;
        --dhcp-dns)
            shift
            DHCP_DNS="$1"
            shift
            ;;
        --daemon)
            shift
            DAEMONIZE=1
            ;;
        --pidfile)
            shift
            DAEMON_PIDFILE="$1"
            shift
            ;;
        --logfile)
            shift
            DAEMON_LOGFILE="$1"
            shift
            ;;
        --dns-logfile)
            shift
            DNS_LOGFILE="$1"
            shift
            ;;
        --stop)
            shift
            STOP_ID="$1"
            shift
            ;;
        --list)
            shift
            LIST_RUNNING=1
            echo -e "WARN: --list is deprecated, use --list-running instead.\n" >&2
            ;;
        --list-running)
            shift
            LIST_RUNNING=1
            ;;
        --list-clients)
            shift
            LIST_CLIENTS_ID="$1"
            shift
            ;;
        --no-haveged)
            shift
            NO_HAVEGED=1
            ;;
        --psk)
            shift
            USE_PSK=1
            ;;
        --no-dns)
            shift
            NO_DNS=1
            ;;
        --no-dnsmasq)
            shift
            NO_DNSMASQ=1
            ;;
        --redirect-to-localhost)
            shift
            REDIRECT_TO_LOCALHOST=1
            ;;
        --hostapd-debug)
            shift
            if [ "x$1" = "x1" ]; then
                HOSTAPD_DEBUG_ARGS+="-d "
            elif [ "x$1" = "x2" ]; then
                HOSTAPD_DEBUG_ARGS+="-dd "
            else
                printf "Error: argument for --hostapd-debug expected 1 or 2, got %s\n" "$1"
                exit 1
            fi
            shift
            ;;
        --hostapd-timestamps)
            shift
            HOSTAPD_DEBUG_ARGS+="-t "
            ;;
        --mkconfig)
            shift
            STORE_CONFIG="$1"
            shift
            ;;
        --config)
            shift
            shift
            ;;
        --)
            shift
            break
            ;;
    esac */0

}

// Load positional args from config file, if needed
// [[ -n "$LOAD_CONFIG" && $# -eq 0 ]]
if (env.LOAD_CONFIG.length > 0) {
    env.i = 0
    // set arguments in order
    // for x in WIFI_IFACE INTERNET_IFACE SSID PASSPHRASE; 
    for (env.x of iterateOver(`WIFI_IFACE`)) {

        // eval "[[ -n \"\$${x}\" ]]"
        if ((await $`eval [[ -n "$$x" ]]`).code==0)) {
            await $`eval set -- "\${@:1:${env.i}}" "$$x"`
            await $`((i++))`
        }
        // we unset the variable to avoid any problems later
        await $`eval unset ${env.x}`
    
    }
}

// Check if required number of positional args are present
// [[ $# -lt 1 && $FIX_UNMANAGED -eq 0  && -z "$STOP_ID" &&
      $LIST_RUNNING -eq 0 && -z "$LIST_CLIENTS_ID" ]]
if ([object Object]) {
    await $`usage >&2`
    await $`exit 1`
}

// Set NO_DNS, if dnsmasq is disabled
// [[ $NO_DNSMASQ -eq 1 ]]
if (env.NO_DNSMASQ == 1) {
  env.NO_DNS = 1
}

await $`trap cleanup_lock EXIT`

// [[ $(id -u) -ne 0 ]]
if (0 != 0) {
    await $`echo create_ap must be run as root. >&2`
    await $`exit 1`
}

// ! init_lock
if ((await init_lock()) != 0) {
    await $`echo ERROR: Failed to initialize lock >&2`
    await $`exit 1`
}

// if the user press ctrl+c or we get USR1 signal
// then run clean_exit()
await $`trap clean_exit SIGINT SIGUSR1`
// if we get USR2 signal then run die().
await $`trap die SIGUSR2`

await $`[[ -n "$STORE_CONFIG" ]] && write_config ${env["@"]}`

// [[ $LIST_RUNNING -eq 1 ]]
if (env.LIST_RUNNING == 1) {
    //echo -e "List of running $PROGNAME instances:\n"
    await list_running()
    await $`exit 0`
}

// [[ -n "$LIST_CLIENTS_ID" ]]
if (env.LIST_CLIENTS_ID.length > 0) {
    await list_clients(env.LIST_CLIENTS_ID)
    await $`exit 0`
}

// [[ -n "$STOP_ID" ]]
if (env.STOP_ID.length > 0) {
    console.log(`Trying to kill ${env.PROGNAME} instance associated with ${env.STOP_ID}...`)
    await send_stop(env.STOP_ID)
    await $`exit 0`
}

// [[ $FIX_UNMANAGED -eq 1 ]]
if (env.FIX_UNMANAGED == 1) {
    console.log(`Trying to fix unmanaged status in NetworkManager...`)
    await networkmanager_fix_unmanaged()
    await $`exit 0`
}

// [[ $DAEMONIZE -eq 1 && $RUNNING_AS_DAEMON -eq 0 ]]
if (env.DAEMONIZE == 1) {
    // Assume we're running underneath a service manager if PIDFILE is set
    // and don't clobber it's output with a useless message
    // [ -z "$DAEMON_PIDFILE" ]
    if (env.DAEMON_PIDFILE.length == 0) {
        console.log(`Running as Daemon...`)
    }
    // run a detached create_ap
    await $`(variable_assignment name: (variable_name) value: (number)) setsid ${env["0"]} `.stdout(...$stdout) /* FIXME: & */0
    await $`exit 0`
// [[ $RUNNING_AS_DAEMON -eq 1 && -n "$DAEMON_PIDFILE" ]]
} else if (env.RUNNING_AS_DAEMON == 1) {
    await $`echo ${env.$} >$DAEMON_PIDFILE`
}

// [[ $FREQ_BAND_SET != 0 ]]
if (env.FREQ_BAND_SET !== 0) {
    // [[ $FREQ_BAND != 2.4 && $FREQ_BAND != 5 ]]
    if (env.FREQ_BAND !== 2.4) {
        await $`echo ERROR: Invalid frequency band >&2`
        await $`exit 1`
    }
}

// [[ $CHANNEL == default ]]
if (env.CHANNEL === `default`) {
    env.USING_DEFAULT_CHANNEL = 1
    // [[ $FREQ_BAND == 2.4 ]]
    if (env.FREQ_BAND === 2.4) {
        env.CHANNEL = 1
    } else {
        env.CHANNEL = 36
    }
} else {
    env.USING_DEFAULT_CHANNEL = 0
}


// [[ $FREQ_BAND != 5 && $CHANNEL -gt 14 ]]
if (env.FREQ_BAND !== 5) {
    console.log(`Channel number is greater than 14, assuming 5GHz frequency band`)
    env.FREQ_BAND = 5
}

env.WIFI_IFACE = env["1"]

// ! is_wifi_interface ${WIFI_IFACE}
if ((await is_wifi_interface(env.WIFI_IFACE)) != 0) {
    await $`echo ERROR: '$WIFI_IFACE' is not a WiFi interface >&2`
    await $`exit 1`
}

// ! can_be_ap ${WIFI_IFACE}
if ((await can_be_ap(env.WIFI_IFACE)) != 0) {
    await $`echo ERROR: Your adapter does not support AP (master) mode >&2`
    await $`exit 1`
}

// ! can_be_sta_and_ap ${WIFI_IFACE}
if ((await can_be_sta_and_ap(env.WIFI_IFACE)) != 0) {
    // is_wifi_connected ${WIFI_IFACE}
    if ((await is_wifi_connected(env.WIFI_IFACE)) == 0) {
        await $`echo ERROR: Your adapter can not be a station (i.e. be connected) and an AP at the same time >&2`
        await $`exit 1`
    // [[ $NO_VIRT -eq 0 ]]
    } else if (env.NO_VIRT == 0) {
        await $`echo WARN: Your adapter does not fully support AP virtual interface, enabling --no-virt >&2`
        env.NO_VIRT = 1
    }
}

env.HOSTAPD = await $.str`which hostapd`

// [[ ! -x "$HOSTAPD" ]]
if (fs.existsSync(`${env.HOSTAPD}`) && (() => { try { fs.accessSync(`${env.HOSTAPD}`, fs.constants.X_OK); return true; } catch (e) { return false; } })()) {
    await $`echo ERROR: hostapd not found. >&2`
    await $`exit 1`
}

// [[ $(get_adapter_kernel_module ${WIFI_IFACE}) =~ ^(8192[cd][ue]|8723a[sue])$ ]]
if (0.match(/0/)) {
    // ! strings "$HOSTAPD" | grep -m1 rtl871xdrv > /dev/null 2>&1
    if ((await $`! strings ${env.HOSTAPD} | grep -m1 rtl871xdrv`.stdout(...$stdout)).code==0)) {
        await $`echo ERROR: You need to patch your hostapd with rtl871xdrv patches. >&2`
        await $`exit 1`
    }

    // [[ $DRIVER != "rtl871xdrv" ]]
    if (env.DRIVER !== `rtl871xdrv`) {
        await $`echo WARN: Your adapter needs rtl871xdrv, enabling --driver=rtl871xdrv >&2`
        env.DRIVER = `rtl871xdrv`
    }
}

// [[ "$SHARE_METHOD" != "nat" && "$SHARE_METHOD" != "bridge" && "$SHARE_METHOD" != "none" ]]
if (env.SHARE_METHOD !== `nat`) {
    await $`echo ERROR: Wrong Internet sharing method >&2`
    console.log(``)
    await $`usage >&2`
    await $`exit 1`
}

// [[ -n "$NEW_MACADDR" ]]
if (env.NEW_MACADDR.length > 0) {
    // ! is_macaddr "$NEW_MACADDR"
    if ((await is_macaddr(env.NEW_MACADDR)) != 0) {
        await $`echo ERROR: '$NEW_MACADDR' is not a valid MAC address >&2`
        await $`exit 1`
    }

    // ! is_unicast_macaddr "$NEW_MACADDR"
    if ((await is_unicast_macaddr(env.NEW_MACADDR)) != 0) {
        await $`echo ERROR: The first byte of MAC address ($NEW_MACADDR) must be even >&2`
        await $`exit 1`
    }

    // [[ $(get_all_macaddrs | grep -c ${NEW_MACADDR}) -ne 0 ]]
    if (0 != 0) {
        await $`echo WARN: MAC address '$NEW_MACADDR' already exists. Because of this, you may encounter some problems >&2`
    }
}

// [[ "$SHARE_METHOD" != "none" ]]
if (env.SHARE_METHOD !== `none`) {
    env.MIN_REQUIRED_ARGS = 2
} else {
    env.MIN_REQUIRED_ARGS = 1
}

// [[ $# -gt $MIN_REQUIRED_ARGS ]]
if (env["#"] > env.MIN_REQUIRED_ARGS) {
    // [[ "$SHARE_METHOD" != "none" ]]
    if (env.SHARE_METHOD !== `none`) {
        // [[ $# -ne 3 && $# -ne 4 ]]
        if (env["#"] != 3) {
            await $`usage >&2`
            await $`exit 1`
        }
        env.INTERNET_IFACE = env["2"]
        env.SSID = env["3"]
        env.PASSPHRASE = env["4"]
    } else {
        // [[ $# -ne 2 && $# -ne 3 ]]
        if (env["#"] != 2) {
            await $`usage >&2`
            await $`exit 1`
        }
        env.SSID = env["2"]
        env.PASSPHRASE = env["3"]
    }
} else {
    // [[ "$SHARE_METHOD" != "none" ]]
    if (env.SHARE_METHOD !== `none`) {
        // [[ $# -ne 2 ]]
        if (env["#"] != 2) {
            await $`usage >&2`
            await $`exit 1`
        }
        env.INTERNET_IFACE = env["2"]
    }
    // tty -s
    if ((await $`tty -s`).code==0)) {
        while (true) {

            env.SSID = prompt(SSID: )
            // [[ ${#SSID} -lt 1 || ${#SSID} -gt 32 ]]
            if (0 < 1) {
                await $`echo ERROR: Invalid SSID length $SSID (expected 1..32) >&2`
                continue
            }
            break
        
        }
        while (true) {

            // [[ $USE_PSK -eq 0 ]]
            if (env.USE_PSK == 0) {
                env.PASSPHRASE = prompt(Passphrase: )
                console.log(``)
                // [[ ${#PASSPHRASE} -gt 0 && ${#PASSPHRASE} -lt 8 ]] || [[ ${#PASSPHRASE} -gt 63 ]]
                if ((await $`[[ \${#PASSPHRASE} -gt 0 && \${#PASSPHRASE} -lt 8 ]] || [[ \${#PASSPHRASE} -gt 63 ]]`).code==0)) {
                    await $`echo ERROR: Invalid passphrase length $PASSPHRASE (expected 8..63) >&2`
                    continue
                }
                env.PASSPHRASE2 = prompt(Retype passphrase: )
                console.log(``)
                // [[ "$PASSPHRASE" != "$PASSPHRASE2" ]]
                if (env.PASSPHRASE !== env.PASSPHRASE2) {
                    console.log(`Passphrases do not match.`)
                } else {
                    break
                }
            } else {
                env.PASSPHRASE = prompt(PSK: )
                console.log(``)
                // [[ ${#PASSPHRASE} -gt 0 && ${#PASSPHRASE} -ne 64 ]]
                if (0 > 0) {
                    await $`echo ERROR: Invalid pre-shared-key length $PASSPHRASE (expected 64) >&2`
                    continue
                }
            }
        
        }
    } else {
        env.SSID = prompt()
        env.PASSPHRASE = prompt()
    }
}

// [[ "$SHARE_METHOD" != "none" ]] && ! is_interface $INTERNET_IFACE
if ((await $`[[ "$SHARE_METHOD" != "none" ]] && ! is_interface ${env.INTERNET_IFACE}`).code==0)) {
    await $`echo ERROR: '$INTERNET_IFACE' is not an interface >&2`
    await $`exit 1`
}

// [[ ${#SSID} -lt 1 || ${#SSID} -gt 32 ]]
if (0 < 1) {
    await $`echo ERROR: Invalid SSID length $SSID (expected 1..32) >&2`
    await $`exit 1`
}

// [[ $USE_PSK -eq 0 ]]
if (env.USE_PSK == 0) {
    // [[ ${#PASSPHRASE} -gt 0 && ${#PASSPHRASE} -lt 8 ]] || [[ ${#PASSPHRASE} -gt 63 ]]
    if ((await $`[[ \${#PASSPHRASE} -gt 0 && \${#PASSPHRASE} -lt 8 ]] || [[ \${#PASSPHRASE} -gt 63 ]]`).code==0)) {
        await $`echo ERROR: Invalid passphrase length $PASSPHRASE (expected 8..63) >&2`
        await $`exit 1`
    }
// [[ ${#PASSPHRASE} -gt 0 && ${#PASSPHRASE} -ne 64 ]]
} else if (0 > 0) {
    await $`echo ERROR: Invalid pre-shared-key length $PASSPHRASE (expected 64) >&2`
    await $`exit 1`
}

// [[ $(get_adapter_kernel_module ${WIFI_IFACE}) =~ ^rtl[0-9].*$ ]]
if (0.match(/^rtl[0-9].*\$/)) {
    // [[ -n "$PASSPHRASE" ]]
    if (env.PASSPHRASE.length > 0) {
        await $`echo WARN: Realtek drivers usually have problems with WPA1, enabling -w 2 >&2`
        env.WPA_VERSION = 2
    }
    await $`echo WARN: If AP doesn't work, please read: howto/realtek.md >&2`
}

// [[ $NO_VIRT -eq 1 && "$WIFI_IFACE" == "$INTERNET_IFACE" ]]
if (env.NO_VIRT == 1) {
    await $`echo -n ERROR: You can not share your connection from the same >&2`
    await $`echo  interface if you are using --no-virt option. >&2`
    await $`exit 1`
}

await mutex_lock()
await $`trap cleanup EXIT`
env.CONFDIR = await $.str`mktemp -d /tmp/create_ap.$WIFI_IFACE.conf.XXXXXXXX`
console.log(`Config dir: ${env.CONFDIR}`)
console.log(`PID: ${env.$}`)
await $`echo ${env.$} > $CONFDIR/pid`

// to make --list-running work from any user, we must give read
// permissions to $CONFDIR and $CONFDIR/pid
await $`chmod 755 ${env.CONFDIR}`
await $`chmod 444 ${env.CONFDIR}/pid`

env.COMMON_CONFDIR = `/tmp/create_ap.common.conf`
await $`mkdir -p ${env.COMMON_CONFDIR}`

// [[ "$SHARE_METHOD" == "nat" ]]
if (env.SHARE_METHOD === `nat`) {
    await $`echo ${env.INTERNET_IFACE} > $CONFDIR/nat_internet_iface`
    await cp_n(`/proc/sys/net/ipv4/conf/${env.INTERNET_IFACE}/forwarding`, `${env.COMMON_CONFDIR}/$INTERNET_IFACE_forwarding`, )
}
await cp_n(`/proc/sys/net/ipv4/ip_forward`, env.COMMON_CONFDIR, )
// [[ -e /proc/sys/net/bridge/bridge-nf-call-iptables ]]
if (fs.existsSync(`/proc/sys/net/bridge/bridge-nf-call-iptables`)) {
    await cp_n(`/proc/sys/net/bridge/bridge-nf-call-iptables`, env.COMMON_CONFDIR, )
}
await mutex_unlock()

// [[ "$SHARE_METHOD" == "bridge" ]]
if (env.SHARE_METHOD === `bridge`) {
    // is_bridge_interface $INTERNET_IFACE
    if ((await is_bridge_interface(env.INTERNET_IFACE)) == 0) {
        env.BRIDGE_IFACE = env.INTERNET_IFACE
    } else {
        env.BRIDGE_IFACE = await $.str`alloc_new_iface br`
    }
}

// [[ $USE_IWCONFIG -eq 0 ]]
if (env.USE_IWCONFIG == 0) {
    await $`iw dev  set power_save off`
}

// [[ $NO_VIRT -eq 0 ]]
if (env.NO_VIRT == 0) {
    env.VWIFI_IFACE = await $.str`alloc_new_iface ap`

    // in NetworkManager 0.9.9 and above we can set the interface as unmanaged without
    // the need of MAC address, so we set it before we create the virtual interface.
    // networkmanager_is_running && [[ $NM_OLDER_VERSION -eq 0 ]]
    if ((await $`networkmanager_is_running && [[ $NM_OLDER_VERSION -eq 0 ]]`).code==0)) {
        console.log(`-n Network Manager found, set $VWIFI_IFACE as unmanaged device... `)
        await networkmanager_add_unmanaged(env.VWIFI_IFACE)
        // do not call networkmanager_wait_until_unmanaged because interface does not
        // exist yet
        console.log(`DONE`)
    }


    // is_wifi_connected ${WIFI_IFACE} && [[ $FREQ_BAND_SET -eq 0 ]]
    if ((await $`is_wifi_connected  && [[ $FREQ_BAND_SET -eq 0 ]]`).code==0)) {
        env.WIFI_IFACE_FREQ = await $.str`iw dev  link | grep -i freq | awk {print $2}`
        env.WIFI_IFACE_CHANNEL = await $.str`ieee80211_frequency_to_channel `
        console.log(`-n $WIFI_IFACE is already associated with channel $WIFI_IFACE_CHANNEL ($WIFI_IFACE_FREQ MHz)`)
        // is_5ghz_frequency $WIFI_IFACE_FREQ
        if ((await is_5ghz_frequency(env.WIFI_IFACE_FREQ)) == 0) {
            env.FREQ_BAND = 5
        } else {
            env.FREQ_BAND = `2.4`
        }
        // [[ $WIFI_IFACE_CHANNEL -ne $CHANNEL ]]
        if (env.WIFI_IFACE_CHANNEL != env.CHANNEL) {
            // ( get_adapter_info ${IFACE} | grep "#channels <= 2" -q )
            if (undefined) {
                console.log(`-e \nmultiple channels supported`)
            } else {
                console.log(`-e \nmultiple channels not supported,`)
                console.log(`-e \nfallback to channel $WIFI_IFACE_CHANNEL`)
                env.CHANNEL = env.WIFI_IFACE_CHANNEL
            }
        } else {
            console.log(`channel------------------ $CHANNEL`)
        }
    // is_wifi_connected ${WIFI_IFACE} && [[ $FREQ_BAND_SET -eq 1 ]]
    } else if ((await $`is_wifi_connected  && [[ $FREQ_BAND_SET -eq 1 ]]`).code==0)) {
        console.log(`Custom frequency band set with $FREQ_BANDGhz with channel $CHANNEL`)
    }


    /* FIXME: VIRTDIEMSG="Maybe your WiFi adapter does not fully support virtual interfaces.
       Try again with --no-virt." */0
    console.log(`-n Creating a virtual WiFi interface... `)

    // iw dev ${WIFI_IFACE} interface add ${VWIFI_IFACE} type __ap
    if ((await $`iw dev  interface add  type __ap`).code==0)) {
        // now we can call networkmanager_wait_until_unmanaged
        await $`networkmanager_is_running && [[ $NM_OLDER_VERSION -eq 0 ]] && networkmanager_wait_until_unmanaged `
        console.log(`$VWIFI_IFACE created.`)
    } else {
        env.VWIFI_IFACE = ""
        await die(env.VIRTDIEMSG)
    }
    env.OLD_MACADDR = await $.str`get_macaddr `
    // [[ -z "$NEW_MACADDR" && $(get_all_macaddrs | grep -c ${OLD_MACADDR}) -ne 1 ]]
    if (env.NEW_MACADDR.length == 0) {
        env.NEW_MACADDR = await $.str`get_new_macaddr `
    }
    env.WIFI_IFACE = env.VWIFI_IFACE
} else {
    env.OLD_MACADDR = await $.str`get_macaddr `
}

await mutex_lock()
await $`echo ${env.WIFI_IFACE} > $CONFDIR/wifi_iface`
await $`chmod 444 ${env.CONFDIR}/wifi_iface`
await mutex_unlock()

// [[ -n "$COUNTRY" && $USE_IWCONFIG -eq 0 ]]
if (env.COUNTRY.length > 0) {
    await $`iw reg set ${env.COUNTRY}`
}

// Fallback to currently connected channel if the adapter can not transmit to the default channel (1)
// can_transmit_to_channel "${WIFI_IFACE}" "${CHANNEL}"
if ((await can_transmit_to_channel(env.WIFI_IFACE, env.CHANNEL, )) == 0) {
    console.log(`Transmitting to channel $CHANNEL...`)
} else {
    // [[ $USING_DEFAULT_CHANNEL -eq 1 && $WIFI_IFACE_CHANNEL -ne $CHANNEL ]]
    if (env.USING_DEFAULT_CHANNEL == 1) {
        await $`echo -e Your adapter can not transmit to channel $CHANNEL >&2`
        env.CHANNEL = env.WIFI_IFACE_CHANNEL
        console.log(`-e Falling back to channel $CHANNEL`)
        await $`can_transmit_to_channel   || die Your adapter can not transmit to channel $CHANNEL, frequency band $FREQ_BANDGHz.`
    } else {
        await die(`Your adapter can not transmit to channel $CHANNEL, frequency band $FREQ_BANDGHz.`)
    }
}

// networkmanager_exists && ! networkmanager_iface_is_unmanaged ${WIFI_IFACE}
if ((await $`networkmanager_exists && ! networkmanager_iface_is_unmanaged `).code==0)) {
    console.log(`-n Network Manager found, set $WIFI_IFACE as unmanaged device... `)
    await networkmanager_add_unmanaged(env.WIFI_IFACE)

    // networkmanager_is_running
    if ((await networkmanager_is_running()) == 0) {
        await networkmanager_wait_until_unmanaged(env.WIFI_IFACE)
    }

    console.log(`DONE`)
}

await $`[[ $HIDDEN -eq 1 ]] && echo Access Point's SSID is hidden!`

await $`[[ $MAC_FILTER -eq 1 ]] && echo MAC address filtering is enabled!`

await $`[[ $ISOLATE_CLIENTS -eq 1 ]] && echo Access Point's clients will be isolated!`

// hostapd config
await $`cat > $CONFDIR/hostapd.conf`

// [[ -n "$COUNTRY" ]]
if (env.COUNTRY.length > 0) {
    await $`cat >> $CONFDIR/hostapd.conf`
}

// [[ $FREQ_BAND == 2.4 ]]
if (env.FREQ_BAND === 2.4) {
    await $`echo hw_mode=g >> $CONFDIR/hostapd.conf`
} else {
    await $`echo hw_mode=a >> $CONFDIR/hostapd.conf`
}

// [[ $MAC_FILTER -eq 1 ]]
if (env.MAC_FILTER == 1) {
    await $`cat >> $CONFDIR/hostapd.conf`
}

// [[ $IEEE80211N -eq 1 ]]
if (env.IEEE80211N == 1) {
    await $`cat >> $CONFDIR/hostapd.conf`
}

// [[ $IEEE80211AC -eq 1 ]]
if (env.IEEE80211AC == 1) {
    await $`echo ieee80211ac=1 >> $CONFDIR/hostapd.conf`
}

// [[ $IEEE80211AX -eq 1 ]]
if (env.IEEE80211AX == 1) {
    await $`echo ieee80211ax=1 >> $CONFDIR/hostapd.conf`
}

// [[ -n "$VHT_CAPAB" ]]
if (env.VHT_CAPAB.length > 0) {
    await $`echo vht_capab=$VHT_CAPAB >> $CONFDIR/hostapd.conf`
}

// [[ $IEEE80211N -eq 1 ]] || [[ $IEEE80211AC -eq 1 ]]
if ((await $`[[ $IEEE80211N -eq 1 ]] || [[ $IEEE80211AC -eq 1 ]]`).code==0)) {
    await $`echo wmm_enabled=1 >> $CONFDIR/hostapd.conf`
}

// [[ -n "$PASSPHRASE" ]]
if (env.PASSPHRASE.length > 0) {
    // [[ "$WPA_VERSION" == "1+2" ]]
    if (env.WPA_VERSION === `1+2`) {
        env.WPA_VERSION = 2 // Assuming you want to default to WPA2 for the "1+2" setting
    }
    // [[ $USE_PSK -eq 0 ]]
    if (env.USE_PSK == 0) {
        env.WPA_KEY_TYPE = `passphrase`
    } else {
        env.WPA_KEY_TYPE = `psk`
    }

    // [[ "$WPA_VERSION" == "3" ]]
    if (env.WPA_VERSION === 3) {
        // Configuring for WPA3 Transition Mode
        // 80211w must be 1 or Apple Devices will not connect. 
        // 1 is the only valid value for WPA3 Transition Mode
        await $`cat >> $CONFDIR/hostapd.conf`
    } else {
        // Original configuration for WPA_VERSION other than 3
        await $`cat >> $CONFDIR/hostapd.conf`
    }
}


// [[ "$SHARE_METHOD" == "bridge" ]]
if (env.SHARE_METHOD === `bridge`) {
    await $`echo bridge=$BRIDGE_IFACE >> $CONFDIR/hostapd.conf`
// [[ $NO_DNSMASQ -eq 0 ]]
} else if (env.NO_DNSMASQ == 0) {
    // dnsmasq config (dhcp + dns)
    env.DNSMASQ_VER = await $.str`dnsmasq -v | grep -m1 -oE [0-9]+(\\.[0-9]+)*\\.[0-9]+`
    await version_cmp(env.DNSMASQ_VER, `2.63`, )
    // [[ $? -eq 1 ]]
    if (env["?"] == 1) {
        env.DNSMASQ_BIND = `bind-interfaces`
    } else {
        env.DNSMASQ_BIND = `bind-dynamic`
    }
    // [[ "$DHCP_DNS" == "gateway" ]]
    if (env.DHCP_DNS === `gateway`) {
        env.DHCP_DNS = env.GATEWAY
    }
    await $`cat > $CONFDIR/dnsmasq.conf`
    env.MTU = await $.str`get_mtu ${env.INTERNET_IFACE}`
    await $`[[ -n "$MTU" ]] && echo dhcp-option-force=option:mtu,$MTU >> $CONFDIR/dnsmasq.conf`
    await $`[[ $ETC_HOSTS -eq 0 ]] && echo no-hosts >> $CONFDIR/dnsmasq.conf`
    await $`[[ -n "$ADDN_HOSTS" ]] && echo addn-hosts=$ADDN_HOSTS >> $CONFDIR/dnsmasq.conf`
    // [[ -n "$DHCP_HOSTS" ]]
    if (env.DHCP_HOSTS.length > 0) {
        // for HOST in $DHCP_HOSTS; 
        for (env.HOST of iterateOver(env.DHCP_HOSTS)) {

            await $`echo dhcp-host=$HOST >> $CONFDIR/dnsmasq.conf`
        
        }
    }


    // [[ -n "$DNS_LOGFILE" ]]
    if (env.DNS_LOGFILE.length > 0) {
        await $`cat >> $CONFDIR/dnsmasq.conf`
    }
    // [[ "$SHARE_METHOD" == "none" && "$REDIRECT_TO_LOCALHOST" == "1" ]]
    if (env.SHARE_METHOD === `none`) {
        await $`cat >> $CONFDIR/dnsmasq.conf`
    }
}

// initialize WiFi interface
// [[ $NO_VIRT -eq 0 && -n "$NEW_MACADDR" ]]
if (env.NO_VIRT == 0) {
    await $`ip link set dev  address  || die ${env.VIRTDIEMSG}`
}

await $`ip link set down dev  || die ${env.VIRTDIEMSG}`
await $`ip addr flush  || die ${env.VIRTDIEMSG}`

// [[ $NO_VIRT -eq 1 && -n "$NEW_MACADDR" ]]
if (env.NO_VIRT == 1) {
    await $`ip link set dev  address  || die`
}

// [[ "$SHARE_METHOD" != "bridge" ]]
if (env.SHARE_METHOD !== `bridge`) {
    await $`ip link set up dev  || die ${env.VIRTDIEMSG}`
    await $`ip addr add $GATEWAY/24 broadcast $GATEWAY.255 dev  || die ${env.VIRTDIEMSG}`
}

// enable Internet sharing
// [[ "$SHARE_METHOD" != "none" ]]
if (env.SHARE_METHOD !== `none`) {
    console.log(`Sharing Internet using method: ${env.SHARE_METHOD}`)
    // [[ "$SHARE_METHOD" == "nat" ]]
    if (env.SHARE_METHOD === `nat`) {
        await $`iptables -w -t nat -I POSTROUTING -s $GATEWAY.0/24 ! -o  -j MASQUERADE || die`
        await $`iptables -w -I FORWARD -i  -s $GATEWAY.0/24 -j ACCEPT || die`
        await $`iptables -w -I FORWARD -i  -d $GATEWAY.0/24 -j ACCEPT || die`
        await $`echo 1 > /proc/sys/net/ipv4/conf/$INTERNET_IFACE/forwarding || die`
        await $`echo 1 > /proc/sys/net/ipv4/ip_forward || die`
        // to enable clients to establish PPTP connections we must
        // load nf_nat_pptp module
        await $`modprobe nf_nat_pptp`.stdout(...$stdout)
    // [[ "$SHARE_METHOD" == "bridge" ]]
    } else if (env.SHARE_METHOD === `bridge`) {
        // disable iptables rules for bridged interfaces
        // [[ -e /proc/sys/net/bridge/bridge-nf-call-iptables ]]
        if (fs.existsSync(`/proc/sys/net/bridge/bridge-nf-call-iptables`)) {
            await $`echo 0 > /proc/sys/net/bridge/bridge-nf-call-iptables`
        }

        // to initialize the bridge interface correctly we need to do the following:
        //
        // 1) save the IPs and route table of INTERNET_IFACE
        // 2) if NetworkManager is running set INTERNET_IFACE as unmanaged
        // 3) create BRIDGE_IFACE and attach INTERNET_IFACE to it
        // 4) set the previously saved IPs and route table to BRIDGE_IFACE
        //
        // we need the above because BRIDGE_IFACE is the master interface from now on
        // and it must know where is connected, otherwise connection is lost.
        // ! is_bridge_interface $INTERNET_IFACE
        if ((await is_bridge_interface(env.INTERNET_IFACE)) != 0) {
            console.log(`-n Create a bridge interface... `)
            env.OLD_IFS = env.IFS
            env.IFS = `
`

            env.IP_ADDRS = [await $.str`ip addr show ${env.INTERNET_IFACE} | grep -A 1 -E inet[[:blank:]] | paste - -`]
            env.ROUTE_ADDRS = [await $.str`ip route show dev ${env.INTERNET_IFACE}`]

            env.IFS = env.OLD_IFS

            // networkmanager_is_running
            if ((await networkmanager_is_running()) == 0) {
                await networkmanager_add_unmanaged(env.INTERNET_IFACE)
                await networkmanager_wait_until_unmanaged(env.INTERNET_IFACE)
            }

            // create bridge interface
            await $`ip link add name ${env.BRIDGE_IFACE} type bridge || die`
            await $`ip link set dev ${env.BRIDGE_IFACE} up || die`
            // set 0ms forward delay
            await $`echo -n 0 > /sys/class/net/$BRIDGE_IFACE/bridge/forward_delay`

            // attach internet interface to bridge interface
            await $`ip link set dev ${env.INTERNET_IFACE} promisc on || die`
            await $`ip link set dev ${env.INTERNET_IFACE} up || die`
            await $`ip link set dev ${env.INTERNET_IFACE} master ${env.BRIDGE_IFACE} || die`

            await $`ip addr flush ${env.INTERNET_IFACE}`
            // for x in "${IP_ADDRS[@]}"; 
            for (env.x of iterateOver(env.IP_ADDRS/* FIXME: IP_ADDRS[@] */)) {

                env.x = env.x/* FIXME: x/inet/ */
                env.x = env.x/* FIXME: x/secondary/ */
                env.x = env.x/* FIXME: x/dynamic/ */
                env.x = await $.str`echo ${env.x} | sed s/\\([0-9]\\)sec/\\1/g`
                env.x = env.x/* FIXME: x/${INTERNET_IFACE}/ */
                await $`ip addr add ${env.x} dev ${env.BRIDGE_IFACE} || die`
            
            }

            // remove any existing entries that were added from 'ip addr add'
            await $`ip route flush dev ${env.INTERNET_IFACE}`
            await $`ip route flush dev ${env.BRIDGE_IFACE}`

            // we must first add the entries that specify the subnets and then the
            // gateway entry, otherwise 'ip addr add' will return an error
            // for x in "${ROUTE_ADDRS[@]}"; 
            for (env.x of iterateOver(env.ROUTE_ADDRS/* FIXME: ROUTE_ADDRS[@] */)) {

                // [[ "$x" == default* ]]
                if (env.x === `default*`) {
                    continue
                }
                await $`ip route add ${env.x} dev ${env.BRIDGE_IFACE} || die`
            
            }

            // for x in "${ROUTE_ADDRS[@]}"; 
            for (env.x of iterateOver(env.ROUTE_ADDRS/* FIXME: ROUTE_ADDRS[@] */)) {

                // [[ "$x" != default* ]]
                if (env.x !== `default*`) {
                    continue
                }
                await $`ip route add ${env.x} dev ${env.BRIDGE_IFACE} || die`
            
            }

            console.log(`${env.BRIDGE_IFACE} created.`)
        }
    }
} else {
    console.log(`No Internet sharing`)
}

// start dhcp + dns (optional)
// [[ "$SHARE_METHOD" != "bridge" ]]
if (env.SHARE_METHOD !== `bridge`) {
    // [[ $NO_DNS -eq 0 ]]
    if (env.NO_DNS == 0) {
        env.DNS_PORT = 5353
        await $`iptables -w -I INPUT -p tcp -m tcp --dport ${env.DNS_PORT} -j ACCEPT || die`
        await $`iptables -w -I INPUT -p udp -m udp --dport ${env.DNS_PORT} -j ACCEPT || die`
        await $`iptables -w -t nat -I PREROUTING -s $GATEWAY.0/24 -d  -p tcp -m tcp --dport 53 -j REDIRECT --to-ports ${env.DNS_PORT} || die`
        await $`iptables -w -t nat -I PREROUTING -s $GATEWAY.0/24 -d  -p udp -m udp --dport 53 -j REDIRECT --to-ports ${env.DNS_PORT} || die`
    } else {
        env.DNS_PORT = 0
    }

    // [[ $NO_DNSMASQ -eq 0 ]]
    if (env.NO_DNSMASQ == 0) {
      await $`iptables -w -I INPUT -p udp -m udp --dport 67 -j ACCEPT || die`


      // apparmor does not allow dnsmasq to read files.
      // remove restriction.

      // COMPLAIN_CMD=$(command -v complain || command -v aa-complain)
      if (env.COMPLAIN_CMD = await $.str`command -v complain || command -v aa-complain`) {
        await $`${env.COMPLAIN_CMD} dnsmasq`
      }

      await $`umask 0033`
      await $`dnsmasq -C ${env.CONFDIR}/dnsmasq.conf -x ${env.CONFDIR}/dnsmasq.pid -l ${env.CONFDIR}/dnsmasq.leases -p ${env.DNS_PORT} || die`
      await $`umask ${env.SCRIPT_UMASK}`
    }
}

// start access point
console.log(`hostapd command-line interface: hostapd_cli -p ${env.CONFDIR}/hostapd_ctrl`)

// [[ $NO_HAVEGED -eq 0 ]]
if (env.NO_HAVEGED == 0) {
    await haveged_watchdog() /* FIXME: & */0
    env.HAVEGED_WATCHDOG_PID = env["!"]
}

// start hostapd (use stdbuf when available for no delayed output in programs that redirect stdout)
env.STDBUF_PATH = await $.str`which stdbuf`
// [ $? -eq 0 ]
if (env["?"] == 0) {
    env.STDBUF_PATH = `${env.STDBUF_PATH} -oL`
}
await $`${env.STDBUF_PATH} ${env.HOSTAPD} ${env.HOSTAPD_DEBUG_ARGS} ${env.CONFDIR}/hostapd.conf` /* FIXME: & */0
env.HOSTAPD_PID = env["!"]
await $`echo ${env.HOSTAPD_PID} > $CONFDIR/hostapd.pid`

// ! wait $HOSTAPD_PID
if ((await $`wait ${env.HOSTAPD_PID}`).code!=0)) {
    await $`echo -e 
Error: Failed to run hostapd, maybe a program is interfering. >&2`
    // networkmanager_is_running
    if ((await networkmanager_is_running()) == 0) {
        await $`echo If an error like 'n80211: Could not configure driver mode' was thrown >&2`
        await $`echo try running the following before starting create_ap: >&2`
        // [[ $NM_OLDER_VERSION -eq 1 ]]
        if (env.NM_OLDER_VERSION == 1) {
            await $`echo     nmcli nm wifi off >&2`
        } else {
            await $`echo     nmcli r wifi off >&2`
        }
        await $`echo     rfkill unblock wlan >&2`
    }
    await die()
}

await clean_exit()

// Local Variables:
// tab-width: 4
// indent-tabs-mode: nil
// End:

// vim: et sts=4 sw=4


console.log(`hi`); await $`something else`