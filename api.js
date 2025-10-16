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
    // splats (might be fixed upstream soon)
    // OS checks
    // case 
    // functions
        // set/use exitCodeOfLastChildProcess
    // basic $?
    // unalias
    // heredocs
// 2.0 goal:
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

export function translate(code, { withHeader=true }={}) {
    const node = parser.parse(code).rootNode
    
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
    
    let inPipeline = false

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
            return text.replace(/\$?\{?\w+\}?/g,(matchString)=>accessEnvVar(matchString))
        }

        const fallbackTranslate = (node)=>"/* FIXME: " + node.text.replace(/\*\//g, "* /") + " */"

        function convertArg(node, {context}={}) {
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
                // <concatenation>
                // <ansi_c_string> AKA $''
            if (node.type == "word"||node.type == "number") {
                let text = node.text
                text = text.replace(/\\([a]|[^a])/g, "$1")
                // TODO: glob expansion
                // TODO: some brace expansion ends up here
                // FIXME: probably some other special stuff like !
                return escapeJsString(text).slice(1, -1)
            } else if (node.type == "`") {
                return ""
            } else if (node.type == "array") {
                return convertArgs(node.children.filter(each=>each.type!="("&&each.type!=")"), {asArrayString: context=="variable_assignment"} )
            } else if (node.type == "command_substitution") {
                const out = ()=>`\${${node.children.map(translateInner).join("")}.text()}`
                out.toString = out
                return out
            } else if (node.type == "arithmetic_expansion") {
                return `\${${translateDoubleParensContent(node.text.slice(3,-2))}}`
            } else if (node.type == "raw_string") {
                return escapeJsString(node.text.slice(1, -1)).slice(1, -1)
            } else if (node.type == "simple_expansion") {
                const rawVarName = node.text.replace(/^\$\{?|\}?$/g,"")
                const out = ()=>`\${${accessEnvVar(rawVarName)}}`
                // for easy joining later
                out.toString = out
                return [ out ]
            } else if (node.type == "string_content") {
                return escapeJsString(bashUnescape(node.text)).slice(1, -1)
            } else if (node.type == "\"") {
                return ""
            } else if (node.type == "string") {
                let output = node.children.map(convertArg).join("")
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
                    output = `${varEscaped}/* FIXME: ${debugReference} */`
                }
                return `\${${output}}`
            // TODO: remove this once the bash parser is fixed: https://github.com/tree-sitter/tree-sitter-bash/issues/306
            } else if (node.type == "$") {
                return "\\$"
            } else {
                console.warn(`[convertArg] unhandled node type:`,node.type, new Error().stack.split("\n").slice(3,4).join("\n"))
                return null
            }
        }

        function convertArgs(nodes, {asArrayString=false, asArray=false, asSingleString=false, debug=false, context=null} = {}) {
            if (typeof nodes == "string") {
                const root = parser.parse(": "+nodes).rootNode
                nodes = root.quickQueryFirst(`(command)`).children.slice(2)
            }
            let currentArg = []
            let createNewArg = true // this is to handle annoying edge cases by lazily creating new args
            const args = []
            let escapedNewline = false
            // console.debug(`nodes.map(each=>each.text) is:`,nodes.map(each=>each.text))
            let nodeToConverted = new Map() // DEBUGGING
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
                const converted = convertArg(eachNode, {context})
                nodeToConverted.set(eachNode, converted)
                // fail
                if (converted == null) {
                    console.warn(`[convertArgs] failed to convert arg: (${eachNode.type})`, JSON.stringify(eachNode.text))
                    return null
                }
                currentArg.push(...[converted].flat(Infinity))
            }
            
            // args should be an array of array of (strings or functions)
                // each function returns a string
                // each string is js backticks escaped
            // console.debug(`args is:`,args)

            // TODO: handle the case of part of an arg being a function (e.g. splat, range, subshell, etc)
            // debug && console.debug(`args is:`,args)
            if (asArray) {
                return args.map(each=>each.join(""))
            } else if (asSingleString) {
                if (args.length == 1 && args[0].length == 1) {
                    const onlyArg = args[0][0]
                    if (onlyArg.toString().startsWith("${") && onlyArg.toString().endsWith("}")) {
                        return onlyArg.toString().slice(2,-1)
                    // dont quote numbers
                    } else if (onlyArg.toString().match(/^\d+(\.\d+)?$/)) {
                        return onlyArg.toString()
                    }
                }
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
                                if (!each?.toString) {
                                    console.warn(`[translateInner] failed during convertArgs:`,args)
                                    // console.warn(`[translateInner] failed during convertArgs:`,nodeToConverted)
                                    return ""
                                }
                                return each.toString()
                            }
                        }).join("")
                    )
                }
                return "`"+argStrings.join(" ")+"`"
            }
        }

        function convertBashTestToJS(expr) {
            expr = expr.trim()

            let negated = ""
            if (expr.match(/^!\s+/)) {
                expr = expr.replace(/^!\s+/,"")
                negated = "!"
            }
            const asSingleString = (arg)=>convertArgs(arg, {asSingleString: true})
            
            let match
            // 
            // command exists check
            // 
            if (match=expr.match(/\[\[?\s+-n\s+"?\$\((?:command\s+-v|which)\s+(.+?)\)"?\s+\]\]?/)) {
                usesHasCommand = true
                return `${negated} hasCommand(${convertArgs(match[1], {asSingleString: true})})`
            }
            if (match=expr.match(/\[\[?\s+-z\s+"?\$\((?:command\s+-v|which)\s+(.+?)\)"?\s+\]\]?/)) {
                usesHasCommand = true
                return `${negated?"":"!"} hasCommand(${convertArgs(match[1], {asSingleString: true})})`
            }
            
            // 
            // -n
            // 
            if (match=expr.match(/\[\[?\s+-n\s+(.+?)\s+\]\]?/)) {
                if (negated) {
                    return `${asSingleString(match[1])}.length == 0`
                } else {
                    return `${asSingleString(match[1])}.length > 0`
                }
            }
            // 
            // -z
            // 
            if (match=expr.match(/\[\[?\s+-z\s+(.+?)\s+\]\]?/)) {
                if (negated) {
                    return `${asSingleString(match[1])}.length > 0`
                } else {
                    return `${asSingleString(match[1])}.length == 0`
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
                let left = convertArgs(leftRaw.trim(), {debug:false, asSingleString: true })
                let right = convertArgs(rightRaw.trim(),{debug:false, asSingleString: true})
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
    // main "switch"
    // 
    // 
    function translateInner(node, {context=null}={}) {
        const translateSelfCallHelper = (node,options={})=>translateInner(node, {context, ...options})
        try {
            // this is a way of making sure context is passed down by default
            const translateInner = translateSelfCallHelper
            const statementContexts = ["program", "do_group", "function_definition"]
            let usedLocalEnvVars = false
            if (node.type == "program") {
                const contents = node.children.map(each=>translateInner(each, {context:"program"})).join("")
                const header = !withHeader ? [] : [
                    `import fs from "node:fs"`,
                    `import * as dax from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts" // see: https://github.com/dsherret/dax`,
                    `import { env, aliases, $stdout, $stderr, initHelpers } from "https://esm.sh/gh/jeff-hykin/bash2deno@0.1.0.0/helpers.js"`,
                    `const { $, appendTo, overwrite, hasCommand, makeScope, settings } = initHelpers({ dax })`,
                ]
                return header.join("\n")+"\n"+contents
            } else if (node.type == "$(" || node.type == ")" || node.type == "`") {
                return ""
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
                
                // note: all internals are already escaped for JS
                const convertedArgs = convertArgs(argNodes, {asSingleString: true, context:"variable_assignment"})
                if (convertedArgs == null) {
                    return fallbackTranslate(node)
                } else if (context == "local_variable_assignment") {
                    return `local${escapeJsKeyAccess(varNameNode.text)} = ${convertedArgs}`
                } else {
                    return `${accessEnvVar(varNameNode.text)} = ${convertedArgs}`
                }
            } else if (node.type == "unset_command") {
                // TODO: account for flags/args for unset (e.g. unset function)
                const rawVarName = node.text.replace(/^unset\s*/,"")
                return `delete ${accessEnvVar(rawVarName)}`
            // 
            // command/alias
            // 
            } else if (node.type == "command") {
                // handle one-off env vars
                let envChunks = []

                

                // NOTE: alias is part of command
                // FIXME: command_name
                const commandNameNode = node.quickQueryFirst(`(command_name)`)
                const argNodes = node.children.filter(each=>each.type!="command_name" && each.type!="variable_assignment")
                // DAX handles this
                const getEnvPrefix = ()=>node.children.filter(each=>each.type=="variable_assignment").join(" ")
                if (commandNameNode.text == "alias") {
                    const aliasName = node.text.match(/^alias\s+(\w+)=/)[1]
                    const aliasValue = node.text.replace(/^alias\s+(\w+)=/,"")
                    return `aliases${escapeJsKeyAccess(aliasName)} = ${convertArgs(aliasValue, {asSingleString: true})}`
                } else if (commandNameNode.text == "set") {
                    // 
                    // set
                    // 
                    return fallbackTranslate(node)
                } else if (commandNameNode.text == "return") {
                    return `return exitCodeOfLastChildProcess = ${node.text.replace(/^return\s*/,"")}`
                } else if (commandNameNode.text == "continue") {
                    return `continue`
                } else if (commandNameNode.text == "break") {
                    return `break`
                } else if (commandNameNode.text == "read") {
                    const args = convertArgs(argNodes, {asArray: true})
                    let numberedArgs = []
                    let skipNextArg = false
                    let envVarArg
                    let promptArg =  ""
                    for (let each of args) {
                        if (["-d","-i","-n","-N","-p","-t","-u"].includes(each)) {
                            skipNextArg = each
                            continue
                        }
                        if (skipNextArg) {
                            if (skipNextArg == "-p") {
                                promptArg = each
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
                    return `env${escapeJsKeyAccess(envVarArg)} = prompt(${promptArg})`
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
                } else if (commandNameNode.text == "echo" && statementContexts.includes(context)) {
                    // slice gets rid of "echo "
                    // TODO: handle echo -n
                    const convertedArgs = convertArgs(argNodes, {asArray: true})
                    if (convertedArgs == null) {
                        if (node.quickQueryFirst(`(variable_assignment)`)) {
                            console.warn(`[echo] failed to convert command:`,xmlStylePreview(node))
                        }
                        return fallbackTranslate(node)
                    }
                    let output = `console.log(\`${convertedArgs.join(" ")}\`)`
                    if ([...output.matchAll(/\n/g)].length <= 2) {
                        // prefer inline newlines. Note this should never alter functionality, even on interpolated things
                        output = output.replace(/\n/g,"\\n")
                    }
                    return output
                } else {
                    const convertedArgs = convertArgs([ commandNameNode, ...argNodes ])
                    if (convertedArgs == null) {
                        return fallbackTranslate(node)
                    }
                    return  "await $"+convertedArgs.replace(/^\`/,()=>"`"+getEnvPrefix())
                }
            // 
            // redirection
            // 
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
                const commandNode = node.children[0]
                // const inner = translateInner(commandNode).slice(8)
                const length = "await $".length
                const inner = commandNode.type == "command" ? convertArgs(commandNode.children) : translateInner(commandNode).slice(length)
                if (inner == null) {
                    console.warn(`[redirected_statement] failed to translate command (${commandNode.type}):`,commandNode.text)
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
                    const convertedArgs = inner
                    // const convertedArgs = convertArgs(commandNode.children)
                    if (convertedArgs == null) {
                        return fallbackTranslate(node)
                    }
                    // manually handle combined redirect
                    if (redirects[0].text[0] == "&") {
                        const redirect = parseOutputRedirect(redirects[0])
                        if (!redirect) {
                            return fallbackTranslate(node)
                        }
                        return `await $${convertedArgs}.stdout(${redirect.target}).stderr(${redirect.target})`
                    }
                    return `await $${convertedArgs.slice(0,-1)} ${redirects[0].text}\``
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
                    // convertArgs(commandNode.children)
                    return `await $${inner.slice(0,-1)}\`${stdoutString}${stderrString}`
                }
            // 
            // pipes
            // 
            } else if (node.type == "pipeline") {
                inPipeline = true
                const commands = node.children.filter(each=>each.type == `command`||each.type == `redirected_statement`)
                const pipeInMiddle = commands.some(each=>each.type == `pipeline`&&each!=commands.at(-1))
                if (pipeInMiddle) {
                    inPipeline = false
                    return fallbackTranslate(node)
                }
                const lastCommand = commands.at(-1)
                const lastCommandConverted = translateInner(lastCommand, { context: "pipeline_last_command" })
                let failed = fallbackTranslate(lastCommand) == lastCommandConverted
                if (failed) {
                    inPipeline = false
                    return fallbackTranslate(node)
                }
                const otherCommandsConverted = commands.slice(0,-1).map(each=>convertArgs(each.children, { context: "pipeline_early_command" }))
                for (const [cmd, each] of zipLong(commands.slice(0,-1), otherCommandsConverted)) {
                    if (each == null) {
                        failed = true
                        console.warn(`[pipeline] failed to convert command:`,cmd.text)
                        console.warn(``)
                        break
                    }
                }
                // check failed
                if (failed) {
                    inPipeline = false
                    return fallbackTranslate(node)
                }
                // little bit hacky, cleanup later
                const lastPart = lastCommandConverted.replace(/^await \$\`/,"")
                const coreCommand = [ ...otherCommandsConverted.map(each=>each.slice(1,-1)), lastPart ].join(" | ")
                inPipeline = false
                return `await $\`${coreCommand}`
            // 
            // chaining
            // 
            } else if (node.type == "list") {
                function convertList(node) {
                    const commands = node.children.filter(each=>each.type == `command`||each.type == `redirected_statement`||each.type == `list`)
                    const isOr = node.children.some(each=>each.type == `||`)
                    const joiner = isOr ? "||" : "&&"
                    const baseCommands = ["command","redirected_statement"]
                    const recurseIfNeeded = (each)=>{
                        if (each.type == "list") {
                            return convertList(each)
                        } else {
                            return each
                        }
                    }
                    // base case
                    if (commands.length != 2) {
                        // FIXME: this next piece is a hack. Should do proper parsing of test_command
                        let match
                        if (match=node.text.match(/^(\[\[? .+ \]?\])\s+(\&\&|\|\|)((?:[^a]|a)+)/)) {
                            const negateString = match[2] == "&&" ? "" : " ! "
                            // convert to if statement so that things like "[[ ]] && break" work (otherwise the break will fail)
                            return translateInner(parser.parse(`
                                if ${negateString} ${match[1]}; then
                                    ${match[3]}
                                fi
                            `, {context: "list"}).rootNode.quickQueryFirst(`(if_statement)`))
                        } else {
                            console.warn(`[list] unsupported list:`,node.text)
                        }
                    } else {
                        return [ recurseIfNeeded(commands[0]), joiner, recurseIfNeeded(commands[1]) ].flat(Infinity)
                    }
                }
                let cmds = convertList(node)
                if (cmds == null) {
                    return fallbackTranslate(node)
                }
                // this happens when an &&/|| gets turned into a statement, ex: [[ a = b ]] && break
                if (typeof cmds === 'string') {
                    return cmds
                }
                // TODO: remove this once the bash parser is fixed: https://github.com/tree-sitter/tree-sitter-bash/issues/306
                cmds = cmds.filter(each=>each!=null)
                let escaped = []
                var i=-1
                for (var each of cmds) {
                    i++
                    const isLast = each == cmds.at(-1)
                    if (isLast) {
                        if (each.type == "redirected_statement") {
                            const front = `await $\``.length
                            const bad = fallbackTranslate(each)
                            const trans = translateInner(each, { context: "list_last_command" })
                            if (bad == trans) {
                                console.warn(`[list] failed to convert redirected statement:`,each.text)
                                return fallbackTranslate(node)
                            }
                            escaped.push(trans.slice(front))
                            break
                        }
                    }
                    if (each == "&&" || each == "||") {
                        escaped.push(each)
                        continue
                    }
                    // FIXME: sometimes the children are "pipeline"
                    const cmd = convertArgs(each.children||[], { context: "list_early_command" })
                    if (cmd == null) {
                        console.warn(`[list] failed to convert command:`,each.text)
                        console.warn(``)
                        return fallbackTranslate(node)
                    }
                    // normal command convert
                    escaped.push(
                        cmd.slice(1,-1) + (isLast?"`":"")
                    )
                }

                return `await $\`${escaped.join(" ")}`
                // node.quickQueryFirst(`(command) @firstCommand`).firstCommand
                // return translateInner(node.children[0])
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
                // FIXME: handle the semicolon that can appear before the then
                return node.children.map(translateInner).join("").replace(/\s*;\s*\)\s+\{;?/g, ") {")
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
            } else if (node.type == "for_statement") {
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
                } else if (match = forPart.match(/^for\s+(.+?)\s+in\s+(.+?)\s*;?\s*$/)) {
                    const [, varName, inExpr] = match
                    if (inExpr.match(/^{(\d+)\.\.(\d+)}$/)) {
                        const [ , start, end ] = inExpr.match(/^{(\d+)\.\.(\d+)}$/)
                        front = `for (${accessEnvVar(varName)} = ${start}; ${accessEnvVar(varName)} <= ${end}; ${accessEnvVar(varName)}++) `
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
                return `// FIXME: you'll need to custom verify this function usage: ${functionName}\n${node.indent}async function ${functionName}(...args) { const { local, env } = makeScope({ args })\n${functionBody}\n${node.indent}}`
                // return node.children.map(each=>translateInner(each, { context: "function_definition" })).join("")
            // 
            // couldn't translate
            // 
            } else {
                if (statementContexts.includes(context)) {
                    return fallbackTranslate(node)
                } else {
                    return node.text
                }
            }
        } catch (error) {
            console.warn(`[translateInner] major error:`,error.stack)
            return fallbackTranslate(node)
        }
    }

    return asCachedGetters({
        jsCode: ()=>translateInner(node),
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