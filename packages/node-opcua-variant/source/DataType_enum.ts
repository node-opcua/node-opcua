/**
 * @module node-opcua-variant
 */
import { Enum } from "node-opcua-enum";
import { registerEnumeration } from "node-opcua-factory";
import { DataType } from "node-opcua-basic-types";
export { DataType } from "node-opcua-basic-types";
const schemaDataType = {
    name: "DataType",

    enumValues: DataType
};
export const _enumerationDataType: Enum = registerEnumeration(schemaDataType);
