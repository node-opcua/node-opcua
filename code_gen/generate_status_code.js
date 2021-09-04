/**
 * utility to generate source file ./lib/raw_status_codes.js from  Opc.Ua.StatusCodes.csv
 *
 */
const util = require("util");
const xml = require("ersatz-node-expat");
const fs = require("fs");
const path = require("path");
const csv = require("csv");
const sprintf = require("sprintf-js").sprintf;


// see OPC-UA Part 6 , A2
const codeMap = {};
const code_list = [];


const dataFolder = path.join(__dirname, "1.04");


const parser = csv.parse({
    delimiter: ","
}).on("readable", function () {

    let record;
    while ((record = this.read())) {
        const codeName = record[0];
        console.log(record.length ,record);
        code_list.push({
            name: record[0],
            value: record[1] ? parseInt(record[1].substring(2), 16): 0,
            description: record.slice(2).join(",")
        });
        codeMap[codeName] = parseInt(record[1], 16);
    }
}).on("end", function () {
    console.log("codeMap", codeMap);
    parseStatusCodeXML2();

});

fs.createReadStream(path.join(dataFolder, "/StatusCode.csv")).pipe(parser);

function parseStatusCodeXML_not_used_anymore() {

    const xmlFile = __dirname + "/UA_StatusCodes.xml";

    const parser = new xml.Parser();

    const obj = {};
    const outFile = fs.createWriteStream(__dirname + "/../packages/node-opcua-constants/source/raw_status_codes.ts");
    outFile.write(`
/**
 * @module node-opcua-constants
 */
// this file has been automatically generated

export interface IStatusCodeDescription {
        name: string;
        value: number;
        description: string | undefined;
    }
`);

    outFile.write(" export const StatusCodes: any = { \n");

    outFile.write("  Good: { name:'Good', value: 0, description:'No Error' }\n");


    const sep = ",";

    code_list.forEach(function (obj) {
        const s = sprintf("%1s %40s: { name: %40s , value: %6s  ,description: \"%s\"}\n",
          sep, obj.name, "\"" + obj.name + "\"", "0x" + obj.value.toString(16), obj.description);
        outFile.write(s);
    });
    outFile.write("};\n");
}

function parseStatusCodeXML2() {

    const xmlFile = __dirname + "/UA_StatusCodes.xml";

    const parser = new xml.Parser();

    const obj = {};
    const outFile = fs.createWriteStream(__dirname + "/../packages/node-opcua-status-code/source/_generated_status_codes.ts");
    outFile.write(`
/**
 * @module node-opcua-status-codes
 */
// this file has been automatically generated
import { ConstantStatusCode, StatusCode } from \"./opcua_status_code\";\n`);

    outFile.write(" export class StatusCodes  { \n");

    // outFile.write(" /** Good: No Error */\n");
    // outFile.write(" static Good: ConstantStatusCode =  new ConstantStatusCode({ name:'Good', value: 0, description:'No Error' });\n");

    // outFile.write(`/** The value is bad but no specific reason is known. */`);
    // outFile.write(" static Bad: ConstantStatusCode =  new ConstantStatusCode({ name:'Bad', value: 0x80000000, description:'The value is bad but no specific reason is known.' });\n");
        
    // outFile.write(`/** The value is uncertain but no specific reason is known. */`);
    // outFile.write(" static Uncertain: ConstantStatusCode =  new ConstantStatusCode({ name:'Uncertain', value: 0x40000000, description:'The value is uncertain but no specific reason is known.' });\n");


    const sep = " ";

    code_list.forEach(function (obj) {
        const s = sprintf("%1s/** %s */\n%1s static %40s: ConstantStatusCode = new ConstantStatusCode({ name: %40s , value: %6s  ,description: \"%s\"});\n",
          sep, obj.description, 
          sep, obj.name, "\"" + obj.name + "\"", "0x" + obj.value.toString(16), obj.description);
        outFile.write(s);
    });
    outFile.write(" static GoodWithOverflowBit= StatusCode.makeStatusCode(StatusCodes.Good, `Overflow | InfoTypeDataValue`);\n");
    outFile.write("};\n");
}
