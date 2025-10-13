import $ from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts"
import { env } from "https://deno.land/x/quickr@0.8.6/main/env.js"
const $$ = (...args)=>$(...args).noThrow()

// ========== VARIABLE ASSIGNMENT ==========
env.name = `Alice`
env.name = `Alice`
env.app_version = `1.2.3`
////number=42
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
////counter=0
////while [[ $counter -lt 3 ]]; do
////  echo "Counter: $counter"
////  ((counter++))
////done

// ========== PARAMETER EXPANSION ==========

////echo unquoted
////echo unquoted two
////echo unquoted\ with\ spaces
////echo newline\
////    continued // trailing comment
////echo splat*
////echo doubleSplat**
////echo range{1..3}
////echo range{1..10..2}
////echo 'single quote'
////echo 'single quote\
////    '
////echo 'single quote'"'"'hi'
////echo $'single dollar'
////echo quote'connection'
////echo "double quote"
////echo double" quote connection"
////echo "double quote with escapes \""
////echo "double $dollar"
////echo "double subshell $(echo hi)"
////echo $dollar'connection'
////echo `back ticks`
////echo "Greeting: ${greeting}"
////echo "Greeting upper: ${greeting^^}"      // Uppercase
////echo "Greeting length: ${#greeting}"      // Length
////echo "Default fallback: ${undefined_var:-DefaultVal}" // Default if unset
env.filename = `archive.tar.gz`
////echo "Base name: ${filename%%.*}"         // Remove longest match from end
////echo "Extension: ${filename##*.}"         // Remove longest match from start

// ========== COMMANDS & PIPING ==========

////echo "User processes:"
////ps aux | grep "$USER" | grep -v grep
////
////# ========== CHAINING ==========
////mkdir -p /tmp/demo && echo "Created demo dir" || echo "Failed to create dir"

// ========== ESCAPING ==========

////echo "This is a quote: \" and this is a backslash: \\"

// ========== CALL FUNCTION ==========
////say_hello "$name"
////greet "Bob"

// ========== END ==========
////echo "Script completed successfully!"
