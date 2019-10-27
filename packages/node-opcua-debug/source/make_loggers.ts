/**
 * @module node-opcua-debug
 */
// tslint:disable:no-console
import * as chalk from "chalk";
import * as path from "path";
import * as _ from "underscore";
import { format } from "util";

const debugFlags: { [id: string]: boolean } = {};

const maxLines = (process.env && process.env.NODEOPCUA_DEBUG_MAXLINE_PER_MESSAGE) ?
    parseInt(process.env.NODEOPCUA_DEBUG_MAXLINE_PER_MESSAGE, 10) : 25;

function extractBasename(name: string) {
    return path.basename(name).replace(/\.(js|ts)$/, "");
}

function w(str: string, l: number): string {
    return (str + "                                                                ").substr(0, l);
}

export function setDebugFlag(scriptFullPath: string, flag: boolean) {
    const filename = extractBasename(scriptFullPath);
    if (process.env.DEBUG && process.env.DEBUG.length > 1) {
        const decoratedFilename = chalk.yellow(w(filename, 60));
        console.log(
            " Setting debug for ",
            decoratedFilename,
            " to ",
            (flag ? chalk.cyan : chalk.red)(flag.toString(), process.env.DEBUG)
        );
    }
    debugFlags[filename] = flag;
}

export function checkDebugFlag(scriptFullPath: string): boolean {
    const filename = extractBasename(scriptFullPath);
    let doDebug: boolean = debugFlags[filename];
    if (process && process.env && process.env.DEBUG && !debugFlags.hasOwnProperty(filename)) {
        doDebug = (process.env.DEBUG.indexOf(filename) >= 0 || process.env.DEBUG.indexOf("ALL") >= 0);
        setDebugFlag(filename, doDebug);
    }
    return doDebug;
}

/**
 * file_line return a 51 caracter string
 * @param filename
 * @param callerLine
 */
function file_line(mode: "E" | "D", filename: string, callerLine: number): string {
    const d = (new Date()).toISOString().substr(11);
    if (mode === "D") {
        return chalk.bgWhite.cyan(w(d, 14) + ":" + w(filename, 30) + ":" + w(callerLine.toString(), 5));
    } else {
        return chalk.bgRed.white(w(d, 14) + ":" + w(filename, 30) + ":" + w(callerLine.toString(), 5));
    }
}

const continuation = w(" ...                                                            ", 51);

function buildPrefix(mode: "E" | "D"): string {
    const stack: string = new Error("").stack || "";
    // caller line number
    const l: string[] = stack.split("\n")[4].split(":");
    const callerLine: number = parseInt(l[l.length - 2], 10);
    const filename: string = extractBasename(l[l.length - 3]);
    return file_line(mode, filename, callerLine);
}

function dump(mode: "E" | "D", args1: [any?, ...any[]]) {

    const a2 = _.values(args1) as [string, ...string[]];
    const output = format.apply(null, a2);
    let a1 = [buildPrefix(mode)];

    let i = 0;
    for (const line of output.split("\n")) {
        const lineArguments = ([] as string[]).concat(a1, [line]) as [string, ...string[]];
        console.log.apply(console, lineArguments);
        a1 = [continuation];
        i = i + 1;
        if (i > maxLines) {
            const a3 = a1.concat([" .... TRUNCATED ....."]);
            console.log.apply(console, a3 as [string, ...string[]]);
            break;
        }
    }

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

export function make_errorLog(context: string): (...arg: any[]) => void {

    function errorLogFunc(...args: [any?, ...any[]]) {
        dump("E", args);
    }

    return errorLogFunc;
}
