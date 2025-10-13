#!/usr/bin/env -S deno run --allow-all
import { createParser } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js"
import { xmlStylePreview } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/extras/xml_style_preview.js"
import bash from "https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/bash.js"
import { FileSystem, glob } from "https://deno.land/x/quickr@0.8.7/main/file_system.js"
import { escapeJsString } from 'https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/escape_js_string.js'
import { isValidKeyLiteral } from 'https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/is_valid_key_literal.js'
import { zipLong } from 'https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/zip_long.js'
import { translate } from "./api.js"
const parser = await createParser(bash) // path or Uint8Array
const code = await FileSystem.read(`${FileSystem.thisFolder}/examples/main.sh`)
var tree = parser.parse(code)
var root = tree.rootNode

await FileSystem.write({path:`${FileSystem.thisFolder}/examples/main.sh.xml`, data: xmlStylePreview(root), overwrite: true})


await FileSystem.write({path:`${FileSystem.thisFolder}/examples/main.sh.js`, data: translate(code), overwrite: true})
