/**
 * @module node-opcua-utils
 */
import { writeFileSync } from "fs";
import { LineFile } from "node-opcua-utils";

export class LineFile1 extends LineFile {
    constructor() {
        super();
        this.write("// --------- This code has been automatically generated !!! " + new Date().toISOString());
        this.write("/**");
        this.write(" * @module node-opcua-types");
        this.write(" */");
    }
    public save(filename: string): void {
        writeFileSync(filename, this.toString(), "utf-8");
    }

    public saveFormat(filename: string, formatter: (code: string) => string): void {
        const code = formatter(this.toString());
        writeFileSync(filename, code, "utf-8");
    }
}
