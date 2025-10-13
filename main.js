#!/usr/bin/env -S deno run --allow-all
import { createParser } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js"
import { xmlStylePreview } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/extras/xml_style_preview.js"
import bash from "https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/bash.js"
import { FileSystem, glob } from "https://deno.land/x/quickr@0.8.4/main/file_system.js"
import { escapeJsString } from 'https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/escape_js_string.js'
import { isValidKeyLiteral } from 'https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/is_valid_key_literal.js'
import { zipLong } from 'https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/zip_long.js'
const parser = await createParser(bash) // path or Uint8Array
const code = await FileSystem.read(`${FileSystem.thisFolder}/examples/main.sh`)
var tree = parser.parse(code)
var root = tree.rootNode

await FileSystem.write({path:`${FileSystem.thisFolder}/examples/main.sh.xml`, data: xmlStylePreview(root), overwrite: true})

// 1.0 goal:
    // basic redirection
    // chained pipeline
    // unset
    // && ||
    // if elif else
        // string compare
        // number compare
        // is executable
        // is file
        // is directory
    // basic for loops
    // sub shells
    // splats
// 2.0 goal:
    // env for specific command. E.g. `PATH=/bin echo`
    // backticks
    // alias
    // has-command (which and $(command -v ))
    // function
    // set pipefail
    // heredocs
    // diff <(ls dir1) <(ls dir2)
// 3.0 goal:
    // background tasks (&)
    // arrays

