/**
 * @module node-opcua-types
 */
// tslint:disable:no-console
import * as fs from "fs";
import * as d from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { generate } from "node-opcua-generator";
import * as n from "node-opcua-numeric-range";
import { Variant } from "node-opcua-variant";
import * as path from "path";
import { promisify } from "util";

const force_inclusion = n.NumericRange;
const force_includsion_QualifiedName = d.QualifiedName;
const force_includsion_LocalizedText = d.LocalizedText;
const force_includsion_Variant = Variant;
const force_includsion_DataValue = DataValue;

async function main() {
    try {
        // await build_generated_folder();
        const filename = path.join(__dirname, "../xmlschemas/Opc.Ua.Types.bsd");
        const generatedTypescriptFilename = path.join(__dirname, "_generated_opcua_types.ts");
        await generate(filename, generatedTypescriptFilename);
    } catch (err) {
        console.log(err);
    }
}
main().then().catch();
