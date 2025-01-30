import fs from "fs";
import { Callback, SimpleCallback, Xml2Json } from "../xml2json";

export class Xml2JsonFs extends Xml2Json {
    /**
     * @param xmlFile - the name of the xml file to parse.
     */
    public async parse(xmlFile: string): Promise<any> {
        // slightly faster but require more memory ..
        let data = await fs.promises.readFile(xmlFile);
        if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
            data = data.subarray(3);
        }
        const dataAsString = data.toString();
        return this.__parseInternal(dataAsString);
    }
}
