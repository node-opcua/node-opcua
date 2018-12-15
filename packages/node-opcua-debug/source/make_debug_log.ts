// tslint:disable:no-console
import chalk from "chalk";
import * as path from "path";
import * as _ from "underscore";
import { format } from "util";

const debugFlags: { [id: string]: boolean } = {};

const maxLines = (process.env && process.env.NODEOPCUA_DEBUG_MAXLINE_PER_MESSAGE) ?
  parseInt(process.env.NODEOPCUA_DEBUG_MAXLINE_PER_MESSAGE , 10) : 25;

function w(str: string, l: number): string {
    return (str + "                                    ").substr(0, l);
}

export function setDebugFlag(scriptFullPath: string, flag: boolean) {
    const filename: string = path.basename(scriptFullPath, ".js");
    if (process.env.DEBUG) {
        const decoratedFilename = chalk.yellow(w(filename, 30));
        console.log(
          " Setting debug for ",
          decoratedFilename,
          " to ",
          (flag ? chalk.cyan : chalk.red)(flag.toString())
        );
    }
    debugFlags[filename] = flag;
}

export function checkDebugFlag(scriptFullPath: string): boolean {
    const filename = path.basename(scriptFullPath, ".js");
    let doDebug: boolean = debugFlags[filename];
    if (process && process.env && process.env.DEBUG && !debugFlags.hasOwnProperty(filename)) {
        doDebug = (process.env.DEBUG.indexOf(filename) >= 0 || process.env.DEBUG.indexOf("ALL") >= 0);
        setDebugFlag(filename, doDebug);
    }
    return doDebug;
}

function file_line(filename: string, callerLine: number): string {
    const d = (new Date()).toISOString().substr(11);
    return chalk.bgWhite.cyan(w(d, 14) + ":" + w(filename, 30) + ":" + w(callerLine.toString(), 5));
}

/**
 * @method make_debugLog
 * @param scripFullPath:string
 * @return returns a  debugLog function that will write message to the console
 * if the DEBUG environment variable indicates that the provided source file shall display debug trace
 *
 */
export function make_debugLog(scripFullPath: string): (...arg: any[]) => void {

    //  const doDebug: boolean = checkDebugFlag(scripFullPath);

    const filename: string = path.basename(scripFullPath, ".js");

    function debugLogFunc() {
        if (debugFlags[filename]) {
            const stack: string = new Error("").stack || "";
            // caller line number
            const l: string[] = stack.split("\n")[2].split(":");
            const callerLine: number = parseInt(l[l.length - 2], 10);
            let a1: string[] = [file_line(filename, callerLine)];

            const a2 = _.values(arguments) as [string, ...string[]];

            const output = format.apply(null, a2);

            let i = 0;
            for (const line of output.split("\n")) {
                const args = ([] as string[]).concat(a1, [line]) as [string, ...string[]];
                console.log.apply(console, args );
                a1 = [w(" ...                                                            ", 51)];
                i = i + 1;
                if (i > maxLines) {
                    const a3 = a1.concat([" .... TRUNCATED ....."]);
                    console.log.apply(console, a3 as [string, ...string[]]);
                    break;
                }
            }
        }
    }

    return debugLogFunc;
}
