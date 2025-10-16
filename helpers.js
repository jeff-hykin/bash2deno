// it'd be nice if I knew another way to get "$0", but until then I'm using process.argv[1]
import process from "node:process"

// basically just shorthand
export const $stdout = [ Deno.stdout.readable, {preventClose:true} ]
export const $stderr = [ Deno.stderr.readable, {preventClose:true} ]
export const aliases = {}

// helper for controlling env vars
export const env = new Proxy(
    {},
    {
        ownKeys(original) {
            return Object.keys(Deno.env.toObject())
        },
        getOwnPropertyDescriptor(original, prop) {
            return {
                enumerable: true,
                configurable: true,
                value: Deno.env.get(prop),
            }
        },
        has(original, key) {
            if (typeof key === 'symbol') {
                return false
            } else {
                return Deno.env.get(key) !== undefined
            }
        },
        get(original, key) {
            if (typeof key === 'symbol') {
                return original[key]
            } else {
                if (key=='@') {
                    return Deno.args
                }
                if (key=='*') {
                    return Deno.args.join(" ")
                }
                if (key=='#') {
                    return Deno.args.length
                }
                if (key=='$') {
                    return Deno.pid
                }
                if (key=='?') {
                    return exitCodeOfLastChildProcess
                }
                if (key.match(/^[0-9]+$/)) {
                    if (key === "0") {
                        return process.argv[1]
                    }
                    return Deno.args[key]
                }
                return Deno.env.get(key)||""
            }
        },
        set(original, key, value) {
            original[key] = value
            if (typeof key !== 'symbol') {
                Deno.env.set(key, value)
            }
            return true
        },
        deleteProperty(original, key) {
            if (typeof key === 'symbol') {
            } else {
                Deno.env.delete(key)
            }
            return true
        },
    }
)

