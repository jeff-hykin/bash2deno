import { $ } from "https://deno.land/x/dax@0.38.1/mod.ts";
import { join } from "https://deno.land/std@0.212.0/path/mod.ts";

// These should be set externally as environment variables
const NIX_STORE = Deno.env.get("NIX_STORE") ?? "/nix/store";
const strictDeps = Deno.env.get("strictDeps") ?? "";
const prefix = Deno.env.get("prefix") ?? "";
const output = Deno.env.get("output") ?? "";
const outputDev = Deno.env.get("outputDev") ?? "";
const dontPatchShebangs = Deno.env.get("dontPatchShebangs") ?? "";

async function isExecutable(file: string): Promise<boolean> {
    try {
        const stat = await Deno.stat(file);
        return stat.isFile && (stat.mode ?? 0) & 0o100;
    } catch {
        return false;
    }
}

async function isScript(file: string): Promise<boolean> {
    if (!(await isExecutable(file))) return false;
    const f = await Deno.open(file);
    const buffer = new Uint8Array(1024);
    const n = await f.read(buffer);
    f.close();
    if (!n) return false;
    const text = new TextDecoder().decode(buffer.subarray(0, n));
    return text.startsWith("#!");
}

async function findExecutable(path: string, PATH: string): Promise<string | null> {
    try {
        const result = await $`PATH=${PATH} type -P ${path}`.quiet("inherit").text();
        return result.trim();
    } catch {
        return null;
    }
}

export async function patchShebangs(args: string[]) {
    let pathName = "";
    let update = false;
    let paths: string[] = [];

    const buildPATH = Deno.env.get("PATH") ?? "";
    const hostPATH = Deno.env.get("HOST_PATH") ?? "";

    const positional: string[] = [];

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case "--host":
                pathName = "HOST_PATH";
                break;
            case "--build":
                pathName = "PATH";
                break;
            case "--update":
                update = true;
                break;
            case "--":
                positional.push(...args.slice(i + 1));
                i = args.length;
                break;
            default:
                if (arg.startsWith("-")) {
                    console.error(`Unknown option ${arg} supplied to patchShebangs`);
                    return 1;
                } else {
                    positional.push(arg);
                }
                break;
        }
    }

    if (positional.length === 0) {
        console.error("No arguments supplied to patchShebangs");
        return 0;
    }

    console.log("patching script interpreter paths in", positional.join(" "));

    for await (const file of walkExecutables(positional)) {
        if (!(await isScript(file))) continue;

        const content = await Deno.readTextFile(file);
        const lines = content.split("\n");
        const oldInterpreterLine = lines[0];
        const restOfFile = lines.slice(1).join("\n");

        if (!oldInterpreterLine.startsWith("#!")) continue;

        const shebang = oldInterpreterLine.slice(2).trim();
        let [oldPath, arg0, ...args] = shebang.split(/\s+/);

        if (!pathName) {
            if (strictDeps && file.startsWith(NIX_STORE)) {
                pathName = "HOST_PATH";
            } else {
                pathName = "PATH";
            }
        }

        const PATH = pathName === "HOST_PATH" ? hostPATH : buildPATH;

        let newPath: string | null = null;
        let newArgs = [...args];

        if (oldPath.endsWith("/bin/env")) {
            if (arg0 === "-S") {
                arg0 = args[0];
                newArgs = args.slice(1);
                const found = await findExecutable(arg0, PATH);
                newPath = await findExecutable("env", PATH);
                if (!found) continue;
                newArgs = ["-S", found, ...newArgs];
            } else if (arg0.startsWith("-") || arg0.includes("=")) {
                console.error(`${file}: unsupported interpreter directive "${oldInterpreterLine}"`);
                Deno.exit(1);
            } else {
                newPath = await findExecutable(arg0, PATH);
            }
        } else {
            if (!oldPath) oldPath = "/bin/sh";
            newPath = await findExecutable(oldPath.split("/").pop()!, PATH);
            newArgs = [arg0, ...args];
        }

        const newInterpreterLine = `#!${[newPath, ...newArgs].filter(Boolean).join(" ")}`.trim();

        const shouldUpdate = update || !oldPath.startsWith(NIX_STORE);
        if (shouldUpdate && newPath && newPath !== oldPath) {
            console.log(`${file}: interpreter directive changed from "${oldInterpreterLine}" to "${newInterpreterLine}"`);

            // Save file timestamp
            const timestamp = (await $`stat --printf "%y" ${file}`.text()).trim();

            // Write to temp file
            const tmpFile = await Deno.makeTempFile({ prefix: "patchShebangs." });
            await Deno.writeTextFile(tmpFile, `${newInterpreterLine}\n${restOfFile}`);

            // Check permissions and overwrite
            const fileInfo = await Deno.stat(file);
            const wasWritable = (fileInfo.mode ?? 0) & 0o200;
            if (!wasWritable) await Deno.chmod(file, 0o644);

            const tmpData = await Deno.readFile(tmpFile);
            await Deno.writeFile(file, tmpData);
            await Deno.remove(tmpFile);

            if (!wasWritable) await Deno.chmod(file, 0o444);
            await $`touch --date "${timestamp}" ${file}`;
        }
    }
}

// Recursively finds executable files in given directories
async function* walkExecutables(paths: string[]): AsyncGenerator<string> {
    for (const path of paths) {
        for await (const entry of Deno.readDir(path)) {
            const fullPath = join(path, entry.name);
            if (entry.isFile) {
                if ((await isExecutable(fullPath))) {
                    yield fullPath;
                }
            } else if (entry.isDirectory) {
                yield* walkExecutables([fullPath]);
            }
        }
    }
}

// This function mimics the automatic hook behavior
export async function patchShebangsAuto() {
    if (!dontPatchShebangs && prefix && (await exists(prefix))) {
        if (output !== "out" && output === outputDev) {
            await patchShebangs(["--build", prefix]);
        } else {
            await patchShebangs(["--host", prefix]);
        }
    }
}

async function exists(path: string): Promise<boolean> {
    try {
        await Deno.stat(path);
        return true;
    } catch {
        return false;
    }
}