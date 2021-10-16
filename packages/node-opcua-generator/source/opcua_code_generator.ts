/* istanbul ignore file */
/**
 * @module node-opcua-generator
 */
// tslint:disable:no-console
import { generateTypeScriptCodeFromSchema } from "./generator";

console.log(process.argv);

async function main() {
    const className = "LocalizedText";
    generateTypeScriptCodeFromSchema(className);
}

main().then().catch();
