/**
 * @module node-opcua-types
 */
import path from "node:path";
import { LocalizedText, QualifiedName } from "node-opcua-data-model";
import { DataValue } from "node-opcua-data-value";
import { generate } from "node-opcua-generator";
import { NumericRange } from "node-opcua-numeric-range";
import { Variant } from "node-opcua-variant";

const _force_inclusion = NumericRange;
const _force_inclusion_QualifiedName = QualifiedName;
const _force_inclusion_LocalizedText = LocalizedText;
const _force_inclusion_Variant = Variant;
const _force_inclusion_DataValue = DataValue;

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
