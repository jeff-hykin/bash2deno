import fs from "node:fs"
import * as dax from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts" // see: https://github.com/dsherret/dax
import * as path from "https://esm.sh/jsr/@std/path@1.1.2"
import { env, aliases, $stdout, $stderr, initHelpers, iterateOver } from "https://esm.sh/gh/jeff-hykin/bash2deno@0.1.0.2/helpers.js"
let { $, appendTo, overwrite, hasCommand, makeScope, settings, exitCodeOfLastChildProcess } = initHelpers({ dax })
// [ -n "$(command -v "deno")" ]
if ( hasCommand(`deno`)) {
  console.log(`hi`)
}