#!/usr/bin/env -S deno run --allow-all
import { createParser } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js"
import { xmlStylePreview } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/extras/xml_style_preview.js"
import bash from "https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@583b665/main/bash.js"
import { escapeJsString } from 'https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/escape_js_string.js'
import { isValidKeyLiteral } from 'https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/is_valid_key_literal.js'
import { zipLong } from 'https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/zip_long.js'
const parser = await createParser(bash) // path or Uint8Array

// 1.0 goal:
    // DONE: sub shells
    // DONE: fixup args/env special env
    // DONE: handle "$@"
    // DONE: basic redirection
    // DONE: chained pipeline
    // DONE: unset
    // DONE: && ||
    // DONE: alias
    // DONE if elif else
         // DONE: string compare
         // DONE: number compare
         // DONE: is executable
         // DONE: is file
         // DONE: is directory
    // DONE: basic for loops
    // DONE: backticks
    // DONE: has-command (which and $(command -v ))
    // DONE: basic $?
    // splats (might be fixed upstream soon)
    // OS checks
    // case 
    // functions
        // local vars
        // return values
        // set/use exitCodeOfLastChildProcess
    // unalias
    // heredocs
    // exec
    // warn on: trap
// 2.0 goal:
    // printf
    // while read line; do
    // process_substitution
    // unset function
    // handle $?
    // set pipefail
    // bracket sub shell echo hi && { echo bye; } && echo final
    // env for specific command. E.g. `PATH=/bin echo`
// 3.0 goal:
    // diff <(ls dir1) <(ls dir2)
    // background tasks (&)
    // arrays

const asCachedGetters = (obj)=>{
    const notCached = Symbol("not cached")
    for (const [key, actualGetter] of Object.entries(obj)) {
        let cachedValue = notCached 
        if (typeof actualGetter === 'function') {
            Object.defineProperty(obj, key, {
                get: ()=>{
                    if (cachedValue === notCached) {
                        cachedValue = actualGetter()
                    }
                    return cachedValue
                },
            })
        }
    }
    return obj
}

const escapeComment = (str)=>{
    return str.replace(/\*\//g, "* /")
}

const validAsUnquotedDaxArgNoInterpolation = (str)=>{
    return str.match(/^([\w\d+\-_\.]|"'")+$/)
}
const callMaybe = (fn)=>typeof fn === "function" ? fn() : fn
const multiply = ({argParts, items, id}) => {
    return items.values.map(
        multiplierValue=>
            argParts.map(eachPart=>{
                if (eachPart == id) {
                    return multiplierValue
                } else {
                    return eachPart
                }
            })
    )
}

const rangeToArray = (rangeString)=>{
    rangeString = rangeString.slice(1,-1)
    // "{apple,orange,lemon}"
    // "{1..3}"
    // not allowed: "{1..$thing}"
    // not allowed: "{1..$(echo "5")}"
    let match
    if (rangeString.includes(",")) {
        return rangeString.split(",")
    } else if (match=rangeString.match(/(\d+)\.\.(\d+)/)) {
        let output = []
        for (let i=match[1]-0; i<=match[2]-0; i++) {
            output.push(`${i}`)
        }
        return output
    } else {
        return [`{${rangeString}}`]
    }
}

/**
 * this just creates an array of arrays of nodes. Its a list of arguments
 */
const argAccumulator = (nodes) => {
    let currentArg = []
    let createNewArg = true // this is to handle annoying edge cases by lazily creating new args
    let escapedNewline = false
    const args = []
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
        currentArg.push(eachNode)
    }

    return args
}

