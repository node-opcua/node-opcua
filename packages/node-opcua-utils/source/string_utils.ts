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

// HelloWorld => helloWorld
// XAxis      => xAxis
// EURange    => euRange
export function lowerFirstLetter(str: string): string {
    if (str == null) {
        return str;
    }
    let result = str.substr(0, 1).toLowerCase() + str.substr(1);
    if (result.length > 3 && isUpperCaseChar(str[1]) && isUpperCaseChar(str[2])) {
        result = str.substr(0, 2).toLowerCase() + str.substr(2);
    }
    return result;
}
