/**
 * @module node-opcua-types
 */
// tslint:disable:no-console
import * as path from "path";
import * as d from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { generate } from "node-opcua-generator";
import * as n from "node-opcua-numeric-range";
import { Variant } from "node-opcua-variant";

const force_inclusion = n.NumericRange;
const force_inclusion_QualifiedName = d.QualifiedName;
const force_inclusion_LocalizedText = d.LocalizedText;
const force_inclusion_Variant = Variant;
const force_inclusion_DataValue = DataValue;

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
