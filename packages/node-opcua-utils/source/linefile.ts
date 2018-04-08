import { writeFileSync } from "fs";

export class LineFile {
    __line: string[];

    constructor() {
        this.__line = [];
        this.write("// --------- This code has been automatically generated !!! " + new Date().toISOString());
    }

    write(...arg: string[]): void {
        let str = "";
        for (let i = 0; i < arguments.length; i++) {
            str += arguments[i];
        }
        this.__line.push(str);
    }

    toString(): string {
        return this.__line.join("\n");
    }

    save(filename: string): void {
        writeFileSync(filename, this.toString(), "ascii");
    }
}
