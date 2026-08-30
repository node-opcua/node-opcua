/**
 * @module node-opcua-utils
 */
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm;
const ARGUMENT_NAMES = /([^\s,]+)/g;

export function getFunctionParameterNames(func: (...args: never[]) => unknown): string[] {
    const fnStr = func.toString().replace(STRIP_COMMENTS, "");
    const result = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")")).match(ARGUMENT_NAMES);
    if (!result) {
        return [];
    }
    return result;
}