const autofillOutputForms = (output)=>{
    if (output instanceof Array) {
        return output
    }
    if (output == null) {
        return null
    }
    if (typeof output === "string") {
        output = { asJsStatement: output }
    }
    // form
    let {
        // the output only need to be one or two of these, everything else will get autofilled
        asDaxArgUnquoted,
        asDaxArgSingleQuoteInnards,
        asDaxCommandInnardsPure,
        asDaxCommandInnardsRedirected,
        asDaxCommandInnardsChained,
        asDaxCallNoPostfix,
        asDaxCallRedirected,
        asDaxCallToString,
        asDaxCallSuccess,
        asDaxCallFail,
        asJsBacktickStringInnards,
        asJsBacktickString,
        asJsStringValue,
        asJsArray,
        asJsNumber,
        asJsValue,
        asJsConditional,
        asNegatedJsConditional,
        asJsStatement,
        ...other
    } = output
    let match
    let finalOutput = asCachedGetters({
        asDaxArgUnquoted,
        asDaxArgSingleQuoteInnards,
        asDaxSingleQuoted: ()=>asDaxArgSingleQuoteInnards??`'${asDaxArgSingleQuoteInnards}'`,
        asDaxCommandInnardsPure: asDaxCommandInnardsPure,
        asDaxCommandInnardsRedirected: asDaxCommandInnardsRedirected??(()=>finalOutput.asDaxCommandInnardsPure),
        asDaxCommandInnardsChained: asDaxCommandInnardsChained??(()=>finalOutput.asDaxCommandInnardsRedirected),
        asDaxCallNoPostfix: asDaxCallNoPostfix??(()=>(finalOutput.asDaxCommandInnardsChained&&`await $\`${finalOutput.asDaxCommandInnardsChained}\``)),
        asDaxCallRedirected: asDaxCallRedirected??(()=>finalOutput.asDaxCallNoPostfix),
        asDaxCallToString: asDaxCallToString??(()=>(finalOutput.asDaxCallNoPostfix && `${finalOutput.asDaxCallNoPostfix}.text()`)),
        asDaxCallToSub: asDaxCallToString??(()=>{
            if (finalOutput.asDaxCommandInnardsChained) {
                return `await $.str\`${finalOutput.asDaxCommandInnardsChained}\``
            } else if (finalOutput.asDaxCallRedirected) {
                const prefix = `await $\``
                return `await $.str\`${finalOutput.asDaxCallRedirected.slice(prefix.length)}`
            }
        }),
        asDaxCallSuccess: asDaxCallSuccess??(()=>(finalOutput.asDaxCallRedirected && `(${finalOutput.asDaxCallRedirected}).code==0)`)),
        asDaxCallFail: asDaxCallFail??(()=>(finalOutput.asDaxCallRedirected && `(${finalOutput.asDaxCallRedirected}).code!=0)`)),
        asJsBacktickStringInnards: asJsBacktickStringInnards??(()=>finalOutput.asDaxCallToString&&`\${${finalOutput.asDaxCallToString}}`),
        asJsBacktickString: asJsBacktickString??(()=>(finalOutput.asJsBacktickStringInnards && `\`${finalOutput.asJsBacktickStringInnards}\``)),
        asJsStringValue: asJsStringValue??(()=>{
            if (asJsNumber) {
                return `"${callMaybe(asJsNumber)}"`
            } else if (finalOutput.asJsBacktickString) {
                return finalOutput.asJsBacktickString
            } else {
                return finalOutput.asDaxCallToString
            }
        }),
        asJsArray: asJsArray,
        asJsNumber: asJsNumber??(()=>(finalOutput.asJsStringValue&&(match=finalOutput.asJsStringValue.match(/['"\`](\d+(?:\.[0-9]+)?)['"\`]/g))&&match[1])),
        asJsValue: asJsValue??(()=>finalOutput.asJsArray??finalOutput.asJsNumber??finalOutput.asJsStringValue??finalOutput.asDaxCallSuccess),
        asJsConditional: asJsConditional??(()=>finalOutput.asDaxCallSuccess??finalOutput.asJsValue),
        asNegatedJsConditional: asNegatedJsConditional??(()=>{
            if (asJsConditional != null) {
                return `!${asJsConditional}`
            } else if (finalOutput.asDaxCallRedirected) {
                return `(${finalOutput.asDaxCallRedirected}).code!=0)`
            }
        }),
        asJsStatement: asJsStatement??(()=>{
            if (finalOutput.asDaxCallNoPostfix) {
                return finalOutput.asDaxCallNoPostfix
            }
            return finalOutput.asJsValue
        }),
        replace: ()=>(...args)=>finalOutput.toString().replace(...args),
        match: ()=>(...args)=>finalOutput.toString().match(...args),
        slice: ()=>(...args)=>finalOutput.toString().slice(...args),
        ...other,
        toString: ()=>()=>finalOutput.asJsStatement,
    })
    finalOutput.original = output
    return finalOutput
}

/**
 * always returns an array of output forms
 *
 * @example
 * ```js
 * let a = convertArgParts([ { asJsValue: "10" }, { asJsValue: "'hi'" } ], { translateInner })
 * console.log(a[0].asJsValue) // `${10}hi`
 * ```
 */
function convertArgParts(argParts, { translateInner }) {
    if (argParts.length == 1) {
        return [ translateInner(argParts[0]) ]
    } else {
        let newArgs = [ argParts.map(translateInner) ]
        let multipliers = argParts.filter(each=>each.isMultiplier)
        for (const eachMultiplier of multipliers) {
            newArgs = newArgs.map(eachArgParts=>multiply({ argParts:eachArgParts, items: eachMultiplier.items, id: eachMultiplier })).flat(1)
        }
        // no multipliers allowed at this point
        return newArgs.map(argParts=>{
            const combined = {}
            if (argParts.length == 1) {
                return argParts[0]
            }

            for (let form of ["asDaxArgUnquoted", "asDaxArgSingleQuoteInnards", "asJsBacktickStringInnards", ]) {
                if (argParts.every(each=>each[form])) {
                    combined[form] = ()=>{
                        return argParts.map(each=>each[form]).join("")
                    }
                }
            }
            if (!combined.asDaxArgUnquoted) {
                let worked = true
                let chunks = []
                for (let each of argParts) {
                    if (each.asDaxArgUnquoted) {
                        chunks.push(each.asDaxArgUnquoted)
                    } else if (each.asJsBacktickStringInnards && validAsUnquotedDaxArgNoInterpolation(each.asJsBacktickStringInnards)) {
                        chunks.push(each.asJsBacktickStringInnards)
                    } else if (each.asJsValue) {
                        chunks.push(`\${${each.asJsValue}}`)
                    } else {
                        worked = false
                        break
                    }
                }
                combined.asDaxArgUnquoted = ()=>{
                    return chunks.join("")
                }
            }
            if (!combined.asDaxArgSingleQuoteInnards) {
                let worked = true
                let chunks = []
                for (let each of argParts) {
                    if (each.asDaxArgSingleQuoteInnards) {
                        chunks.push(each.asDaxArgSingleQuoteInnards)
                    } else if (each.asDaxArgUnquoted && validAsUnquotedDaxArgNoInterpolation(each.asDaxArgUnquoted)) {
                        chunks.push(each.asDaxArgUnquoted.replace(/"'"/g,`'"'"'`))
                    } else if (each.asJsBacktickStringInnards && validAsUnquotedDaxArgNoInterpolation(each.asJsBacktickStringInnards)) {
                        chunks.push(each.asJsBacktickStringInnards.replace(/"'"/g,`'"'"'`))
                    } else if (each.asJsValue) {
                        chunks.push(`\${${each.asJsValue}}`)
                    } else {
                        worked = false
                        break
                    }
                }
                combined.asDaxArgSingleQuoteInnards = ()=>{
                    return chunks.join("")
                }
            }
            
            if (argParts.every(each=>each.asJsArray||each.asJsValue)) {
                combined.asJsArray = ()=>{
                    const chunks = []
                    for (let each of argParts) {
                        if (each.original.asJsArray) {
                            chunks.push(each.asJsArray.slice(1,-1))
                        } else {
                            chunks.push(each.asJsValue)
                        }
                    }
                    return `[${chunks.join(",")}]`
                }
            }

            if (!combined.asJsBacktickStringInnards && argParts.every(each=>each.asJsStringValue)) {
                combines.asJsBacktickStringInnards = ()=>{
                    const chunks = []
                    for (let each of argParts) {
                        if (each.asJsBacktickStringInnards) {
                            chunks.push(each.asJsBacktickStringInnards)
                        } else {
                            chunks.push(`\${${each.asJsStringValue}\}`)
                        }
                    }
                    return chunks.join("")
                }
            }
            
            return autofillOutputForms(combined)
        })
    }
}

const argOutputAggregator = (nodes, { translateInner }) => {
    const args = []
    for (let argParts of argAccumulator(nodes)) {
        args.push(...convertArgParts(argParts, { translateInner }))
    }
    return args
}

const unifyArgs = (args, { translateInner }) => {
    const aggregatedArgs = argOutputAggregator(args, { translateInner })
    let output = {}
    if (aggregatedArgs.length == 1) {
        const arg = aggregatedArgs[0]
        output = { ...arg }
        if (output.asJsValue) {
            output.asJsArray = ()=>{
                return `[${output.asJsValue}]`
            }
        }
        if (arg.asDaxArgUnquoted) {
            output.asDaxArgSequence = ()=>arg.asDaxArgUnquoted
        } else if (arg.asDaxArgSingleQuoteInnards) {
            output.asDaxArgSequence = ()=>arg.asDaxSingleQuoted
        } else if (arg.asJsStringValue) {
            output.asDaxArgSequence = ()=>`\${${arg.asJsStringValue}}`
        }
    } else {
        if (aggregatedArgs.every(each=>each.asDaxArgUnquoted||each.asDaxArgSingleQuoteInnards||each.asJsStringValue)) {
            output.asDaxArgSequence = ()=>{
                const chunks = []
                for (const each of aggregatedArgs) {
                    if (each.asDaxArgUnquoted) {
                        chunks.push(each.asDaxArgUnquoted)
                    } else if (each.asDaxArgSingleQuoteInnards) {
                        chunks.push(each.asDaxSingleQuoted)
                    } else if (each.asJsStringValue) {
                        chunks.push(`\${${each.asJsStringValue}}`)
                    }
                }
                return chunks.join(" ")
            }
        }
        if (aggregatedArgs.every(each=>each.asJsValue)) {
            output.asJsArray = ()=>"["+aggregatedArgs.map(each=>each.asJsValue+", ").join("")+"]"
        }
    }
    return autofillOutputForms(output)
}

const convertArgsCreator = (recursiveParts)=>(nodes, {asArrayString=false, asArray=false, toJsValue=false, debug=false, context=null} = {}) => {
    const { convertArg } = recursiveParts
    if (typeof nodes == "string") {
        const root = parser.parse(": "+nodes).rootNode
        nodes = root.quickQueryFirst(`(command)`).children.slice(2)
    }
    // array of array of nodes
    const argNodes = argAccumulator(nodes)
    const args = []
    for (let arg of argNodes) {
        if (arg.length == 1) {
            args.push(convertArg(arg[0], {context}))
        } else {
            args.push(
                arg.map(each=>convertArg(each, {context})).join("") 
            )
        }
    }
    
    // args should be an array of array of (strings or functions)
        // each function returns a string
        // each string is js backticks escaped
    // console.debug(`args is:`,args)

    // TODO: handle the case of part of an arg being a function (e.g. splat, range, subshell, etc)
    // debug && console.debug(`args is:`,args)
    if (asArray) {
        return args
    } else if (toJsValue) {
        // FIXME: unwrap js value
        return `\`${args.join(" ")}\``
    } else if (asArrayString) {
        return `[${args.map(each=>`\`${each}\``).join(", ")}]`
    } else {
        return `\`${args.join(" ")}\``
    }
}

export function translate(code, { withHeader=true }={}) {
    const node = parser.parse(code).rootNode
    let functionNames = []
    let usedExitCodeOfLastChildProcess = false

    // extra: these are (mostly) kept track of, but currently do not change the output
    // they could be used to minimize the imports needed
    let usedEnvVars = false
    let usedStdout = false
    let usedStderr = false
    let usedAliases = false
    let usedOverwrite = false
    let usedAppend = false
    let usesHasCommand = false
    let usesFs = false
    let hadShebang = false
    
    // 
    // helpers
    // 
        const accessEnvVar = (rawVarName)=>{
            usedEnvVars = true
            if (rawVarName == "?") {
                usedExitCodeOfLastChildProcess = true
            }
            return `env${escapeJsKeyAccess(rawVarName)}`
        }
        const translateDoubleParensContent = (text, context)=>{
            // context can be null or "for"

            // find all vars (this is currently very imperfect) and replace them with JS env access of vars
            // NOTE: this can be part of a range: ((x = 0; x < $VN; x++)); 
            //       or a standalone statement: ((count++))
            //       or part of an argument: echo $(( ($FREQ - 2407) / 5 ))
            //       or part of an assignment: i=$((i + 1))
            return text.replaceAll(/(?:\$?\{?([a-zA-Z_]\w*)\}?|\$-)/g,(...matchString)=>accessEnvVar(matchString[1]))
        }

        const fallbackTranslate = (node)=>({ asJsValue: "/* FIXME: " + escapeComment(node.text) + " */0"})

        
    
    // 
    // 
    // main recursive function
    // 
    // 
    let mostRecentStatement = null
    function translateInnerBase(node, {context=null}={}) {
        const translateInnerHelper = (node,options={})=>autofillOutputForms(translateInnerBase(node, {context, ...options}))
        try {
            // this is a way of making sure context is passed down by default
            const translateInner = translateInnerHelper
            const statementContexts = ["program", "do_group", "function_definition", "if_consequence"]
            let usedLocalEnvVars = false
            const recursiveParts = {translateInner}
            const convertArgs = convertArgsCreator({ translateInner, convertArg: (node)=>translateInner(node).asJsBacktickStringInnards })
            // 
            // helpers that use translateInner
            // 
                function convertBashTestToJS(expr) {
                    expr = expr.trim()

                    let negated = ""
                    if (expr.match(/^!\s+/)) {
                        expr = expr.replace(/^!\s+/,"")
                        negated = "!"
                    }
                    const toJsValue = (arg)=>convertArgs(arg, {toJsValue: true}).replace(/^\`\$\{(.+)\}\`$/,"$1")
                    
                    let match
                    // 
                    // command exists check
                    // 
                    if (match=expr.match(/\[\[?\s+-n\s+"?\$\((?:command\s+-v|which)\s+(.+?)\)"?\s+\]\]?/)) {
                        usesHasCommand = true
                        return `${negated} hasCommand(${toJsValue(match[1])})`
                    }
                    if (match=expr.match(/\[\[?\s+-z\s+"?\$\((?:command\s+-v|which)\s+(.+?)\)"?\s+\]\]?/)) {
                        usesHasCommand = true
                        return `${negated?"":"!"} hasCommand(${toJsValue(match[1])})`
                    }
                    
                    // 
                    // -n
                    // 
                    if (match=expr.match(/\[\[?\s+-n\s+(.+?)\s+\]\]?/)) {
                        if (negated) {
                            return `${toJsValue(match[1])}.length == 0`
                        } else {
                            return `${toJsValue(match[1])}.length > 0`
                        }
                    }
                    // 
                    // -z
                    // 
                    if (match=expr.match(/\[\[?\s+-z\s+(.+?)\s+\]\]?/)) {
                        if (negated) {
                            return `${toJsValue(match[1])}.length > 0`
                        } else {
                            return `${toJsValue(match[1])}.length == 0`
                        }
                    }
                    
                    // Remove surrounding [[ ]] if present
                    expr = expr.replace(/^\[\[?\s*|\s*\]?\]$/g, "")

                    // check negation again
                    if (expr.match(/^!\s+/)) {
                        expr = expr.replace(/^!\s+/,"")
                        if (negated) {
                            negated = ""
                        } else {
                            negated = "!"
                        }
                    }


                    
                    // hasCommand without []'s
                    const cmdMatch = expr.match(/^(command\s+-v|which)\s+(.+)$/)
                    if (cmdMatch) {
                        const cmd = cmdMatch[2].trim().replace(/^["']|["']$/g, "")
                        usesHasCommand = true
                        return `hasCommand("${cmd}")`
                    }
                    // Match binary expressions like "$a" = "hi"
                    const binaryOpMatch = expr.match(/^(.+?)\s+(!=|-eq|-ne|-gt|-lt|-ge|-le|==|=~|=)\s+(.+)$/)
                    if (binaryOpMatch) {
                        const [, leftRaw, op, rightRaw] = binaryOpMatch
                        let left = toJsValue(leftRaw.trim())
                        let right = toJsValue(rightRaw.trim())
                        try {
                            if (eval(left)-0 == eval(left)-0) {
                                left = eval(left)-0
                            }
                        } catch (error) {
                            // left = `parseFloat(${left})`
                        }
                        try {
                            if (eval(right)-0 == eval(right)-0) {
                                right = eval(right)-0
                            }
                        } catch (error) {
                            // right = `parseFloat(${right})`
                        }

                        const opMap = {
                            "=": "===",
                            "==": "===",
                            "!=": "!==",
                            "-eq": "==",
                            "-ne": "!=",
                            "-gt": ">",
                            "-lt": "<",
                            "-ge": ">=",
                            "-le": "<=",
                        }

                        const jsOp = opMap[op]

                        if (op == "=~") {
                            return `${left}.match(/${`${right}`.replace(/^\`|\`$/g,"")}/)`
                        }
                        return `${left} ${jsOp} ${right}`
                    }

                    // Match file tests: -e, -d, -L, -x
                    const fileTestMatch = expr.match(/^-(e|d|L|x)\s+(.+)$/)
                    if (fileTestMatch) {
                        const flag = fileTestMatch[1]
                        const fileExpr = convertArgs(fileTestMatch[2].trim())

                        switch (flag) {
                            case "e":
                                usesFs = true
                                return `fs.existsSync(${fileExpr})`
                            case "d":
                                usesFs = true
                                return `fs.existsSync(${fileExpr}) && fs.lstatSync(${fileExpr}).isDirectory()`
                            case "L":
                                usesFs = true
                                return `fs.existsSync(${fileExpr}) && fs.lstatSync(${fileExpr}).isSymbolicLink()`
                            case "x":
                                usesFs = true
                                return `fs.existsSync(${fileExpr}) && (() => { try { fs.accessSync(${fileExpr}, fs.constants.X_OK); return true; } catch (e) { return false; } })()`
                        }
                    }

                    // Fallback for unrecognized formats
                    return fallbackTranslate({text:expr})
                }
            
            // 
            // 
            // main switch
            // 
            // 
            if (node.type == "program") {
                let contents = node.children.map(each=>translateInner(each, {context:"program"})).join("")
                hadShebang = hadShebang ? "#!/usr/bin/env -S deno run --allow-all\n" : ""
                const header = !withHeader ? [] : [
                    `${hadShebang}import fs from "node:fs"`,
                    `import * as dax from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts" // see: https://github.com/dsherret/dax`,
                    `import * as path from "https://esm.sh/jsr/@std/path@1.1.2"`,
                    `import { env, aliases, $stdout, $stderr, initHelpers, iterateOver } from "https://esm.sh/gh/jeff-hykin/bash2deno@0.1.0.0/helpers.js"`,
                    `let { $, appendTo, overwrite, hasCommand, makeScope, settings, exitCodeOfLastChildProcess } = initHelpers({ dax })`,
                ]
                return header.join("\n")+"\n"+contents
            } else if (node.type == "$(" || node.type == ")" || node.type == "`") {
                return { asJsStatement: "", asJsValue: "" }
            } else if (node.type == "whitespace") {
                return { asJsStatement: node.text, asJsValue: node.text }
            // 
            // comments
            // 
            } else if (node.type == "comment") {
                if (node.text.startsWith("#!/")) {
                    hadShebang = true
                    return { asJsStatement: "" }
                }
                return { asJsStatement: "//"+node.text.slice(1) }
            } else if (node.type == ";") {
                return { asJsStatement: ";" }
            // 
            // var assignment
            // 
            } else if (node.type == "declaration_command") {
                // TODO: could start with readonly local (I think)
                const isLocal = node.quickQueryFirst(`("local")`)
                if (isLocal) {
                    usedLocalEnvVars = true
                    usedEnvVars = true
                    const varAssignmentNode = node.quickQueryFirst(`(variable_assignment)`)
                    if (!varAssignmentNode) {
                        const varNames = node.quickQuery(`(variable_name)`)
                        return varNames.map(each=>`local${escapeJsKeyAccess(each.text)} = ""`).join(";")
                    }
                    return translateInner(varAssignmentNode, {context: "local_variable_assignment"})
                }
                const varAssignmentNode = node.quickQueryFirst(`(variable_assignment)`)
                if (varAssignmentNode) {
                    return translateInner(varAssignmentNode)
                } else {
                    console.warn(`[translateInner] failed to find variable_assignment node in declaration_command:\n`,xmlStylePreview(node))
                    return fallbackTranslate(node)
                }
            } else if (node.type == "variable_assignment") {
                usedEnvVars = true
                // FIXME: handle non-exported vars
                let varNameNode = node.quickQueryFirst(`(variable_name)`)
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
                
                // note: all internals are already escaped for JS
                let convertedArgs
                if (argNodes[0] == null) {
                    convertedArgs = `""`
                } else {
                    convertedArgs = convertArgParts(argNodes, { translateInner })[0].asJsValue
                }
                if (convertedArgs == null) {
                    return fallbackTranslate(node)
                } else if (context == "local_variable_assignment") {
                    const output = `local${escapeJsKeyAccess(varNameNode.text)} = ${convertedArgs}`
                    return { asJsStatement: output, asJsValue: output }
                } else {
                    const output = `${accessEnvVar(varNameNode.text)} = ${convertedArgs}`
                    return { asJsStatement: output, asJsValue: output }
                }
            } else if (node.type == "unset_command") {
                // TODO: account for flags/args for unset (e.g. unset function)
                const rawVarName = node.text.replace(/^unset\s*/,"")
                return { asJsStatement: `delete ${accessEnvVar(rawVarName)}` }
            // 
            // command/alias
            // 
            } else if (node.type == "negated_command") {
                let commandNode = node.quickQueryFirst(`(command)`)
                commandNode ||= node.quickQueryFirst(`(test_command)`)
                if (!commandNode) {
                    console.warn(`[translateInner] failed to find negated_command node in:`,xmlStylePreview(node))
                    return fallbackTranslate(node)
                }
                let translated = translateInner(commandNode)
                return {
                    asDaxCommandInnardsPure: ()=>`! ${translated.asDaxCommandInnardsPure}`,
                    asJsConditional: translated.asNegatedJsConditional,
                    asJsValue: translated.asJsValue&&`!${translated.asJsValue}`,
                    asDaxCallSuccess: translated.asDaxCallFail,
                    asDaxCallFail: translated.asDaxCallSuccess,
                }
            } else if (node.type == "command") {
                // <command>
                // handle one-off env vars
                let envChunks = []

                // NOTE: alias is part of command
                // FIXME: command_name
                const commandNameNode = node.quickQueryFirst(`(command_name)`)
                const argNodes = node.children.filter(each=>each.type!="command_name" && each.type!="variable_assignment")
                // DAX basically handles this
                const getEnvPrefix = ()=>node.children.filter(each=>each.type=="variable_assignment").map(each=>`${each} `).join("")
                if (commandNameNode.text == "alias") {
                    const aliasName = node.text.match(/^alias\s+(\w+)=/)[1]
                    const aliasValue = node.text.replace(/^alias\s+(\w+)=/,"")
                    const output = `aliases${escapeJsKeyAccess(aliasName)} = ${convertArgs(aliasValue, {toJsValue: true})}`
                    return { asJsStatement: output, asJsValue: output }
                } else if (commandNameNode.text == "set") {
                    // 
                    // set
                    // 
                    return fallbackTranslate(node)
                } else if (commandNameNode.text == "return") {
                    const returnValue = node.text.replace(/^return\s*/,"")
                    if (returnValue.match(/"?\$\?"?/)) {
                        return { asJsStatement: `return exitCodeOfLastChildProcess` }
                    } else if (returnValue.match(/^\d+$/)) {
                        return { asJsStatement: `return exitCodeOfLastChildProcess = ${returnValue}` }
                    } else {
                        return { asJsStatement: `return exitCodeOfLastChildProcess = ${convertArgs(argNodes, {toJsValue: true})}` }
                    }
                } else if (commandNameNode.text == "continue") {
                    return { asJsStatement: `continue` }
                } else if (commandNameNode.text == "break") {
                    return { asJsStatement: `break` }
                } else if (commandNameNode.text == "read") {
                    const args = convertArgs(argNodes, {asArray: true})
                    let numberedArgs = []
                    let skipNextArg = false
                    let envVarArg
                    let promptArg =  ""
                    let warning = ""
                    for (let each of args) {
                        if (["-d","-i","-n","-N","-p","-t","-u"].includes(each)) {
                            skipNextArg = each
                            continue
                        }
                        if (skipNextArg) {
                            if (skipNextArg == "-p") {
                                promptArg = each
                            }
                            if (skipNextArg == "-u") {
                                warning = ` /* FIXME: this was a read from ${escapeComment(each)}, (e.g. ${escapeComment(JSON.stringify(args))}) but I'm only able to translate reading from stdin */`
                            }
                            skipNextArg = false
                            continue
                        }
                        skipNextArg = false
                        
                        if (each.startsWith("-") && each.length == 2) {
                            continue
                        }
                        envVarArg = each
                    }
                    const output = `env${escapeJsKeyAccess(envVarArg)} = prompt(${promptArg})${warning}`
                    return { asJsStatement: output, asJsValue: output }
                    // -a <array>	Assigns the provided word sequence to a variable named <array>.
                    // -d <delimiter>	Reads a line until the provided <delimiter> instead of a new line.
                    // -e	Starts an interactive shell session to obtain the line to read.
                    // -i <prefix>	Adds initial text before reading a line as a prefix.
                    // -n <number>	Returns after reading the specified number of characters while honoring the delimiter to terminate early.
                    // -N <number>	Returns after reading the specified number of chars, ignoring the delimiter.
                    // -p <prompt>	Outputs the prompt string before reading user input.
                    // -r	Disable backslashes to escape characters.
                    // -s	Does not echo the user's input.
                    // -t <time>	The command times out after the specified time in seconds.
                    // -u <file descriptor>	Read from file descriptor instead of standard input.
                } else if (commandNameNode.text == "true") {
                    return { asJsConditional: `true`, asJsStatement: `true`, asJsValue: `true`, asDaxCommandInnardsPure: `true`, asJsBacktickStringInnards: `true`, asJsNumber: "1" }
                } else if (commandNameNode.text == "false") {
                    return { asJsConditional: `false`, asJsStatement: `false`, asJsValue: `false`, asDaxCommandInnardsPure: `false`, asJsBacktickStringInnards: `false`, asJsNumber: "0" }
                } else if (commandNameNode.text == "basename") {
                    const uniArgs = unifyArgs(argNodes, { translateInner })
                    const convertedArgs = convertArgs([ commandNameNode, ...argNodes ])
                    if (convertedArgs == null) {
                        return fallbackTranslate(node)
                    }
                    const asDaxCommandInnardsPure = `${getEnvPrefix()+convertedArgs.slice(1,-1)}`
                    const output = {
                        asDaxCommandInnardsPure,
                        asJsValue: uniArgs.asJsValue ? `path.basename(${uniArgs.asJsValue})` : null, 
                        // asJsStatement: `await $\`${asDaxCommandInnardsPure}\``,
                        asDaxCallToSub: uniArgs.asJsValue ? `path.basename(${uniArgs.asJsValue})` : null,
                        asJsBacktickStringInnards: `${`path.basename(${uniArgs.asJsValue})`}`
                    }
                    return output
                } else if (commandNameNode.text == "dirname") {
                    const uniArgs = unifyArgs(argNodes, { translateInner })
                    const convertedArgs = convertArgs([ commandNameNode, ...argNodes ])
                    if (convertedArgs == null) {
                        return fallbackTranslate(node)
                    }
                    const asDaxCommandInnardsPure = `${getEnvPrefix()+convertedArgs.slice(1,-1)}`
                    const output = {
                        asDaxCommandInnardsPure,
                        asJsValue: uniArgs.asJsValue ? `path.dirname(${uniArgs.asJsValue})` : null,
                        // asJsStatement: `await $\`${asDaxCommandInnardsPure}\``,
                        asDaxCallToSub: uniArgs.asJsValue ? `path.dirname(${uniArgs.asJsValue})` : null,
                    }
                    return output
                } else if (commandNameNode.text == "echo") {
                    const asJsStatement = ()=>{
                        const convertedArgs = convertArgs(argNodes, {asArray: true})
                        if (convertedArgs == null) {
                            return fallbackTranslate(node)
                        }
                        let output = `console.log(\`${convertedArgs.join(" ")}\`)`
                        if ([...output.matchAll(/\n/g)].length <= 2) {
                            // prefer inline newlines. Note this should never alter functionality, even on interpolated things
                            output = output.replace(/\n/g,"\\n")
                        }
                        return output
                    }
                    // TODO: handle echo -n
                    return {
                        asDaxCommandInnardsPure: ()=>{
                            const convertedArgs = convertArgs([ commandNameNode, ...argNodes ])
                            if (convertedArgs == null) {
                                return fallbackTranslate(node)
                            }
                            return convertedArgs.slice(1,-1)
                        },
                        asJsBacktickStringInnards: ()=>{
                            const translated = unifyArgs(argNodes, { translateInner }).asJsBacktickStringInnards
                            // TODO: handle args like -n
                            return "<asJsBacktickStringInnards>"+translated+"</asJsBacktickStringInnards>"
                        },
                        asJsConditional: ()=>{
                            return asJsStatement()+"||1"
                        },
                        asNegatedJsConditional: ()=>{
                            return asJsStatement()
                        },
                        asJsStatement,
                    }
                } else if (functionNames.includes(commandNameNode.text)) {
                    const uniArgs = unifyArgs(argNodes, { translateInner })
                    const convertedArgs = convertArgs([ commandNameNode, ...argNodes ])
                    if (convertedArgs == null) {
                        return fallbackTranslate(node)
                    }
                    const asDaxCommandInnardsPure = `${getEnvPrefix()+convertedArgs.slice(1,-1)}`
                    return { 
                        asDaxCommandInnardsPure,
                        asJsConditional: `(await ${commandNameNode.text}(${uniArgs.asJsArray.slice(1,-1)})) == 0`,
                        asNegatedJsConditional: `(await ${commandNameNode.text}(${uniArgs.asJsArray.slice(1,-1)})) != 0`,
                        asJsStatement: `await ${commandNameNode.text}(${uniArgs.asJsArray.slice(1,-1)})` 
                    }
                } else {
                    const convertedArgs = convertArgs([ commandNameNode, ...argNodes ])
                    if (convertedArgs == null) {
                        return fallbackTranslate(node)
                    }
                    const asDaxCommandInnardsPure = `${getEnvPrefix()+convertedArgs.slice(1,-1)}`
                    return { asDaxCommandInnardsPure, asJsStatement: `await $\`${asDaxCommandInnardsPure}\`` }
                }
            } else if (node.type == "test_command") {
                let asJsValue
                try {
                    asJsValue = convertBashTestToJS(node.text)
                } catch (error) {
                    
                }
                // FIXME: this is temporary
                return {
                    asJsValue,
                    asJsConditional: asJsValue,
                    asDaxCommandInnardsPure: ()=>escapeJsString(node.text).slice(1,-1),
                }
            // 
            // redirection
            // 
            } else if (node.type == "redirected_statement") {
                mostRecentStatement = node
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
                const commandNode = node.children[0]
                // const inner = translateInner(commandNode).slice(8)
                const inner = translateInner(commandNode)
                // can't use internal commands that need dax outards, or that have been redirected already
                // FIXME: while_statement can be the target of a redirect
                if (!inner?.asDaxCommandInnardsChained) {
                    console.warn(`[redirected_statement] failed to translate command (${commandNode.type}):`,commandNode.text)
                    // console.debug(`inner.asDaxCommandInnardsChained is:`,inner)
                    return fallbackTranslate(node)
                }
                const redirects = node.quickQuery(`(file_redirect)`)
                const parseOutputRedirect = (redirectNode)=>{
                    const text = redirectNode.text.trim()
                    const maybeFdNode = redirectNode.quickQueryFirst(`(file_descriptor)`)
                    let fdSource
                    if (maybeFdNode) {
                        fdSource = maybeFdNode.text
                    } else {
                        // implicit stdout redirect
                        if (text.match(/^\s*>/)) {
                            fdSource = "1"
                        }
                    }
                    const output = {
                        source: null,
                        method: "overwrite",
                        target: null,
                    }
                    const maybeProcessSubstitutionNode = redirectNode.quickQueryFirst(`(process_substitution)`)
                    if (maybeProcessSubstitutionNode) {
                        // TODO: handle process substitution
                        console.warn(`unsupported redirect process_substitution:`,redirectNode.text)
                        return null
                    }
                    
                    // handle edgecase (kind of a problem with the tree-sitter parser)
                    if (!fdSource) {
                        if (!text.match(/^&/)) {
                            console.warn(`unsupported redirect (not stdout, stderr, &):`,redirectNode.text)
                            return null
                        }
                        output.source = "&"
                        if (text.match(/^&\s*>>/)) {
                            output.method = "append"
                        }
                    } else {
                        output.source = "1"
                    }
                    
                    const rawTarget = text.replace(/^(&|1|2)?\s*>>?\s*/, "")
                    if (rawTarget == "/dev/null") {
                        // already done: (default value)
                        // output.target = null
                        output.target = `"null"`
                    } else if (rawTarget.startsWith("&")) {
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
                        const asJsString = convertArgs(redirectNode.children.filter(each=>![">",">>", "&>", "&>>",">&",">>&","process_substitution","file_descriptor"].includes(each.type)), {toJsValue: true})
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

                const redirectsParsed = redirects.map(parseOutputRedirect)
                // 
                // one redirect => we can handle it with dax innards, 
                // 
                if (redirects.length == 1 && redirectsParsed[0]?.source != "&") {
                    const asDaxCommandInnardsRedirected = `${inner.asDaxCommandInnardsChained} ${redirects[0].text}`
                    return {
                        asDaxCommandInnardsRedirected,
                        asJsStatement: `await $\`${asDaxCommandInnardsRedirected}\``,
                    }
                } else {
                    let stdoutTarget
                    let stderrTarget
                    for (const redirect of redirectsParsed) {
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
                    // bash is weird. For: ps aux > /dev/null 2>&1
                    // both stdout and stderr are redirected to /dev/null
                    // but for: ps aux 1>&2 2>&1
                    // stdout and stderr are swapped
                    // there is no way (without a third pipe) to redirect one to dev null and replace it with the other
                    // ex: route stderr to nowhere and funnel stdout to stderr (and it display rather than also going nowhere)
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
                    const asDaxCallRedirected = `await $\`${inner.asDaxCommandInnardsChained}\`${stdoutString}${stderrString}`
                    return {
                        asDaxCallRedirected,
                        asJsStatement: asDaxCallRedirected,
                    }
                }
            // 
            // pipes
            // 
            } else if (node.type == "pipeline") {
                // TODO: handle converting grep and bypassing pipe entirely
                const possibleInnerTypes = [`command`, `negated_command`, `redirected_statement`, `test_command`]
                const innerCommands = node.children.filter(each=>possibleInnerTypes.includes(each.type))
                const converted = innerCommands.map(translateInner)
                for (const each of converted.slice(0,-1)) {
                    // we cannot handle redirection before piping yet
                    // TODO: convert the whole thing to a chain of dax calls (instead of one call)
                    if (!each.asDaxCommandInnardsPure) {
                        return fallbackTranslate(node)
                    }
                }
                // this should always be true, but just in case
                if (!converted.at(-1).asDaxCallRedirected) {
                    return fallbackTranslate(node)
                }
                // this isn't as hacky as it looks
                const output = {
                    asDaxCallRedirected: ()=>{
                        const prefix = `await $\``
                        let lastFixedUp = converted.at(-1).asDaxCallRedirected.slice(prefix.length)
                        return `${prefix}${converted.slice(0,-1).map(each=>each.asDaxCommandInnardsPure).join(" | ")} | ${lastFixedUp}`
                    },
                }
                // if it can be done with only innards, then that lets us chain them
                if (converted.at(-1).asDaxCommandInnardsRedirected) {
                    output.asDaxCommandInnardsRedirected = ()=>{
                        return converted.map(each=>each.asDaxCommandInnardsRedirected).join(" | ")
                    }
                    output.asDaxCallToSub = `await $.str\`${converted.map(each=>each.asDaxCommandInnardsRedirected).join(" | ")}\``
                }
                // output.asJsStatement = output.asDaxCallRedirected
                output.asJsStatement = `${output.asDaxCallRedirected()}`
                return output
            // 
            // chaining
            // 
            } else if (node.type == "list") {
                const parentNode = node
                // FIXME: still need to handle cases where there are double redirects inside of a list, but that's going to be a lot of work since dax doesn't support it
                function convertList(node, { onRightSideOfParent=true }={}) {
                    // TODO: may need parentheses
                    
                    // FIXME: this is a hack but only cause I haven't gotten around to properly parsing <test_command>
                    let match
                    // if (match=node.text.match(/^(\[\[? .+ \]?\])\s+(\&\&|\|\|)((?:[^a]|a)+)/)) {
                    //     const negateString = match[2] == "&&" ? "" : " ! "
                    //     // convert to if statement so that things like "[[ ]] && break" work (otherwise the break will fail)
                    //     return translateInner(parser.parse(`\n${node.indent}if ${negateString} ${match[1]}; then\n${node.indent}    ${match[3]}\n${node.indent}fi\n`, {context: "list"}).rootNode.quickQueryFirst(`(if_statement)`))
                    // }
                    
                    // this is not a hack, its a clever way to translate problems like "&& continue" (which wouldn't work in JS as-is)
                    if (match=node.text.match(/^(.+)\s+(\&\&|\|\|)\s+(continue|break|return(?:\s+(.+))?)$/)) {
                        const negateString = match[2] == "&&" ? "" : " ! "
                        let madeUp
                        try {
                            madeUp=`\n${node.indent}if ${negateString} ${match[1]}; then\n${node.indent}    ${match[3]}\n${node.indent}fi\n`
                            const rootNode = parser.parse(
                                madeUp, {context: "list"}
                            ).rootNode
                            const ifStatement = rootNode.quickQueryFirst(`(if_statement)`)
                            if (!ifStatement) {
                                console.debug(`&& return hack: xmlStylePreview(rootNode) is:`,xmlStylePreview(rootNode))
                            }
                            // convert to if statement so that things like "[[ ]] && break" work (otherwise the break will fail)
                            const output = translateInner(
                                ifStatement
                            )
                            // console.debug(`madeUp is:`,madeUp)
                            return output
                        } catch (error) {
                            console.debug(`madeUp is:`,madeUp)
                            console.warn(`[translateInner] failed to handle && return:`,error.stack)
                        }
                    }
                    
                    // FIXME: <compound_statement> probably could appear here
                    const possibleInnerTypes = [`command`,`negated_command`,`redirected_statement`, `test_command`, `compound_statement`, `list`]
                    const filterOut = ["&&", "||", ";","whitespace"]
                    const [ left, right ] = node.children.filter(each=>!filterOut.includes(each.type))
                    const isOr = node.children.some(each=>each.type == `||`)
                    const joiner = isOr ? "||" : "&&"
                    
                    // left side
                    const leftSideIsBaseCase = left.type != "list"
                    let leftSideAsOutputValue
                    if (leftSideIsBaseCase) {
                        leftSideAsOutputValue = translateInner(left)
                    } else {
                        leftSideAsOutputValue = convertList(left, { onRightSideOfParent: false })
                    }
                    if (!leftSideAsOutputValue.asDaxCommandInnardsChained) {
                        console.warn(`[list] failed to convert left side of:`,parentNode.text)
                        return fallbackTranslate(node)
                    }

                    // right side
                    const rightSideIsBaseCase = right.type != "list"
                    let rightSideAsOutputValue
                    if (rightSideIsBaseCase) {
                        rightSideAsOutputValue = translateInner(right)
                    } else {
                        rightSideAsOutputValue = convertList(right, { onRightSideOfParent: true })
                    }

                    // 
                    // output
                    // 
                    const output = {}

                    if (rightSideAsOutputValue.asDaxCommandInnardsChained) {
                        output.asDaxCommandInnardsChained = `${leftSideAsOutputValue.asDaxCommandInnardsChained} ${joiner} ${rightSideAsOutputValue.asDaxCommandInnardsChained}`
                        output.asJsStatement = `await $\`${output.asDaxCommandInnardsChained}\``
                        return output
                    } else if (onRightSideOfParent && rightSideAsOutputValue.asDaxCallRedirected) {
                        const prefix = `await $\``
                        let lastFixedUp = rightSideAsOutputValue.asDaxCallRedirected.slice(prefix.length)
                        output.asDaxCallRedirected = `${prefix}${leftSideAsOutputValue.asDaxCommandInnardsChained} ${joiner} ${lastFixedUp}`
                        output.asJsStatement = output.asDaxCallRedirected
                        return output
                    } else {
                        console.warn(`[list] failed to convert right side of:`,parentNode.text)
                        return fallbackTranslate(node)
                    }
                }
                return convertList(node)
            // 
            // if 
            // 
            } else if (node.type == "else") {
                return `\n${node.indent}} else {\n`
            } else if (node.type == "elif_clause") {
                return node.children.map(translateInner).join("")
            } else if (node.type == "else_clause") {
                return node.children.map(translateInner).join("")
            } else if (node.type == "if") {
                return `if (`
            } else if (node.type == "elif") {
                return `} else if (`
            } else if (node.type == "then") {
                return ") {"
            } else if (node.type == "fi") {
                return `\n${node.indent}}`
            } else if (node.type == "test_command") {
                if (node.text.match(/\(\(.+\)\)/)) {
                    return translateDoubleParensContent(node.text.slice(2,-2))
                }
                return convertBashTestToJS(node.text)
            } else if (node.type == "if_statement") {
                let chunks = []
                let conditionNodes = []
                let consequenceNodes = []
                const trimFluff = (nodes)=>{
                    while (nodes.at(-1)?.type == "whitespace" || nodes.at(-1)?.type == ";") {
                        nodes.pop()
                    }
                    while (nodes.at(0)?.type == "whitespace") {
                        nodes.shift()
                    }
                    return nodes
                }
                const nodes = []
                let sawIf = false
                let sawThen = false
                let sawEndOfThen = false
                let justSawIf = false
                for (let each of node.children) {
                    if (each.type == "if") {
                        sawIf = true
                        justSawIf = true
                        continue
                    }
                    if (each.type == "then") {
                        sawThen = true
                        trimFluff(conditionNodes)
                        const translatedNodes = conditionNodes.map(each=>translateInner(each, {context:"if_condition"}))
                        if (translatedNodes.length == 1) {
                            chunks.push(
                                `// ${conditionNodes[0].text}\n`,
                                `${conditionNodes[0].indent}if (${translatedNodes[0].asJsConditional||translatedNodes[0].asDaxCallSuccess||translatedNodes[0].asJsValue}) {\n`
                            )
                            continue
                        }
                        let condition = conditionNodes.map(each=>translateInner(each, {context:"if_condition"})).join("")
                        // // if its all commented out
                        // if (condition.match(/\s*\/(\*|\/)\s*FIXME([^\/]|(?<!\*)\/)+\*\/\s*$/)) {
                        //     condition = null
                        // }
                        chunks.push(
                            `if (${condition}) {\n`
                        )
                        continue
                    }
                    if (justSawIf) {
                        if (each.type == "whitespace") {
                            continue
                        } else {
                            justSawIf = false
                        }
                    }

                    if (each.type == "elif_clause" || each.type == "else_clause" || each.type == "fi") {
                        if (!sawEndOfThen) {
                            trimFluff(consequenceNodes)
                            let consequence = consequenceNodes.map(each=>translateInner(each, {context:"if_consequence"})).join("")
                            chunks.push(
                                consequenceNodes[0].indent + consequence
                            )
                            sawEndOfThen = true
                        }
                        if (each.type == "fi") {
                            chunks.push(
                                `\n${node.indent}}`
                            )
                            break
                        }
                    }

                    if (sawIf && !sawThen) {
                        conditionNodes.push(each)
                    } else if (sawThen && !sawEndOfThen) {
                        consequenceNodes.push(each)
                    } else {
                        const clauseNode = each
                        if (each.type == "elif_clause") {
                            conditionNodes = []
                            consequenceNodes = []
                            let sawIf = false
                            let sawThen = false
                            let justSawIf = false
                            for (let each of clauseNode.children) {
                                if (each.type == "elif") {
                                    sawIf = true
                                    justSawIf = true
                                    continue
                                }
                                if (each.type == "then") {
                                    sawThen = true
                                    trimFluff(conditionNodes)
                                    const translatedNodes = conditionNodes.map(each=>translateInner(each, {context:"if_condition"}))
                                    if (translatedNodes.length == 1) {
                                        chunks.push(
                                            `\n${node.indent}// ${conditionNodes[0].text}`,
                                            `\n${node.indent}} else if (${translatedNodes[0].asJsConditional||translatedNodes[0].asDaxCallSuccess||translatedNodes[0].asJsValue}) {\n`
                                        )
                                        continue
                                    }
                                    chunks.push(
                                        `\n${node.indent}} else if (${translatedNodes.join("")}) {\n`
                                    )
                                    continue
                                }
                                if (justSawIf) {
                                    if (each.type == "whitespace") {
                                        continue
                                    } else {
                                        justSawIf = false
                                    }
                                }
                                if (sawIf && !sawThen) {
                                    conditionNodes.push(each)
                                } else if (sawThen) {
                                    consequenceNodes.push(each)
                                }
                            }
                            trimFluff(consequenceNodes)
                            let consequence = consequenceNodes.map(each=>translateInner(each, {context:"if_consequence"})).join("")
                            chunks.push(
                                consequenceNodes[0].indent + consequence
                            )
                        } else if (each.type == "else_clause") {
                            chunks.push(`\n${node.indent}} else {\n`)
                            consequenceNodes = clauseNode.children.slice(1)
                            trimFluff(consequenceNodes)
                            let consequence = consequenceNodes.map(each=>translateInner(each, {context:"if_consequence"})).join("")
                            chunks.push(
                                consequenceNodes[0].indent + consequence
                            )
                        }
                    }
                }
                return chunks.join("")
                // FIXME: handle the semicolon that can appear before the then
                // return node.children.map(translateInner).join("").replace(/\s*;\s*\)\s+\{;?/g, ") {")

                // let condition1 = []
                // let consequence1 = []
                // let others = []
                // let foundThen = false
                // var i=-1
                // for (let each of node.children) {
                //     i++
                //     if (each.type == "then") {
                //         foundThen = true
                //         continue
                //     }
                //     if (!foundThen) {
                //         condition1.push(each)
                //         continue
                //     }
                //     if (["fi","else_clause","elif_clause"].includes(each.type)) {
                //         break
                //     }
                //     consequence1.push(each)
                // }
                // let output = []
                // output.push(`if (${convertArgs(condition1)})`)

                // for (const each of node.children.slice(i)) {
                //     if (each.type == "fi") {
                //         break
                //     }
                //     if (each.type == "else_clause") {
                //         others.push(each)
                //         break
                //     }
                // }
                
                // <if_statement>
                //     <if text="if" />
                //     <whitespace text=" " />
                //     <test_command>
                //         <"[[" text="[[" />
                //         <whitespace text=" " />
                //         <binary_expression>
                //             <string>
                //                 <"\"" text="\"" />
                //                 <simple_expansion>
                //                     <"$" text="$" />
                //                     <variable_name text="name" />
                //                 </simple_expansion>
                //                 <"\"" text="\"" />
                //             </string>
                //             <whitespace text=" " />
                //             <"==" text="==" />
                //             <whitespace text=" " />
                //             <string>
                //                 <"\"" text="\"" />
                //                 <string_content text="Alice" />
                //                 <"\"" text="\"" />
                //             </string>
                //         </binary_expression>
                //         <whitespace text=" " />
                //         <"]]" text="]]" />
                //     </test_command>
                //     <";" text=";" />
                //     <whitespace text=" " />
                //     <then text="then" />
                //     <whitespace text="\n  " />
                //     <command>
                //         <command_name>
                //             <word text="echo" />
                //         </command_name>
                //         <whitespace text=" " />
                //         <string>
                //             <"\"" text="\"" />
                //             <string_content text="Hi Alice!" />
                //             <"\"" text="\"" />
                //         </string>
                //     </command>
                //     <whitespace text="\n" />
                //     <elif_clause>
                //         <elif text="elif" />
                //         <whitespace text=" " />
                //         <test_command>
                //             <"[[" text="[[" />
                //             <whitespace text=" " />
                //             <binary_expression>
                //                 <string>
                //                     <"\"" text="\"" />
                //                     <simple_expansion>
                //                         <"$" text="$" />
                //                         <variable_name text="name" />
                //                     </simple_expansion>
                //                     <"\"" text="\"" />
                //                 </string>
                //                 <whitespace text=" " />
                //                 <"==" text="==" />
                //                 <whitespace text=" " />
                //                 <string>
                //                     <"\"" text="\"" />
                //                     <string_content text="Bob" />
                //                     <"\"" text="\"" />
                //                 </string>
                //             </binary_expression>
                //             <whitespace text=" " />
                //             <"]]" text="]]" />
                //         </test_command>
                //         <";" text=";" />
                //         <whitespace text=" " />
                //         <then text="then" />
                //         <whitespace text="\n  " />
                //         <command>
                //             <command_name>
                //                 <word text="echo" />
                //             </command_name>
                //             <whitespace text=" " />
                //             <string>
                //                 <"\"" text="\"" />
                //                 <string_content text="Hi Bob!" />
                //                 <"\"" text="\"" />
                //             </string>
                //         </command>
                //         <whitespace text="\n" />
                //     </elif_clause>
                //     <else_clause>
                //         <else text="else" />
                //         <whitespace text="\n  " />
                //         <command>
                //             <command_name>
                //                 <word text="echo" />
                //             </command_name>
                //             <whitespace text=" " />
                //             <string>
                //                 <"\"" text="\"" />
                //                 <string_content text="Who are you?" />
                //                 <"\"" text="\"" />
                //             </string>
                //         </command>
                //         <whitespace text="\n" />
                //     </else_clause>
                //     <fi text="fi" />
                // </if_statement>
            // 
            // for
            // 
            } else if (node.type == "done") {
                return `\n${node.indent}}`
            } else if (node.type == "do_group") {
                return node.children.map(each=>translateInner(each, { context: "do_group" })).join("")
            } else if (node.type == "for_statement"||node.type =="c_style_for_statement") {
                let nodes = []
                let foundGroup = false
                for (const each of node.children) {
                    if (each.type == "do_group") {
                        break
                    }
                    nodes.push(each)
                }
                const forPart = nodes.map(each=>each.text).join("")
                let match
                let front = fallbackTranslate({text:forPart})
                // for x in "$@"; 
                // for x in $@; 
                if (match=forPart.match(/for\s+(\w+)\s+in\s+"?\$@"?\s*;?/)) {
                    front = `for (${accessEnvVar(match[1])} of Deno.args) `
                // for ((x = 0; x < $VN; x++)); 
                } else if (match = forPart.match(/^for\s+\(\((.+;.+;.+)\)\)\s*/)) {
                    front = `for (${translateDoubleParensContent(match[1], "for")}) `
                // for i in {1..3};
                // for x in $(seq 1 $(ulimit -n));
                } else if (match = forPart.match(/^for\s+(.+?)\s+in\s+(.+?)\s*;?\s*$/)) {
                    const [, varName, inExpr] = match
                    if (inExpr.match(/^{(\d+)\.\.(\d+)}$/)) {
                        const [ , start, end ] = inExpr.match(/^{(\d+)\.\.(\d+)}$/)
                        front = `for (${accessEnvVar(varName)} = ${start}; ${accessEnvVar(varName)} <= ${end}; ${accessEnvVar(varName)}++) `
                    } else {
                        const commandLike = node.children.filter(each=>!(["for","in","whitespace","comment","variable_name"].includes(each.type)))[0]
                        const translated = translateInner(commandLike, { context: "for_loop" })
                        front = `// ${nodes.map(each=>each.text).join("")}\n${node.indent}for (${accessEnvVar(varName)} of iterateOver(${translated.asJsStringValue||translated.asJsValue})) `
                    }
                }
                // TODO: for loops that use brackets instead of "do ... done"
                return front + "{\n" + translateInner(node.quickQueryFirst(`(do_group)`), { context: "do_group" })
            // 
            // while
            // 
            } else if (node.type == "do") {
                return ""
            } else if (node.type == "while_statement") {
                let nodes = []
                let foundGroup = false
                let front = ""
                for (const each of node.children) {
                    if (each.type == "do_group") {
                        break
                    }
                    if (each.type == "test_command") {
                        front = `while (${convertBashTestToJS(each.text)}) `
                    }
                    nodes.push(each)
                }
                const whilePart = nodes.map(each=>each.text).join("")
                if (whilePart.match(/^while\s+(true|:)\s*;?\s*$/)) {
                    front = `while (true) `
                }
                front = front || fallbackTranslate({text:whilePart})
                // let match = whilePart.match(/^while\s+(.+?)\s+in\s+(.+?)\s*;?\s*$/)
                return front + "{\n" + translateInner(node.quickQueryFirst(`(do_group)`), { context: "do_group" })
            // 
            // compound_statement
            // 
            } else if (node.type == "compound_statement") {
                return node.children.map(translateInner).join("")
            // 
            // function
            // 
            } else if (node.type == "function_definition") {
                const prefixNodes = node.children.filter(each=>each.type != "compound_statement")
                const functionName = prefixNodes.filter(each=>each.type=="word")[0].text
                const functionBody = node.quickQueryFirst(`(compound_statement)`).children.filter(each=>each.type!="{"&&each.type!="}").map(each=>translateInner(each, { context: "function_definition" })).join("")
                functionNames.push(functionName)
                return `// FIXME: you'll need to custom verify this function usage: ${functionName}\n${node.indent}async function ${functionName}(...args) { const { local, env } = makeScope({ args })\n${functionBody}\n${node.indent}}`
                // return node.children.map(each=>translateInner(each, { context: "function_definition" })).join("")
            // 
            // misc
            // 
            } else if (node.type == "`") {
                console.warn('node.type == "`"', new Error().stack)
                return {
                    asJsBacktickStringInnards: ""
                }
            } else if (node.type == "\"") {
                return {
                    asJsBacktickStringInnards: ""
                }
            // TODO: remove this once the bash parser is fixed: https://github.com/tree-sitter/tree-sitter-bash/issues/306
            } else if (node.type == "$") {
                return {
                    asJsBacktickStringInnards: `\\$`
                }
            // 
            // 
            // basic args
            // 
            // 
            } else if (node.type == "number") {
                return {
                    source: "number",
                    asDaxArgUnquoted: node.text,
                    asDaxArgSingleQuoteInnards: node.text,
                    asJsBacktickStringInnards: node.text,
                    asJsNumber: node.text,
                    asJsValue: node.text,
                    asJsConditional: node.text,
                }
            } else if (node.type == "word") {
                let text = node.text
                text = bashUnescape(text)
                text = escapeJsString(text).slice(1, -1)
                // handle home expansion
                if (text.match(/^~/)) {
                    text.replace(/^~/,()=>"\${env.HOME}")
                }
                // TODO: glob expansion
                // TODO: some brace expansion ends up here
                // FIXME: probably some other special stuff like !
                return {
                    source: "word",
                    asDaxArgUnquoted: node.text.replace(/['*!{} ]+/g,`"$&"`),
                    asDaxArgSingleQuoteInnards: node.text.replace(/'/g,`'"'"'`),
                    asJsBacktickStringInnards: text,
                    asJsValue: `\`${text}\``,
                }
            } else if (node.type == "raw_string") {
                const text = escapeJsString(node.text.slice(1, -1))
                return {
                    source: "raw_string",
                    // asDaxArgUnquoted: text, // normally we'd need to escape single quotes, but there won't be any here
                    asDaxArgSingleQuoteInnards: text, // normally we'd need to escape single quotes, but there won't be any here
                    asJsBacktickStringInnards: text.slice(1, -1),
                    asJsValue: text,
                }
            } else if (node.type == "brace_expression") {
                const rangeArray = rangeToArray(node.text)
                return {
                    source: "brace_expression",
                    asJsArray: JSON.stringify(rangeArray),
                    items: rangeArray,
                    isMultiplier: true,
                }
            } else if (node.type == "simple_expansion") {
                const rawVarName = node.text.replace(/^\$\{?|\}?$/g,"")
                const varAccess = accessEnvVar(rawVarName)
                return {
                    source: "simple_expansion",
                    asDaxArgUnquoted: `\${${varAccess}}`,
                    asDaxArgSingleQuoteInnards: `\${${varAccess}}`,
                    asJsStringValue: varAccess,
                    asJsValue: varAccess,
                    asJsBacktickStringInnards: `\${${varAccess}}`,
                }
            } else if (node.type == "array") {
                const unifiedArgs = unifyArgs(node.children.filter(each=>each.type!="("&&each.type!=")"), { translateInner })
                return {
                    source: "array",
                    asJsArray: unifiedArgs.asJsArray,
                }
            } else if (node.type == "command_substitution") {
                const realChildren = node.children.filter(each=>each.type!="whitespace"&&each.type!="comment").slice(1,-1) // to remove the $( and )
                // e.g. translate the <pipeline> or <list> or <command>
                const translated = translateInner(realChildren[0], {context:"command_substitution"})
                if (!translated) {
                    console.debug(`xmlStylePreview(realChildren[0]) is:`,xmlStylePreview(realChildren[0]))
                }
                const output = {
                    source: "command_substitution",
                    asDaxArgUnquoted: `\${${translated.asDaxCallToSub}}`,
                    asJsValue: `${translated.original?.asJsStringValue||translated.original?.asJsValue||translated.asDaxCallToSub||translated.asJsValue}`,
                    asDaxCallToSub: translated.asDaxCallToSub,
                }
                // if its not just an interpolation, then it would be preferable
                if (translated.asJsBacktickStringInnards && !translated.asJsBacktickStringInnards.match(/^\$\{([^a]|a)+\}$/)) {
                    output.asJsBacktickStringInnards = translated.asJsBacktickStringInnards
                }
                return output
            } else if (node.type == "arithmetic_expansion") {
                const asJsValue = translateDoubleParensContent(node.text.slice(3,-2))
                return {
                    source: "arithmetic_expansion",
                    asJsValue,
                    asJsBacktickStringInnards: `\${${asJsValue}}`
                }
            } else if (node.type == "string_content") {
                const text = escapeJsString(bashUnescape(node.text)).slice(1, -1)
                const output = {
                    source: "string_content",
                    asJsBacktickStringInnards: text,
                }
                if (validAsUnquotedDaxArgNoInterpolation(text)) {
                    output.asDaxArgUnquoted = text
                }
                return output
            } else if (node.type == "string") {
                const translatedNodes = node.children.slice(1,-1).map(translateInner)
                if (translatedNodes.length == 1) {
                    return translatedNodes[0]
                }
                const output = {
                    source: "string",
                }
                if (translatedNodes.every(each=>each.asDaxArgUnquoted)) {
                    output.asDaxArgUnquoted = ()=>{
                        return translatedNodes.map(each=>each.asDaxArgUnquoted).join("")
                    }
                }
                if (translatedNodes.every(each=>each.asJsBacktickStringInnards||each.asDaxArgUnquoted)) {
                    output.asJsBacktickStringInnards = ()=>{
                        return translatedNodes.map(each=>each.asJsBacktickStringInnards||each.asDaxArgUnquoted).join("")
                    }
                }
                if (translatedNodes.every(each=>each.asJsValue)) {
                    output.asDaxArgSingleQuoteInnards = ()=>{
                        return "<string>"+translatedNodes.map(each=>each.asDaxArgSingleQuoteInnards||`\${${each.asJsValue}}`).join("")+"</string>"
                    }
                }
                return output
            } else if (node.type == "concatenation" || node.type == "command_name") {
                const translatedNodes = node.children.map(translateInner)
                let output = {
                    source: "concatenation",
                }
                if (translatedNodes.every(each=>each.asDaxArgUnquoted)) {
                    output.asDaxArgUnquoted = ()=>{
                        return translatedNodes.map(each=>each.asDaxArgUnquoted).join("")
                    }
                }
                if (translatedNodes.every(each=>each.asJsBacktickStringInnards||each.asDaxArgUnquoted)) {
                    output.asJsBacktickStringInnards = ()=>{
                        return translatedNodes.map(each=>each.asJsBacktickStringInnards||each.asDaxArgUnquoted).join("")
                    }
                }
                if (translatedNodes.every(each=>each.asJsValue)) {
                    output.asDaxArgSingleQuoteInnards = ()=>{
                        return translatedNodes.map(each=>each.asDaxArgSingleQuoteInnards||`\${${each.asJsValue()}}`).join("")
                    }
                }
                return output
            } else if (node.type == "ansi_c_string") {
                let text = node.text.slice(2, -1)
                text = ansiUnescape(text)
                text = escapeJsString(text).slice(1, -1)
                return {
                    source: "ansi_c_string",
                    // asDaxArgUnquoted: text.replace(/'/g,`'"'"'`),
                    asDaxArgSingleQuoteInnards: text.replace(/'/g,`'"'"'`),
                    asJsBacktickStringInnards: text,
                }
            } else if (node.type == "expansion") {
                const varName = node.quickQueryFirst(`(variable_name)`).text
                usedEnvVars = true
                const varEscaped = accessEnvVar(varName)
                const debugReference = node.children.slice(1,-1).map(each=>each.text).join("")
                const operation = node.children.slice(1,-1).filter(each=>each.type!="variable_name").map(each=>each.text).join("")
                let output
                if (operation.trim() == "") {
                    output = `${varEscaped}`
                } else if (debugReference.startsWith("#")) {
                    output = `${varEscaped}.length`
                } else if (operation=="^^") {
                    output = `${varEscaped}.toUpperCase()`
                // } else if (operation.trim().startsWith("-")) {
                } else {
                    output = `${varEscaped}/* FIXME: ${escapeComment(debugReference)} */`
                }
                return {
                    source: "expansion",
                    asDaxArgUnquoted: `$${varName}`,
                    asJsStringValue: output,
                }
            // 
            // couldn't translate
            // 
            } else {
                if (statementContexts.includes(context)) {
                    return fallbackTranslate(node)
                } else {
                    return {
                        source: "fallback",
                        asJsStatement: node.text
                    }
                }
            }
        } catch (error) {
            console.warn(`[translateInner] major error:`,error.stack)
            return fallbackTranslate(node)
        }
    }

    return asCachedGetters({
        jsCode: ()=>translateInnerBase(node),
        xmlStylePreview: ()=>xmlStylePreview(node),
    })
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
function ansiUnescape(str) {
    return str.replace(
        /\\(\\|"|a|b|e|E|f|n|r|t|v|\$|'|\\?|x[0-9A-Fa-f]{1,2}|[0-7]{1,3})|u[0-9A-Fa-f]{1,4}|U[0-9A-Fa-f]{1,8}|cx/g,
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
                case "'": return "'";
                case "?": return "?";
                default:
                    if (/^x[0-9A-Fa-f]{1,2}$/.test(seq)) {
                        return String.fromCharCode(parseInt(seq.slice(1), 16))
                    }
                    if (/^[0-7]{1,3}$/.test(seq)) {
                        return String.fromCharCode(parseInt(seq, 8))
                    }
                    if (/^u[0-9A-Fa-f]{1,4}$/.test(seq)) {
                        return String.fromCharCode(parseInt(seq.slice(1), 16))
                    }
                    if (/^U[0-9A-Fa-f]{1,8}$/.test(seq)) {
                        return String.fromCharCode(parseInt(seq.slice(1), 16))
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