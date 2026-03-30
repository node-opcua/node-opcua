/**
 * @module node-opcua-variant
 */
import { DataType } from "node-opcua-basic-types";
import type { Enum } from "node-opcua-enum";
import { registerEnumeration } from "node-opcua-factory";

export { DataType } from "node-opcua-basic-types";

const schemaDataType = {
    name: "DataType",

    enumValues: DataType
};
export const _enumerationDataType: Enum = registerEnumeration(schemaDataType);
