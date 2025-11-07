import { FileSystem, glob } from "https://deno.land/x/quickr@0.8.6/main/file_system.js"
import { parseArgs, flag, required, initialValue } from "https://deno.land/x/good@1.7.1.0/flattened/parse_args.js"
import { toCamelCase } from "https://deno.land/x/good@1.7.1.0/flattened/to_camel_case.js"
import { didYouMean } from "https://deno.land/x/good@1.7.1.0/flattened/did_you_mean.js"
import { translate } from './api.js'
import { version } from "./version.js"

// 
// check for help/version
// 
    const { help: showHelp, version: showVersion, } = parseArgs({
        rawArgs: Deno.args,
        fields: [
            [["--help", ], flag, ],
            [["--version"], flag, ],
        ],
    }).simplifiedNames
    if (showVersion) {
        console.log(version)
        Deno.exit(0)
    }
    if (showHelp) {
        console.log(`
    To Esm
        examples:
            bash2deno --help
            bash2deno --version
            
            # non-destructive
            bash2deno -- ./file1.js ./file2.js

            # destructive
            bash2deno --inplace ./file1.js
            bash2deno -i ./file1.js
        `)
        Deno.exit(0)
    }

// 
// parsing args
// 
    const output = parseArgs({
        rawArgs: Deno.args,
        fields: [
            [[ "--inplace", "-i"], flag, ],
        ],
        nameTransformer: toCamelCase,
        namedArgsStopper: "--",
        allowNameRepeats: true,
        valueTransformer: JSON.parse,
        isolateArgsAfterStopper: false,
        argsByNameSatisfiesNumberedArg: true,
        implicitNamePattern: /^(--|-)[a-zA-Z0-9\-_]+$/,
        implictFlagPattern: null,
    })
    didYouMean({
        givenWords: Object.keys(output.implicitArgsByName).filter(each=>each.startsWith(`-`)),
        possibleWords: Object.keys(output.explicitArgsByName).filter(each=>each.startsWith(`-`)),
        autoThrow: true,
    })
    
    // console.debug(`output is:`,output)
    const {
        inplace,
    } = output.simplifiedNames
    let filePaths = output.argList
// 
// 
// main logic
// 
// 
    const fileInfos = await Promise.all(filePaths.map(each=>FileSystem.info(each)))
    const folders = fileInfos.filter(each=>each.isDirectory).map(each=>each.path)
    filePaths = fileInfos.filter(each=>!each.isDirectory).map(each=>each.path)
    let extraPaths = []
    for (const each of folders) {
        extraPaths = extraPaths.concat(await FileSystem.listFilePathsIn(each, {recursively: true}))
    }
    extraPaths = extraPaths.filter(
        eachPath=>extensionsToConvert.some(
            anExtension=>eachPath.endsWith(anExtension)
        )
    )
    filePaths = filePaths.concat(extraPaths)

    const promises = []
    for (const eachPath of filePaths) {
        promises.push(FileSystem.read(eachPath).then(async (data)=>{
            if (data) {
                console.log(`converting ${eachPath}`)
                let { jsCode, xmlStylePreview } = translate(data)
                // add shebang
                jsCode = "#!/usr/bin/env -S deno run --allow-all\n"+ jsCode
                if (inplace) {
                    await FileSystem.write({ data: jsCode, path: eachPath, overwrite: true})
                } else {
                    await FileSystem.write({ data: jsCode, path: eachPath.replace(/\.\w+$/,"")+".js", overwrite: true})
                }
            }
        }))
    }
    await Promise.all(promises)
