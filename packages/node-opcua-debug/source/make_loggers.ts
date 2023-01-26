/**
 * @module node-opcua-debug
 */
// tslint:disable:no-console
import { EventEmitter } from "events";
import { format } from "util";
import * as chalk from "chalk";

const debugFlags: { [id: string]: boolean } = {};

const _process = (typeof process === "object") ? process : { env: {} as Record<string, string> };
const sTraceFlag = _process.env && (_process.env.DEBUG as string);

// istanbul ignore next
if (_process.env && false) {
    // this code can be activated to help detecting
    // when a external module overwrite one of the
    // environment variable that we may be using as well.
    const old = { ..._process.env };
    const handler = {
        get: function (obj: any, prop: string) {
            return old[prop];
        },
        set: function (obj: any, prop: string, value: any) {
            console.log("setting process.env = prop " + prop);
            old[prop] = value;
            return true;
        }
    };
    _process.env = new Proxy(old, handler);
}
const maxLines =
    _process.env && _process.env.NODEOPCUA_DEBUG_MAXLINE_PER_MESSAGE
        ? parseInt(_process.env.NODEOPCUA_DEBUG_MAXLINE_PER_MESSAGE, 10)
        : 25;

function extractBasename(name: string): string {
    if (!name) {
        return "";
    }
    // return basename(name).replace(/\.(js|ts)$/, "");
    return name.replace(/(.*[\\|/])?/g, "").replace(/\.(js|ts)$/, "");
}

function w(str: string, l: number): string {
    return str.padEnd(l," ").substring(0, l);
}

export function setDebugFlag(scriptFullPath: string, flag: boolean): void {
    const filename = extractBasename(scriptFullPath);
    if (sTraceFlag && sTraceFlag.length > 1 && flag) {
        const decoratedFilename = chalk.yellow(w(filename, 60));
        console.log(" Setting debug for ", decoratedFilename, " to ", (flag ? chalk.cyan : chalk.red)(flag.toString(), sTraceFlag));
    }
    debugFlags[filename] = flag;
}

export function checkDebugFlag(scriptFullPath: string): boolean {
    const filename = extractBasename(scriptFullPath);
    let doDebug: boolean = debugFlags[filename];
    if (sTraceFlag && !Object.prototype.hasOwnProperty.call(debugFlags, filename)) {
        doDebug = sTraceFlag.indexOf(filename) >= 0 || sTraceFlag.indexOf("ALL") >= 0;
        setDebugFlag(filename, doDebug);
    }
    return doDebug;
}

/**
 * file_line return a 51 character string
 * @param filename
 * @param callerLine
 */
function file_line(mode: "E" | "D" | "W", filename: string, callerLine: number): string {
    const d = new Date().toISOString().substring(11);
    if (mode === "W") {
        return chalk.bgCyan.white(w(d, 14) + ":" + w(filename, 30) + ":" + w(callerLine.toString(), 5));
    } else if (mode === "D") {
        return chalk.bgWhite.cyan(w(d, 14) + ":" + w(filename, 30) + ":" + w(callerLine.toString(), 5));
    } else {
        return chalk.bgRed.white(w(d, 14) + ":" + w(filename, 30) + ":" + w(callerLine.toString(), 5));
    }
}

const continuation = w(" ...                                                            ", 51);

function buildPrefix(mode: "E" | "D" | "W"): string {
    const stack: string = new Error("").stack || "";
    // caller line number
    const l: string[] = stack.split("\n")[4].split(":");
    const callerLine: number = parseInt(l[l.length - 2], 10);
    const filename: string = extractBasename(l[l.length - 3]);
    return file_line(mode, filename, callerLine);
}

function dump(mode: "E" | "D" | "W", args1: [any?, ...any[]]) {
    const a2 = Object.values(args1) as [string, ...string[]];
    const output = format(...a2);
    let a1 = [buildPrefix(mode)];

    let i = 0;
    for (const line of output.split("\n")) {
        const lineArguments = ([] as string[]).concat(a1, [line]) as [string, ...string[]];
        console.log(...lineArguments);
        a1 = [continuation];
        i = i + 1;
        if (i > maxLines) {
            const a3 = a1.concat([` .... TRUNCATED ..... (NODEOPCUA_DEBUG_MAXLINE_PER_MESSAGE=${maxLines}`]);
            console.log(...(a3 as [string, ...string[]]));
            break;
        }
    }
    return output;
}

/**
 * @method make_debugLog
 * @param scriptFullPath:string
 * @return returns a  debugLog function that will write message to the console
 * if the DEBUG environment variable indicates that the provided source file shall display debug trace
 *
 */
export function make_debugLog(scriptFullPath: string): (...arg: any[]) => void {
    const filename = extractBasename(scriptFullPath);

    function debugLogFunc(...args: [any?, ...any[]]) {
        if (debugFlags[filename]) {
            dump("D", args);
        }
    }

    return debugLogFunc;
}

export class MessageLogger extends EventEmitter {
    constructor() {
        super();
    }
    public on(eventName: "warningMessage" | "errorMessage", eventHandler: () => void): this {
        return super.on(eventName, eventHandler);
    }
}
export const messageLogger = new MessageLogger();

export function make_errorLog(context: string): (...arg: any[]) => void {
    function errorLogFunc(...args: [any?, ...any[]]) {
        const output = dump("E", args);
        messageLogger.emit("errorMessage", output);
    }
    return errorLogFunc;
}

export function make_warningLog(context: string): (...arg: any[]) => void {
    function errorLogFunc(...args: [any?, ...any[]]) {
        const output = dump("W", args);
        messageLogger.emit("warningMessage", output);
    }

    return errorLogFunc;
}
