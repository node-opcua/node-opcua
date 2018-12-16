/**
 * @module node-opcua-generator
 */
export { generateTypeScriptCodeFromSchema, registerObject, unregisterObject } from "./generator";
export { parseBinaryXSD } from "./process_schema_file";
export { generate } from "./generate_extension_object_code";