function translate(node) {
    let usedVars = false
    let usedStdout = false
    let usedStderr = false
    let usedAliases = false
    let usedOverwrite = false
    let usedAppend = false
    function translateInner(node) {
        function convertArg(node) {
            // possible:
                // <raw_string>
                // <word>
                // <number>
                // <text> // for newline escapes
                // <command_substitution>
                // <simple_expansion>
                // <command_name>
                // <string>
                // <brace_expression>
                // <expansion>
                // <command_substitution>
                // <concatenation>
                // <ansi_c_string> AKA $''
            if (node.type == "word"||node.type == "number") {
                let text = node.text
                text = text.replace(/\\([a]|[^a])/g, "$1")
                // TODO: glob expansion
                // TODO: some brace expansion ends up here
                // FIXME: probably some other special stuff like !
                return escapeJsString(text).slice(1, -1)
            } else if (node.type == "raw_string") {
                return escapeJsString(node.text.slice(1, -1)).slice(1, -1)
            } else if (node.type == "string" || node.type == "simple_expansion") {
                let text = node.text.slice(1, -1)
                // FIXME: handle sub-shell better
                if (text.match(/(?<!\\)(\\\\)*\$\(/)) {
                    // Fail for now
                    return null
                }
                const patternForSimpleVarExpansion = /(?<=^(?:\\\\)*|[^\\](?:\\\\)*)\$(?:(\w+)\b|\{(\w+)\})/g
                // need to make all groups non-capturing for split
                const patternForSplit =              /(?<=^(?:\\\\)*|[^\\](?:\\\\)*)\$(?:(?:\w+)\b|\{(?:\w+)\})/g
                const simpleExpansionNames = text.matchAll(patternForSimpleVarExpansion).map(each=>each[1]||each[2])
                const otherTexts = text.split(patternForSplit).map(each=>escapeJsString(bashUnescape(each)).slice(1, -1))
                const simpleEnvInterpolates = simpleExpansionNames.map(each=>{
                    usedVars = true
                    const out = ()=>`\${env${escapeJsKeyAccess(each)}}`
                    // for easy joining later
                    out.toString = out
                    return out
                })
                let output = [...zipLong(otherTexts, simpleEnvInterpolates)].flat(1).slice(0,-1)
                return output
            } else if (node.type == "concatenation" || node.type == "command_name") {
                return node.children.map(convertArg)
            } else if (node.type == "brace_expression") {
                // FIXME
                return node.text
            } else if (node.type == "ansi_c_string") {
                let text = node.text.slice(2, -1)
                text = bashUnescape(text)
                text = escapeJsString(text).slice(1, -1)
                // FIXME: this is not how ansi_c_string's work
                return text
            } else {
                console.warn(`unhandled node type:`,node.type)
                return null
            }
        }

        function convertArgs(nodes, {asArrayString=false, asArray=false, asSingleString=false} = {}) {
            let currentArg = []
            let createNewArg = true // this is to handle annoying edge cases by lazily creating new args
            const args = []
            let escapedNewline = false
            // console.debug(`nodes.map(each=>each.text) is:`,nodes.map(each=>each.text))
            for (const eachNode of nodes) {
                // 
                // find argument splitter
                // 
                if (eachNode.type == "text" && eachNode.text == "\\") {
                    escapedNewline = true
                    continue
                }
                if (eachNode.type == "whitespace") {
                    // concat case. Note if whitespace is "\n   " (not just "\n") then it does split arguments
                    if (escapedNewline && eachNode.text == "\n") {
                        continue
                    }
                    // next argument
                    createNewArg = true
                    continue
                }
                escapedNewline = false
                
                if (createNewArg) {
                    createNewArg = false
                    currentArg = []
                    args.push(currentArg)
                }
                const converted = convertArg(eachNode)
                // fail
                if (converted == null) {
                    console.warn(`failed to convert arg:`,eachNode.text)
                    return null
                }
                currentArg.push(...[converted].flat(Infinity))
            }
            
            // args should be an array of array of (strings or functions)
                // each function returns a string
                // each string is js backticks escaped
            // console.debug(`args is:`,args)

            // TODO: handle the case of part of an arg being a function (e.g. splat, range, subshell, etc)
            if (asArray) {
                return args.map(each=>each.join(""))
            } else if (asSingleString) {
                return `\`${args.map(each=>each.join("")).join(" ")}\``
            } else if (asArrayString) {
                return `[${args.map(each=>`\`${each.join("")}\``).join(", ")}]`
            } else {
                const argStrings = []
                // check if no quotes needed, bash quotes only, or full js escaping needed
                for (const each of args) {
                    let noQuotesNeeded = true
                    let onlyBashQuotesNeeded = true
                    const aggregated = aggregateStrings(each)
                    argStrings.push(
                        aggregated.map(each=>{
                            if (typeof each == 'string') {
                                return shellEscapeArg(each)
                            } else {
                                return each.toString()
                            }
                        }).join("")
                    )
                }
                return "`"+argStrings.join(" ")+"`"
            }
        }
        const fallbackTranslate = (node)=>"////" + node.text.replace(/\n/g, "\n////")
        if (node.type == "program") {
            const contents = node.children.map(translateInner).join("")
            const imports = [
                `import $ from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts"`,
            ]
            const helpers = [
                `const $$ = (...args)=>$(...args).noThrow()`,
            ]
            if (usedVars) {
                imports.push(`import { env } from "https://deno.land/x/quickr@0.8.6/main/env.js"`)
            }
            if (usedStdout) {
                helpers.push(`const $stdout = [ Deno.stdout.readable, {preventClose:true} ]`)
            }
            if (usedStderr) {
                helpers.push(`const $stderr = [ Deno.stderr.readable, {preventClose:true} ]`)
            }
            if (usedAppend) {
                helpers.push(`const appendTo = (pathString)=>$.path(pathString).openSync({ write: true, create: true, truncate: false })`)
            }
            if (usedOverwrite) {
                helpers.push(`const overwrite = (pathString)=>$.path(pathString).openSync({ write: true, create: true })`)
            }
            return imports.concat(helpers).join("\n")+contents
        } else if (node.type == "whitespace") {
            return node.text
        // 
        // comments
        // 
        } else if (node.type == "comment") {
            if (node.text.startsWith("#!/")) {
                return ""
            }
            return "//"+node.text.slice(1)
        } else if (node.type == ";") {
            return ";"
        // 
        // var assignment
        // 
        } else if (node.type == "declaration_command") {
            const varAssignmentNode = node.quickQueryFirst(`(variable_assignment) @name`).name
            if (varAssignmentNode) {
                return translateInner(varAssignmentNode)
            } else {
                return fallbackTranslate(node)
            }
        } else if (node.type == "variable_assignment") {
            usedVars = true
            // FIXME: handle exported vars
            let varNameNode
            try {
                varNameNode = node.quickQueryFirst(`(variable_name) @name`).name
            } catch {
            }
            // fail
            if (!varNameNode) {
                return fallbackTranslate(node)
            }
            let foundEquals = false
            const argNodes = []
            for (let each of node.children) {
                if (each.type == "=") {
                    foundEquals = true
                    continue
                }
                if (foundEquals) {
                    argNodes.push(each)
                }
            }
            // NOTE: this could cause some problems for exported VS non-exported vars
            //       deno effectively exports all of them
            usedVars = true
            // note: all internals are already escaped for JS
            const convertedArgs = convertArgs(argNodes, {asSingleString: true})
            if (convertedArgs == null) {
                return fallbackTranslate(node)
            }
            return `${node.indent}env${escapeJsKeyAccess(varNameNode.text)} = ${convertedArgs}`
        // 
        // command/alias
        // 
        } else if (node.type == "command") {
            // NOTE: alias is part of command
            // FIXME: command_name
            const commandNameNode = node.quickQueryFirst(`(command_name) @nameNode`).nameNode
            if (commandNameNode.text == "alias") {
                // 
                // alias
                // 
                // TODO: handle alias by shimming $ to check/substitute aliases before calling dax
                return fallbackTranslate(node)
            } else if (commandNameNode.text == "set") {
                // 
                // set
                // 
                return fallbackTranslate(node)
            } else if (commandNameNode.text == "echo") {
                // slice gets rid of "echo "
                // TODO: handle echo -n
                const convertedArgs = convertArgs(node.children, {asArray: true})
                if (convertedArgs == null) {
                    return fallbackTranslate(node)
                }
                const args = convertedArgs.slice(1)
                // NOTE: args are already escaped for specifically JS backticks
                return `console.log(\`${args.join(" ")}\`)`
            } else {
                const convertedArgs = convertArgs(node.children)
                if (convertedArgs == null) {
                    return fallbackTranslate(node)
                }
                return  "await $$"+convertedArgs
            }
        } else if (node.type == "redirected_statement") {
            // <redirected_statement>
            //     <command>
            //         <command_name>
            //             <word text="ps" />
            //         </command_name>
            //         <whitespace text=" " />
            //         <word text="aux" />
            //     </command>
            //     <whitespace text=" " />
            //     <file_redirect>
            //         <file_descriptor text="2" />
            //         <">" text=">" />
            //         <word text="/dev/null" />
            //     </file_redirect>
            // </redirected_statement>
            const commandNode = node.quickQueryFirst(`(command)`)
            const redirects = node.quickQuery(`(file_redirect)`)
            const parseOutputRedirect = (redirectNode)=>{
                const maybeFdNode = redirectNode.quickQueryFirst(`(file_descriptor)`)
                const output = {
                    source: null,
                    method: "overwrite",
                    target: null,
                }
                const maybeProcessSubstitutionNode = redirectNode.quickQueryFirst(`(process_substitution)`)
                if (maybeProcessSubstitutionNode) {
                    // TODO: handle process substitution
                    console.warn(`unsupported redirect:`,redirectNode.text)
                    return null
                }
                
                // handle edgecase (kind of a problem with the tree-sitter parser)
                const text = redirectNode.text.trim()
                if (!maybeFdNode) {
                    if (!text.match(/^&/)) {
                        console.warn(`unsupported redirect:`,redirectNode.text)
                        return null
                    }
                    output.source = "&"
                    if (text.match(/^&\s*>>/)) {
                        output.method = "append"
                    }
                } else {
                    let sourceNode = redirectNode.quickQueryFirst(`(file_descriptor)`)
                    if (!sourceNode) {
                        output.source = "1"
                    } else {
                        output.source = sourceNode.text
                    }
                }
                
                const rawTarget = text.replace(/^(&|1|2)?\s*>>?\s*/, "")
                if (rawTarget == "/dev/null") {
                    // already done: (default value)
                    // output.target = null
                    output.target = `"null"`
                } else if (rawTarget.startsWith("&")) {
                    console.debug(`rawTarget is:`,rawTarget)
                    if (rawTarget == "&1") {
                        usedStdout = true
                        output.target = `...$stdout`
                    } else if (rawTarget == "&2") {
                        usedStderr = true
                        output.target = `...$stderr`
                    } else {
                        console.warn(`unsupported redirect target:`,redirectNode.text)
                        return null
                    }
                // file target
                } else {
                    const asJsString = convertArgs(redirectNode.children.filter(each=>![">",">>", "&>", "&>>",">&",">>&","process_substitution","file_descriptor"].includes(each.type)), {asSingleString: true})
                    let extraOption = ""
                    if (output.method == "append") {
                        usedAppend = true
                        output.target = `appendTo(${asJsString})`
                    } else {
                        usedOverwrite = true
                        output.target = `overwrite(${asJsString})`
                    }
                }

                return output
            }
            const convertRedirectTargetToJsString = (target)=>{
                const isFdTarget = target.startsWith("&")
                let extraOption = ""
                // FIXME
                if (false) {
                    extraOption = ", truncate: false"
                }
                target = `$.path(${escapeJsString(target)}).openSync({ write: true, create: true${extraOption} })`
                if (isFdTarget) {
                    text = text.slice(1)
                    if (text == "1") {
                        usedStdout = true
                        target = `...$stdout`
                    } else if (text == "2") {
                        usedStderr = true
                        target = `...$stderr`
                    } else {
                        console.warn(`unsupported redirect target:`,redirects[0].text)
                        return null
                    }
                }
                return target
            }
            if (redirects.length == 1) {
                const convertedArgs = convertArgs(commandNode.children)
                if (convertedArgs == null) {
                    return fallbackTranslate(node)
                }
                // manually handle combined redirect
                if (redirects[0].text[0] == "&") {
                    const redirect = parseOutputRedirect(redirects[0])
                    console.debug(`redirect is:`,redirect)
                    if (!redirect) {
                        return fallbackTranslate(node)
                    }
                    return `await $$${convertedArgs}.stdout(${redirect.target}).stderr(${redirect.target})`
                }
                return `await $$${convertedArgs.slice(0,-1)} ${redirects[0].text}\``
            } else {
                let stdoutTarget
                let stderrTarget
                for (const each of redirects) {
                    let redirect = parseOutputRedirect(each)
                    if (redirect == null) {
                        return fallbackTranslate(node)
                    }
                    if (redirect.source == "1" || redirect.source == "&") {
                        stdoutTarget = redirect.target
                    }
                    if (redirect.source == "2" || redirect.source == "&") {
                        stderrTarget = redirect.target
                    }
                }
                // bash is weird. This is for: ps aux > /dev/null 2>&1
                // both stdout and stderr are redirected to /dev/null
                // but here they're swapped: ps aux 1>&2 2>&1
                if (stdoutTarget == "...$stderr" && stderrTarget == "...$stdout") {
                    // swap case (do nothing)
                } else {
                    if (stdoutTarget && stderrTarget === "...$stdout") {
                        stderrTarget = stdoutTarget
                    }
                    if (stderrTarget && stdoutTarget === "...$stderr") {
                        stderrTarget = stdoutTarget
                    }
                }
                let stdoutString = ""
                let stderrString = ""
                if (stdoutTarget) {
                    stdoutString = `.stdout(${stdoutTarget})`
                }
                if (stderrTarget) {
                    stderrString = `.stderr(${stderrTarget})`
                }
                return `await $$${convertArgs(commandNode.children).slice(0,-1)}\`${stdoutString}${stderrString}`
            }
        } else if (node.type == "pipeline") {
            const commands = node.children.filter(each=>each.type == `command`||each.type == `redirected_statement`)
            const pipeInMiddle = commands.some(each=>each.type == `pipeline`&&each!=commands.at(-1))
            if (pipeInMiddle) {
                return fallbackTranslate(node)
            }
            const lastCommand = commands.at(-1)
            const lastCommandConverted = translateInner(lastCommand)
            console.debug(`lastCommandConverted is:`,lastCommandConverted)
            let failed = fallbackTranslate(lastCommand) == lastCommandConverted
            if (failed) {
                return fallbackTranslate(node)
            }
            const otherCommandsConverted = commands.slice(0,-1).map(each=>convertArgs(each.children))
            for (const [cmd, each] of zipLong(commands.slice(0,-1), otherCommandsConverted)) {
                if (each == null) {
                    failed = true
                    console.debug(`commands is:`,commands.map(xmlStylePreview).join("\n"))
                    console.warn(`failed to convert command:`,cmd.text)
                    break
                }
            }
            // check failed
            if (failed) {
                return fallbackTranslate(node)
            }
            // little bit hacky, cleanup later
            const lastPart = lastCommandConverted.replace(/^await \$\$\`/,"")
            const coreCommand = [ ...otherCommandsConverted.map(each=>each.slice(1,-1)), lastPart ].join(" | ")
            return `await $$\`${coreCommand}`
            // node.quickQueryFirst(`(command) @firstCommand`).firstCommand
            // return translateInner(node.children[0])
        // TODO:
            // if, elif, else
            // for, while
            // function
            // redirection
            // pipe
        // 
        // couldn't translate
        // 
        } else {
            return fallbackTranslate(node)
        }
    }
    return translateInner(node)
}

