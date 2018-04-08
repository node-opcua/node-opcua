import chalk from "chalk";
const path = require("path");
const _ = require("underscore");

let debugFlags: { [id: string]: boolean } = {};

function w(str: string, l: number): string {
    return (str + "                                    ").substr(0, l);
}

export function setDebugFlag(scriptFullpath: string, flag: boolean) {
    const filename: string = path.basename(scriptFullpath, ".js");
    if (process.env.DEBUG) {
        const decorated_filename = chalk.yellow(w(filename, 30));
        console.log(
            " Setting debug for ",
            decorated_filename,
            " to ",
            (flag ? chalk.cyan : chalk.red)(flag.toString())
        );
    }
    debugFlags[filename] = flag;
}

export function checkDebugFlag(script_fullpath: string): boolean {
    const filename = path.basename(script_fullpath, ".js");
    let doDebug:boolean = debugFlags[filename];
    if (process && process.env && process.env.DEBUG && !debugFlags.hasOwnProperty(filename)) {
        doDebug = (process.env.DEBUG.indexOf(filename) >= 0 || process.env.DEBUG.indexOf("ALL") >= 0 );
        setDebugFlag(filename, doDebug);
    }
    return doDebug;
}

function file_line(filename: string, caller_line: number):string {
    return chalk.bgWhite.cyan(w(filename, 30) + ":" + w(caller_line.toString(), 5));
}
/**
 * @method make_debugLog
 * @param scripFullpath:string
 * @return returns a  debugLog function that will write message to the console
 * if the DEBUG environment variable indicates that the provided source file shall display debug trace
 *
 */
export function make_debugLog(scripFullpath: string): Function {

    const doDebug: boolean = checkDebugFlag(scripFullpath);

    const filename: string = path.basename(scripFullpath, ".js");

    function debugLogFunc() {
        if (debugFlags[filename]) {
            const stack: string = new Error().stack || "";
            // caller line number
            const l: Array<string> = stack.split("\n")[2].split(":");
            const caller_line: number = parseInt(l[l.length - 2]);
            const a1:string[] = [file_line(filename, caller_line)];
            const a2:string[] = _.values(arguments);
            const args :string[] =  ([] as string[]).concat(a1, a2);
            console.log.apply(console, args);
        }
    }

    return debugLogFunc;
}

