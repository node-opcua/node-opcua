'use strict';

const escapeXMLTable = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
};

function escapeXMLReplace(match: string) {
    return escapeXMLTable[match as keyof typeof escapeXMLTable];
}

const unescapeXMLTable = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
};

function unescapeXMLReplace(_match: string) {
    const match = _match as keyof typeof unescapeXMLTable;
    if (match[1] === "#") {
        const num =
            match[2] === "x"
                ? parseInt(match.slice(3), 16)
                : parseInt(match.slice(2), 10);
        // https://www.w3.org/TR/xml/#NT-Char defines legal XML characters:
        // #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
        if (
            num === 0x9 ||
            num === 0xa ||
            num === 0xd ||
            (num >= 0x20 && num <= 0xd7ff) ||
            (num >= 0xe000 && num <= 0xfffd) ||
            (num >= 0x10000 && num <= 0x10ffff)
        ) {
            return String.fromCodePoint(num);
        }
        throw new Error("Illegal XML character 0x" + num.toString(16));
    }
    if (unescapeXMLTable[match]) {
        return unescapeXMLTable[match] || match;
    }
    throw new Error("Illegal XML entity " + match);
}

export function escapeXML(s: string) {
    return s.replace(/["&'<>]/g, escapeXMLReplace as (a: string)=>string);
}

export function unescapeXML(s: string) {
    let result = "";
    let start = -1;
    let end = -1;
    let previous = 0;
    while (
        (start = s.indexOf("&", previous)) !== -1 &&
        (end = s.indexOf(";", start + 1)) !== -1
    ) {
        result =
            result +
            s.slice(previous, start) +
            unescapeXMLReplace(s.slice(start, end + 1));
        previous = end + 1;
    }

    // shortcut if loop never entered:
    // return the original string without creating new objects
    if (previous === 0) return s;

    // push the remaining characters
    result = result + s.substring(previous);

    return result;
}

export function escapeXMLText(s: string) {
    return s.replace(/[&<>]/g, escapeXMLReplace);
}

export function unescapeXMLText(s: string) {
    return s.replace(/&(amp|#38|lt|#60|gt|#62);/g, unescapeXMLReplace);
}

