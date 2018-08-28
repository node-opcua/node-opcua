import { writeFileSync } from "fs";
import * as os from "os";

export class LineFile {

    private _line: string[];

    constructor() {
        this._line = [];
        this.write("// --------- This code has been automatically generated !!! " + new Date().toISOString());
    }

    write(...arg: string[]): void {
        let str = "";
        for (let i = 0; i < arguments.length; i++) {
            str += arguments[i];
        }
        this._line.push(str);
    }

    toString(): string {
        return this._line.join(os.EOL);
    }

    save(filename: string): void {
        writeFileSync(filename, this.toString(), "ascii");
    }

    saveFormat(filename: string, formatter: (code: string) => string): void {
        const code = formatter(this.toString());
        writeFileSync(filename, code, "ascii");
    }
}
