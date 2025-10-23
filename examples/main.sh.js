#!/usr/bin/env -S deno run --allow-all
import fs from "node:fs"
import * as dax from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts" // see: https://github.com/dsherret/dax
import * as path from "https://esm.sh/jsr/@std/path@1.1.2"
import { env, aliases, $stdout, $stderr, initHelpers, iterateOver } from "https://esm.sh/gh/jeff-hykin/bash2deno@0.1.0.2/helpers.js"
let { $, appendTo, overwrite, hasCommand, makeScope, settings, exitCodeOfLastChildProcess } = initHelpers({ dax })


// ========== VARIABLE ASSIGNMENT ==========
env.name = `Alice`
env.name = `Alice`
env.app_version = `1.2.3`
env.number = 42
env.greeting = `Hello, ${env.name}!`
env.file_count = await $.str`ls | wc -l`
delete env.number

// ========== ALIASES ==========
aliases.ll = `ls -lah`
aliases.greet = `say_hello`

// ========== redirect/pipes/chaining ==========
console.log(``)
console.log(`hi{1..${env.number}}`) // not a real range in bash (only in zsh)
console.log(`hi{1..<asJsBacktickStringInnards>${env.number}</asJsBacktickStringInnards>}`) // not a real range in bash (only in zsh)
console.log(`double with subshell <asJsBacktickStringInnards>hi</asJsBacktickStringInnards>`)
console.log(`double subshell <asJsBacktickStringInnards><asJsBacktickStringInnards>subsub</asJsBacktickStringInnards></asJsBacktickStringInnards>`)
console.log(`${env.dollar}connection`)
console.log(``)
console.log(`Greeting: $greeting`)
console.log(`Greeting upper: $greeting`)      // Uppercase
await $`ps aux > /dev/null`
await $`ps aux`.stdout("null").stderr("null")
await $`echo aux | echo ${env.USER}`
await $`ps aux | grep ${env.USER} | grep -v double pipe`;
await $`mkdir -p /tmp/demo && echo Created demo dir && echo Created demo dir && echo Created demo dir`

// ========== CONTROL FLOW ==========

console.log(`Are you sure?`);env.ANSWER = prompt();console.log(``)
// [ ! "$ANSWER" =~ ^[Yy] ]
if (env.ANSWER.match(/^[Yy]/)) {
    await $`exit 1`
}

for (env.arg of Deno.args) {

    console.log(`${env.arg}`)

}

// WHILE LOOP
env.counter = 0
while (env.counter < 3) {

  console.log(`Counter: ${env.counter}`)
  await $`((counter++))`

}

// IF-ELSE
// [[ "$name" == "Alice" ]]
if (env.name === `Alice`) {
  console.log(`Hi Alice!`)
// [[ "$name" == "Bob" ]]
} else if (env.name === `Bob`) {
  console.log(`Hi Bob!`)
} else {
  console.log(`Who are you?`)
}

env.question = `question? [y/n]`;env.answer = ``
while (true) {

    break;
    continue;
    console.log(`${env.question}`); env.response = prompt()
    /* FIXME: case "$response" in
        [Yy]* ) answer='yes'; break;;
        [Nn]* ) answer='no'; break;;
        * ) echo "Please answer yes or no.";;
    esac */0

}

// [ "$answer" = 'yes' ]
if (env.answer === `yes`) {
    await $`do_something`
} else {
    await $`do_something_else`
}


// if curl exists
// [ -n "$(command -v "curl")" ]
if ( hasCommand(`curl`)) {
    await $`curl -s https://example.com`
}

// if name_of_command doesnt exist
// [ -z "$(command -v "name_of_command")" ]
if (! hasCommand(`name_of_command`)) {
    await $`: hji`
}

// FOR LOOP
for (env.i = 1; env.i <= 3; env.i++) {

  console.log(`Loop #${env.i}`)

}
// for each argument (in a argument-might-have-spaces friendly way)
for (env.arg of Deno.args) {

    console.log(`${env.arg}`)

}

// WHILE LOOP
env.counter = 0
while (env.counter < 3) {

  console.log(`Counter: ${env.counter}`)
  await $`((counter++))`

}

