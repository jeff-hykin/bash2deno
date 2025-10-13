import $ from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts"
import { env } from "https://deno.land/x/quickr@0.8.6/main/env.js"
const $$ = (...args)=>$(...args).noThrow()
const $stderr = [ Deno.stderr.readable, {preventClose:true} ]
const appendTo = (pathString)=>$.path(pathString).openSync({ write: true, create: true, truncate: false })

// ========== VARIABLE ASSIGNMENT ==========
env.name = `Alice`
env.name = `Alice`
env.app_version = `1.2.3`
env.number = `42`
env.greeting = `Hello, ${env.name}!`
////unset number

// ========== SET OPTIONS ==========
////set -euo pipefail  // Exit on error, undefined var is error, and pipe fails propagate

// ========== FUNCTION DEFINITION ==========
////say_hello() {
////  local who="${1:-World}"  # Default parameter
////  echo "Hello, $who!"
////}

// ========== ALIASES ==========
////alias ll='ls -lah'
////alias greet='say_hello'

// ========== CONTROL FLOW ==========

// IF-ELSE
////if [[ "$name" == "Alice" ]]; then
////  echo "Hi Alice!"
////elif [[ "$name" == "Bob" ]]; then
////  echo "Hi Bob!"
////else
////  echo "Who are you?"
////fi

// FOR LOOP
////for i in {1..3}; do
////  echo "Loop #$i"
////done

// WHILE LOOP
env.counter = `0`
////while [[ $counter -lt 3 ]]; do
////  echo "Counter: $counter"
////  ((counter++))
////done

// ========== PARAMETER EXPANSION ==========

console.log(`unquoted`)
console.log(`unquoted two`)
console.log(`unquoted with spaces`)
console.log(`newline continued`) // trailing comment
console.log(`splat*`)
console.log(`doubleSplat**`)
console.log(`range{1..3}`)
console.log(`range{1..10..2}`)
console.log(`single quote`)
console.log(`single quote\\
    `)
console.log(`single quote'hi`)
console.log(`single dollar`)
console.log(`quoteconnection`)
console.log(`double quote`)
console.log(`double quote connection`)
console.log(`double quote with escapes "`)
console.log(`double ${env.dollar}`)
////echo "double subshell $(echo hi)"
console.log(`dollaconnection`)
////echo `backticks`
console.log(`Greeting: ${env.greeting}`)
console.log(`Greeting upper: \${greeting^^}`)      // Uppercase
console.log(`Greeting length: \${#greeting}`)      // Length
console.log(`Default fallback: \${undefined_var:-DefaultVal}`) // Default if unset
env.filename = `archive.tar.gz`
console.log(`Base name: \${filename%%.*}`)         // Remove longest match from end
console.log(`Extension: \${filename##*.}`)         // Remove longest match from start

// ========== REDIRECTS ==========

console.log(`User processes:`)
await $$`ps aux`
await $$`ps aux > /dev/null`
await $$`ps aux`.stdout("null").stderr("null")
await $$`ps aux`.stdout("null").stderr("null")
await $$`ps aux`.stdout(appendTo(`./somefile`)).stderr(appendTo(`./somefile`))
await $$`ps aux`.stdout(appendTo(`./somefile${env.number}`)).stderr(appendTo(`./somefile${env.number}`))
await $$`ps aux`.stdout(appendTo(`./somefile${env.number}`)).stderr(appendTo(`./somefile${env.number}`))
await $$`ps aux`.stdout(...$stderr).stderr(...$stderr)
await $$`ps aux 2> >(cat)`

// ========== PIPES ==========
await $$`ps aux | grep ${env.USER}`
////ps aux | grep "$USER" | grep -v "double pipe"
////ps aux | grep "$USER" | grep -v "double pipe and" > /dev/null
////# hi
////ps aux &>/dev/null | grep "$USER"
////ps aux 1>&2 2>/dev/null | grep "$USER"
await $$`ps aux | grep ${env.USER} | grep '-v' grep`
////cat <<< 'hello'
////ls somefile thatdoesnotexist 1>/dev/null 2> >(grep "No such")
////diff <(ls dir1) <(ls dir2)
////paste <(ls dir1) <(ls dir2)

// ========== CHAINING ==========
await $$`mkdir '-p' '/tmp/demo'`
////mkdir -p /tmp/demo && echo "Created demo dir"
////mkdir -p /tmp/demo && echo "Created demo dir" || echo "Failed to create dir"

// ========== ESCAPING ==========

console.log(`This is a quote: " and this is a backslash: \\`)

// ========== CALL FUNCTION ==========
await $$`say_hello ${env.name}`
await $$`greet Bob`

// ========== END ==========
console.log(`Script completed successfully!`)
