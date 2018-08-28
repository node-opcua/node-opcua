import chalk from "chalk";
const path = require("path");
const _ = require("underscore");
import { format } from "util";

const debugFlags: { [id: string]: boolean } = {};

function w(str: string, l: number): string {
    return (str + "                                    ").substr(0, l);
}

export function setDebugFlag(scriptFullpath: string, flag: boolean) {
    const filename: string = path.basename(scriptFullpath, ".js");
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

export function checkDebugFlag(scriptFullpath: string): boolean {
    const filename = path.basename(scriptFullpath, ".js");
    let doDebug: boolean = debugFlags[filename];
    if (process && process.env && process.env.DEBUG && !debugFlags.hasOwnProperty(filename)) {
        doDebug = (process.env.DEBUG.indexOf(filename) >= 0 || process.env.DEBUG.indexOf("ALL") >= 0);
        setDebugFlag(filename, doDebug);
    }
    return doDebug;
}

function file_line(filename: string, callerLine: number): string {
    const d = (new Date()).toISOString().substr(11);
    return chalk.bgWhite.cyan(w(d,14)+":" + w(filename, 30) + ":" + w(callerLine.toString(), 5));
}

/**
 * @method make_debugLog
 * @param scripFullpath:string
 * @return returns a  debugLog function that will write message to the console
 * if the DEBUG environment variable indicates that the provided source file shall display debug trace
 *
 */
export function make_debugLog(scripFullpath: string): (...arg: any[]) => void {

    const doDebug: boolean = checkDebugFlag(scripFullpath);

    const filename: string = path.basename(scripFullpath, ".js");

    function debugLogFunc() {
        if (debugFlags[filename]) {
            const stack: string = new Error("").stack || "";
            // caller line number
            const l: string[] = stack.split("\n")[2].split(":");
            const callerLine: number = parseInt(l[l.length - 2]);
            let a1: string[] = [file_line(filename, callerLine)];

            const a2: string[] = _.values(arguments);

            const output = format.apply(null,a2);

            let i =0;
            for(const line of output.split("\n")) {
                const args: string[] = ([] as string[]).concat(a1,[line]);
                console.log.apply(console, args);
                a1= [w(' ...                                                            ', 51)];
                i = i+1;
                if (i>20) {
                    console.log.apply(console, a1.concat([" .... TRUNCATED ....."]));
                    break;
                }
            }

        }
    }
    return debugLogFunc;
}

