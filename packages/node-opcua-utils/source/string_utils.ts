/**
 * @module node-opcua-utils
 */
// tslint:disable:variable-name
export function capitalizeFirstLetter(str: string): string {
    if (str == null) {
        return str;
    }
    return str.substr(0, 1).toUpperCase() + str.substr(1);
}

const ACode = "A".charCodeAt(0);
const ZCode = "Z".charCodeAt(0);
function isUpperCaseChar(c: string): boolean {
    const code = c.charCodeAt(0);
    return code >= ACode && code <= ZCode;
}
const aCode = "a".charCodeAt(0);
const zCode = "z".charCodeAt(0);
function isAlpha(c: string): boolean {
    const code = c.charCodeAt(0);
    return (code >= ACode && code <= ZCode) || (code >= aCode && code <= zCode);

}
function countUpperCase(str: string): number {
    return str.split("").reduce((p, c) => p + (isUpperCaseChar(c) ? 1 : 0), 0);
}
function countAlpha(str: string): number {
    return str.split("").reduce((p, c) => p + (isAlpha(c) ? 1 : 0), 0);
}
// HelloWorld => helloWorld
// XAxis      => xAxis
// EURange    => euRange
// DATE       => DATE
// XYZ        => XYZ
// AB         => AB
// Ab         => ab
// A          => a
// T1ABC8     => T1ABC8
// F_ABC_D    => F_ABC_D
export function lowerFirstLetter(str: string): string {
    if (str == null) {
        return str;
    }
    // at least, 2 all upper
    if (str.length >= 2 && countUpperCase(str) === countAlpha(str)) {
        return str;
    }
    let result = str.substr(0, 1).toLowerCase() + str.substr(1);
    if (result.length > 3 && isUpperCaseChar(str[1]) && isUpperCaseChar(str[2])) {
        result = str.substr(0, 2).toLowerCase() + str.substr(2);
    }
    return result;
}