// ========== PARAMETER EXPANSION ==========

console.log(`unquoted`)
console.log(`unquoted two`)
console.log(`unquoted\\ with\\ spaces`)
console.log(`newline continued`) // trailing comment
console.log(`splat*`)
console.log(`doubleSplat**`)
console.log(``)
console.log(`range{1..10..2}`)
console.log(`single quote`)
console.log(`single quote\\\n    `)
console.log(`single quote'hi`)
console.log(`single dollar`)
console.log(`quoteconnection`)
console.log(`double quote`)
console.log(`double quote connection`)
console.log(`double quote with escapes "`)
console.log(`double ${env.dollar}`)
console.log(`double with subshell <asJsBacktickStringInnards>hi</asJsBacktickStringInnards>`)
console.log(`double subshell <asJsBacktickStringInnards><asJsBacktickStringInnards>subsub</asJsBacktickStringInnards></asJsBacktickStringInnards>`)
console.log(`${env.dollar}connection`)
console.log(``)
console.log(`Greeting: $greeting`)
console.log(`Greeting upper: $greeting`)      // Uppercase
console.log(`Greeting length: $greeting`)      // Length
console.log(`Default fallback: $undefined_var`) // Default if unset
env.filename = `archive.tar.gz`
console.log(`Base name: $filename`)         // Remove longest match from end
console.log(`Extension: $filename`)         // Remove longest match from start

// ========== REDIRECTS ==========

console.log(`User processes:`)
await $`ps aux`
await $`ps aux > /dev/null`
await $`ps aux`.stdout("null").stderr("null")
await $`ps aux`.stdout("null").stderr("null")
await $`ps aux`.stdout(appendTo(`./somefile`)).stderr(appendTo(`./somefile`))
await $`ps aux`.stdout(appendTo(`./somefile${env.number}`)).stderr(appendTo(`./somefile${env.number}`))
await $`ps aux`.stdout(appendTo(`./somefile$number`)).stderr(appendTo(`./somefile$number`))
await $`ps aux`.stdout("null")
await $`tar -cf  .`
await $`ls somefile thatdoesnotexist`.stdout(overwrite(`err`))

// ========== PIPES ==========
await $`ps aux | grep ${env.USER}`
await $`ps aux | echo ${env.USER}`
await $`echo aux | echo ${env.USER}`
// alsdkjfasdj
await $`ps aux | grep ${env.USER} | grep -v double pipe`;
// alsdkjfasdj
await $`ps aux | grep ${env.USER} | grep -v double pipe and > /dev/null`;
// hi
/* FIXME: ps aux &>/dev/null | grep "$USER" */0;
/* FIXME: ps aux 1>&2 2>/dev/null | grep "$USER" */0;
await $`ps aux | grep ${env.USER} | grep -v grep`;
// TODO: tree-sitter parser doesn't like this part without semicolons for some reason
await $`cat `;
await $`diff  `;
await $`paste  `;

// ========== CHAINING ==========
await $`mkdir -p /tmp/demo || echo hi`
await $`mkdir -p /tmp/demo && echo Created demo dir && echo Created demo dir && echo Created demo dir`
await $`mkdir -p /tmp/demo && echo Created demo dir || echo Failed to create dir`
await $`mkdir -p /tmp/demo && echo Created demo dir || echo Created demo dir && echo Created demo dir`

// ========== ESCAPING ==========

console.log(`This is a quote: " and this is a backslash: \\`)

// ========== CALL FUNCTION ==========
await $`say_hello ${env.name}`
await $`greet Bob`

// ========== END ==========
console.log(`Script completed successfully!`)

// ========== SET OPTIONS ==========
/* FIXME: set -euo pipefail */0  // Exit on error, undefined var is error, and pipe fails propagate

// ========== FUNCTION DEFINITION ==========
// FIXME: you'll need to custom verify this function usage: say_hello
async function say_hello(...args) { const { local, env } = makeScope({ args })

  local.who = env["1"]/* FIXME: 1:-World */  // Default parameter
  console.log(`Hello", ${env.who}!`)

}