/**
 * @example
 * ```js
 * const input = 'Hello\\nWorld\\x21\\040\\$HOME\\\"';
 * const output = bashUnescape(input);
 * console.log(output);
 * // Output: Hello
 * //         World! $HOME"
 * ```
 */
function bashUnescape(str) {
    return str.replace(
        /\\(\\|"|a|b|e|E|f|n|r|t|v|\$|`|x[0-9A-Fa-f]{1,2}|[0-7]{1,3})/g,
        (match, seq) => {
            switch (seq) {
                case '\\': return '\\';
                case '"': return '"';
                case 'a': return '\x07';
                case 'b': return '\b';
                case 'e':
                case 'E': return '\x1B';
                case 'f': return '\f';
                case 'n': return '\n';
                case 'r': return '\r';
                case 't': return '\t';
                case 'v': return '\v';
                case '$': return '$';
                case '`': return '`';
                default:
                    if (/^x[0-9A-Fa-f]{1,2}$/.test(seq)) {
                        return String.fromCharCode(parseInt(seq.slice(1), 16))
                    }
                    if (/^[0-7]{1,3}$/.test(seq)) {
                        return String.fromCharCode(parseInt(seq, 8))
                    }
                    return match // fallback (shouldn't happen)
            }
        }
    )
}


function aggregateStrings(array) {
    const result = []
    for (const item of array) {
        const prev = result[result.length - 1]
        if (typeof item === "string" && typeof prev === "string") {
            result[result.length - 1] = prev + item
        } else {
            result.push(item)
        }
    }
    return result
}
function shellEscapeArg(str) {
    if (str.length == 0) {
        return ``
    }
    if (str.match(/^-*\w+$/)) {
        return str
    } else {
        return `'${str.replace(/'/g,`'"'"'`)}'`
    }
}

// 
// generic helpers
// 
function escapeJsKeyAccess(key) {
    if (isValidKeyLiteral(key)) {
        return `.${key}`
    } else {
        return `[${JSON.stringify(key)}]`
    }
}

await FileSystem.write({path:`${FileSystem.thisFolder}/examples/main.sh.js`, data: translate(root), overwrite: true})
