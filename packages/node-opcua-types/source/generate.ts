/**
 * @module node-opcua-types
 */
// tslint:disable:no-console
import path from "path";
import { QualifiedName, LocalizedText } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { generate } from "node-opcua-generator";
import { NumericRange } from "node-opcua-numeric-range";
import { Variant } from "node-opcua-variant";

const force_inclusion = NumericRange;
const force_inclusion_QualifiedName = QualifiedName;
const force_inclusion_LocalizedText = LocalizedText;
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
