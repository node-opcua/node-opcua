/**
 * @module node-opcua-utils
 */
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
const ARGUMENT_NAMES = /([^\s,]+)/g;
import { FunctionVariadic } from "./function_variadic";

export function getFunctionParameterNames(func: FunctionVariadic): string[] {
    const fnStr = func.toString().replace(STRIP_COMMENTS, "");
    let result = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")")).match(ARGUMENT_NAMES);
    if (result === null) {
        result = [];
    }
    return result;
}
