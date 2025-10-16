#!/usr/bin/env -S deno run --allow-all
import { FileSystem, glob } from "https://deno.land/x/quickr@0.8.7/main/file_system.js"
import { translate } from "./api.js"

const advanced = translate(await FileSystem.read(`${FileSystem.thisFolder}/examples/advanced.sh`))
await FileSystem.write({path:`${FileSystem.thisFolder}/examples/advanced.sh.xml`, data: advanced.xmlStylePreview, overwrite: true})
await FileSystem.write({path:`${FileSystem.thisFolder}/examples/advanced.sh.js`, data: advanced.jsCode, overwrite: true})

const main = translate(await FileSystem.read(`${FileSystem.thisFolder}/examples/main.sh`))
await FileSystem.write({path:`${FileSystem.thisFolder}/examples/main.sh.xml`, data: main.xmlStylePreview, overwrite: true})
await FileSystem.write({path:`${FileSystem.thisFolder}/examples/main.sh.js`, data: main.jsCode, overwrite: true})