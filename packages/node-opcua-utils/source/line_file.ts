/**
 * @module node-opcua-utils
 */

export class LineFile {
    private _line: string[];

    constructor() {
        this._line = [];
    }

    public write(...args: string[]): void {
        let str = "";
        // tslint:disable:prefer-for-of
        for (let i = 0; i < args.length; i++) {
            str += args[i];
        }
        this._line.push(str);
    }

    public toString(endOfLine: "\n" | "\r" = "\n"): string {
        return this._line.join(endOfLine);
    }
}
