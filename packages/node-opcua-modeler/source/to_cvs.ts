import { Symbols } from "./symbol";

export function toCSV(arr: Symbols) {
    const line: string[] = [];
    for (const [name, value, nodeClass] of arr) {
        line.push([name, value, nodeClass].join(","));
    }
    return line.join("\n");
}
