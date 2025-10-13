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


function translate(node) {
    let usedVars = false
    let usedAliases = false
    function translateInner(node) {
        function convertArg(node) {
            // possible:
                // <raw_string>
                // <word>
                // <text> // for newline escapes
                // <string>
                // <concatenation>
                    // <word>
                    // <brace_expression>
                // <ansi_c_string> AKA $''
            if (node.type == "word") {
                let text = node.text
                text = text.replace(/\\([a]|[^a])/g, "$1")
                // TODO: glob expansion
                // TODO: some brace expansion ends up here
                // FIXME: probably some other special stuff like !
                return escapeJsString(text).slice(1, -1)
            } else if (node.type == "raw_string") {
                return node.text.slice(1, -1)
            } else if (node.type == "string") {
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
                console.debug(`<string> output is:`,output)
                return output
            } else if (node.type == "concatenation") {
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
            }
        }

        function convertArgs(nodes, {asArrayString=false, asArray=false, asSingleString=false} = {}) {
            let currentArg = []
            let createNewArg = true // this is to handle annoying edge cases by lazily creating new args
            const args = []
            let escapedNewline = false
            console.debug(`nodes.map(each=>each.text) is:`,nodes.map(each=>each.text))
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
                    return null
                }
                currentArg.push(...[converted].flat(Infinity))
            }
            
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
                return escapeJsString(argStrings.join(" "))
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
            } else {
                const nodesAfterCommandName = []
                let foundCommandName = false
                for (const each of node.children) {
                    if (each.type == "command_name") {
                        foundCommandName = true
                        continue
                    }
                    if (foundCommandName) {
                        nodesAfterCommandName.push(each)
                    }
                }
                const convertedArgs = convertArgs([ commandNameNode, ...nodesAfterCommandName ])
                if (convertedArgs == null) {
                    return fallbackTranslate(node)
                }
                return  "await $$"+convertedArgs
            }
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
    if (str.match(/^\w+$/)) {
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
