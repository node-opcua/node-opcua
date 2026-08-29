import type { Symbols } from "./symbol.js";

export function toCSV(arr: Symbols) {
    const line: string[] = [];
    for (const [name, value, nodeClass] of arr) {
        line.push([name, value, nodeClass].join(","));
    }
    return line.join("\n");
}