export function initHelpers({ dax, iDontNeedDollarQuestionMark=false }) {
    // use custom dax builder to make it match bash more closely
    const $exportEnvNoThrow = dax.build$({
        commandBuilder: (builder) => builder
            .exportEnv()
            .noThrow()
            .registerCommand("seq", async (context) => {
                if (context.args.length == 1) {
                    await context.stdout.writeLine(`${context.args[0]}`)
                    return {
                        kind: "continue",
                        code: 0,
                    }
                } else if (context.args.length == 2) {
                    const start = parseInt(context.args[0])
                    const end = parseInt(context.args[1])
                    for (let i = start; i <= end; i++) {
                        await context.stdout.writeLine(`${i}`)
                    }
                    return {
                        kind: "continue",
                        code: 0,
                    }
                } else if (context.args.length == 3) {
                    const start = parseInt(context.args[0])
                    const end = parseInt(context.args[1])
                    const step = parseInt(context.args[2])
                    for (let i = start; i <= end; i += step) {
                        await context.stdout.writeLine(`${i}`)
                    }
                    return {
                        kind: "continue",
                        code: 0,
                    }
                } else if (context.args.length >= 4) {
                    await context.stderr.writeLine(`seq: extra operand ‘5’\nTry 'seq --help' for more information.`)
                    return {
                        kind: "continue",
                        code: 1,
                    }
                } else {
                    await context.stderr.writeLine(`seq: missing operand\nTry 'seq --help' for more information.`)
                    return {
                        kind: "continue",
                        code: 1,
                    }
                }
            })
            .registerCommand("true", () => Promise.resolve({ code: 0 }),)
            .registerCommand("false", () => Promise.resolve({ code: 1 }),)
    })
    // allow this to be changed dynamically to support features like "set -e"
    const settings = {
        _underlyingDaxFunc: $exportEnvNoThrow,
    }
    
    // wrap the dax function to 
    // 1. support aliases and
    // 2. make it possible to dynamically change the default dax function to support bash features like "set -e" and toggling globbing
    const wrappedDax = (strings,...args)=>{
        strings = [...strings]
        const firstWord = strings[0].trim().split(" ")[0]
        if (firstWord.match(new RegExp("^("+Object.keys(aliases).sort().join("|")+")$"))) {
            strings[0] = aliases[firstWord]
        }
        return settings._underlyingDaxFunc(strings,...args)
    }
    // add all dax helpers
    const $ = Object.assign(wrappedDax, dax.$, {
        // $.str`echo hi`
        str: (strings, ...args)=>{
            return $(strings, ...args).text()
        },
        // $.success`echo hi`
        success: (strings, ...args)=>{
            return Promise.resolve($(strings, ...args)).then(({code})=>code===0)
        },
    })

    let exitCodeOfLastChildProcess = 0
    // the converter will automatically set iDontNeedDollarQuestionMark to false if it does not detect any use of "$?"
    // why? because "$?" needs a monkeypatch (below) in order to work okayish-ly (e.g. it assumes everything is immediately awaited)
    // if you don't care about "$?" please set iDontNeedDollarQuestionMark to false
    if (!iDontNeedDollarQuestionMark) {
        function monkeyPatch(object, attrName, createNewFunction) {
            let prevObj = null
            while (!Object.getOwnPropertyNames(object).includes(attrName)) {
                prevObj = object
                object = Object.getPrototypeOf(object)
                if (prevObj === object) {
                    throw new Error(`Could not find ${attrName} on ${object}`)
                }
            }
            const originalFunction = object[attrName]
            let theThis
            const wrappedOriginal = function(...args) {
                return originalFunction.apply(theThis, args)
            }
            const innerReplacement = createNewFunction(wrappedOriginal)
            object[attrName] = function(...args) {
                theThis = this
                return innerReplacement.apply(this, args)
            }
        }
        monkeyPatch(Deno.Command.prototype, "spawn", (original)=>(...args)=>{
            const process = original(...args)
            process.status.then((status)=>{
                exitCodeOfLastChildProcess = status.code
            })
            return process
        })
    }
    
    const makeScope = ({ args })=>{
        if (!(args instanceof Array)) {
            throw Error(`[bash2deno] when calling makeScope, args must be an array instead it was ${typeof args}`)
        }
        const localOnlyVars = {}
        const localEnv = new Proxy(
            env,
            {
                ownKeys(original) {
                    return Object.keys({...Deno.env.toObject(), ...localOnlyVars})
                },
                getOwnPropertyDescriptor(original, prop) {
                    return {
                        enumerable: true,
                        configurable: true,
                        value: localEnv[prop],
                    }
                },
                has(original, key) {
                    if (typeof key === 'symbol') {
                        return false
                    } else {
                        return localVarNames[key] !== undefined || Deno.env.get(key) !== undefined
                    }
                },
                get(original, key) {
                    if (typeof key === 'symbol') {
                        return original[key]
                    } else {
                        if (key=='@') {
                            return args
                        }
                        if (key=='*') {
                            return args.join(" ")
                        }
                        if (key=='#') {
                            return args.length
                        }
                        if (key=='$') {
                            return Deno.pid
                        }
                        if (key=='?') {
                            return exitCodeOfLastChildProcess
                        }
                        if (key.match(/^[0-9]+$/)) {
                            if (key === "0") {
                                return process.argv[1]
                            }
                            return args[key]
                        }
                        if (localVarNames[key] !== undefined) {
                            return localOnlyVars[key]||""
                        }
                        return Deno.env.get(key)||""
                    }
                },
                set(original, key, value) {
                    original[key] = value
                    if (typeof key !== 'symbol') {
                        Deno.env.set(key, value)
                    }
                    return true
                },
                deleteProperty(original, key) {
                    if (localVarNames[key] !== undefined) {
                        delete localOnlyVars[key]
                    }
                    if (typeof key === 'symbol') {
                    } else {
                        Deno.env.delete(key)
                    }
                    return true
                },
            }
        )
        return { local: localOnlyVars, env: localEnv }
    }
    
    const appendTo = (pathString)=>dax.$.path(pathString).openSync({ write: true, create: true, truncate: false })
    const overwrite = (pathString)=>dax.$.path(pathString).openSync({ write: true, create: true })
    const hasCommand = (cmd)=>dax.$.commandExistsSync(cmd)

    return { 
        $,
        appendTo,
        overwrite,
        hasCommand,
        makeScope,
        settings,
    }
}