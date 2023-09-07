/**
 * @module node-opcua-debug
 */
// tslint:disable:no-console
import { EventEmitter } from "events";
import { format } from "util";
import chalk from "chalk";

const debugFlags: { [id: string]: boolean } = {};

const _process = typeof process === "object" ? process : { env: {} as Record<string, string> };
const sTraceFlag = _process.env && (_process.env.DEBUG as string);

export enum LogLevel {
    Emergency = 0,
    Alert = 1,
    Critic = 2,
    Error = 3,
    Warning = 4,
    Notice = 5,
    Info = 6,
    Debug = 7
}

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
let g_logLevel: LogLevel = process.env.NODEOPCUA_LOG_LEVEL
    ? (parseInt(process.env.NODEOPCUA_LOG_LEVEL) as LogLevel)
    : LogLevel.Warning;

export function setLogLevel(level: LogLevel): void {
    g_logLevel = level;
}

function extractBasename(name: string): string {
    if (!name) {
        return "";
    }
    // return basename(name).replace(/\.(js|ts)$/, "");
    return name.replace(/(.*[\\|/])?/g, "").replace(/\.(js|ts)$/, "");
}

function w(str: string, l: number): string {
    return str.padEnd(l, " ").substring(0, l);
}

interface Context {
    filename: string;
    callerline: number;
}

const contextCounter: Record<string,number> = {
}
const increaseCounter = (ctxt: Context)  =>  {
    const { filename, callerline } = ctxt;
    const key = `${filename}:${callerline}};`
    const bucket = contextCounter[key];
    if (!bucket) {
        contextCounter[key] = 1;
        return 1;
    }
    contextCounter[key] = contextCounter[key] +1;
    return contextCounter[key];
}


const threshold = 100;

type PrintFunc = (data?: any, ...argN: any[]) => void;
const loggers = {
    errorLogger: (ctxt: Context, ...args: [any, ...any[]]) => {

        const occurenceCount = increaseCounter(ctxt);
        if (occurenceCount > threshold) {
            return;
        }
        const output = dump(ctxt, "E", args);
        messageLogger.emit("errorMessage", output);
        if (occurenceCount === threshold) {
            dump(ctxt, "E", [`This error occured more than ${threshold} times, no more error will be logged for this context`]);
            return;
        }
    },
    warningLogger: (ctxt: Context, ...args: [any, ...any[]]) => {
        const occurenceCount = increaseCounter(ctxt);
        if (occurenceCount > threshold) {
            return;
        }
        const output = dump(ctxt, "W", args);
        messageLogger.emit("warningMessage", output);
        if (occurenceCount === threshold) {
            dump(ctxt, "W", [`This warning occured more than ${threshold} times, no more warning will be logged for this context`]);
            return;
        }
    },
    debugLogger: (ctxt: Context, ...args: [any, ...any[]]) => {
        const output = dump(ctxt, "D", args);
    }
};

export function setDebugLogger(log: PrintFunc): void {
    loggers.debugLogger = log;
}
export function setWarningLogger(log: PrintFunc): void {
    loggers.warningLogger = log;
}
export function setErrorLogger(log: PrintFunc): void {
    loggers.errorLogger = log;
}

export function setDebugFlag(scriptFullPath: string, flag: boolean): void {
    const filename = extractBasename(scriptFullPath);
    if (sTraceFlag && sTraceFlag.length > 1 && flag) {
        const decoratedFilename = chalk.yellow(w(filename, 60));
        loggers.debugLogger(
            {
                filename: __filename,
                callerline: -1
            },
            " Setting debug for ",
            decoratedFilename,
            " to ",
            (flag ? chalk.cyan : chalk.red)(flag.toString(), sTraceFlag)
        );
        g_logLevel = LogLevel.Debug;
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

function getCallerContext(level: number) {
    const stack: string = new Error("").stack || "";
    // caller line number
    const l: string[] = stack.split("\n")[level].split(":");
    const callerline: number = parseInt(l[l.length - 2], 10);
    const filename: string = extractBasename(l[l.length - 3]);
    return { filename, callerline };
}

function dump(ctx: Context, mode: "E" | "D" | "W", args1: [any?, ...any[]]) {
    const a2 = Object.values(args1) as [string, ...string[]];
    const output = format(...a2);
    const { filename, callerline } = ctx;
    let a1 = [file_line(mode, filename, callerline)];
    let i = 0;
    for (const line of output.split("\n")) {
        const lineArguments = ([] as string[]).concat(a1, [line]);
        // eslint-disable-next-line prefer-spread
        console.log(...lineArguments);
        a1 = [continuation];
        i = i + 1;
        if (i > maxLines) {
            const a3 = a1.concat([` .... TRUNCATED ..... (NODEOPCUA_DEBUG_MAXLINE_PER_MESSAGE=${maxLines}`]);
            // eslint-disable-next-line prefer-spread
            console.log(...a3);
            break;
        }
    }
    return output;
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
        if (debugFlags[filename] && g_logLevel >= LogLevel.Debug) {
            const ctxt = getCallerContext(3);
            loggers.debugLogger(ctxt, ...args);
        }
    }
    return debugLogFunc;
}

function errorLogFunc(...args: [any?, ...any[]]) {
    if (g_logLevel >= LogLevel.Error) {
        const ctxt = getCallerContext(3);
        loggers.errorLogger(ctxt, ...args);
    }
}

export function make_errorLog(context: string): PrintFunc {
    return errorLogFunc;
}

function warningLogFunc(...args: [any?, ...any[]]) {
    if (g_logLevel >= LogLevel.Warning) {
        const ctxt = getCallerContext(3);
        loggers.warningLogger(ctxt, ...args);
    }
}
export function make_warningLog(context: string): PrintFunc {
    return warningLogFunc;
}
