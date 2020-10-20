import * as fs from "fs";
import { Callback, SimpleCallback, Xml2Json } from "../xml2json";

export class Xml2JsonFs extends Xml2Json {
    /**
     * @method  parse
     * @async
     * @param xmlFile - the name of the xml file to parse.
     */
    public parse(xmlFile: string): Promise<any>;
    public parse(xmlFile: string, callback: Callback<any> | SimpleCallback): void;
    public parse(xmlFile: string, callback?: Callback<any> | SimpleCallback): any {
        if (!callback) {
            throw new Error("internal error");
        }
        const readWholeFile = true;
        if (readWholeFile) {
            // slightly faster but require more memory ..
            fs.readFile(xmlFile, (err: Error | null, data: Buffer) => {
                if (err) {
                    return callback(err);
                }
                if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
                    data = data.slice(3);
                }
                const dataAsString = data.toString();
                const parser = this._prepareParser(callback);
                parser.write(dataAsString);
                parser.end();
            });
        } else {
            const Bomstrip = require("bomstrip");

            const parser = this._prepareParser(callback);

            fs.createReadStream(xmlFile, { autoClose: true, encoding: "utf8" }).pipe(new Bomstrip()).pipe(parser);
        }
    }
}
// tslint:disable:no-var-requires
const thenify = require("thenify");
const opts = { multiArgs: false };
Xml2JsonFs.prototype.parse = thenify.withCallback(Xml2JsonFs.prototype.parse, opts);
