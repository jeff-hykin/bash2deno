import { build$, default as $$ } from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts"
import process from "node:process"
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
export var _$ = build$({commandBuilder: (builder) => builder.exportEnv().noThrow(), })
export var $ = Object.assign((strings,...args)=>{
    strings = [...strings]
    const firstWord = strings[0].trim().split(" ")[0]
    if (firstWord.match(new RegExp("^("+Object.keys(aliases).sort().join("|")+")$"))) {
        strings[0] = aliases[firstWord]
    }
    return _$(strings,...args)
},$$)
export const aliases = {}
export const $stdout = [ Deno.stdout.readable, {preventClose:true} ]
export const $stderr = [ Deno.stderr.readable, {preventClose:true} ]
export const appendTo = (pathString)=>$$.path(pathString).openSync({ write: true, create: true, truncate: false })
export const overwrite = (pathString)=>$$.path(pathString).openSync({ write: true, create: true })
export const hasCommand = (cmd)=>$$.commandExistsSync(cmd)

export const makeScope = ({ args })=>{
    if (!(args instanceof Array)) {
        throw Error(`[bash2deno] when calling makeScope, args must be an array instead it was ${typeof args}`)
    }
    const localOnlyVars = {}
    const local = new Proxy(
        env,
        {
            ownKeys(original) {
                return Object.keys({...Deno.env.toObject(), ...localOnlyVars})
            },
            getOwnPropertyDescriptor(original, prop) {
                return {
                    enumerable: true,
                    configurable: true,
                    value: local[prop],
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
    return { local, env }
}

export const asStr = (...args)=>{
    return $(args).text()
}