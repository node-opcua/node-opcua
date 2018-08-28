import { generateTypeScriptCodeFromSchema } from "./generator";
import * as path from "path";

console.log(process.argv);

async function main() {
    const className = "LocalizedText";
    generateTypeScriptCodeFromSchema(className);
}

main()
    .then()
    .catch();

