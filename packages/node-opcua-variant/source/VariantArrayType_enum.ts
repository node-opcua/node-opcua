/**
 * @module node-opcua-variant
 */
import { Enum } from "node-opcua-enum";
import { registerEnumeration } from "node-opcua-factory";

export enum VariantArrayType {
    Scalar = 0x00,
    Array = 0x01,
    Matrix = 0x02
}

const schemaVariantArrayType = {
    enumValues: VariantArrayType,
    name: "VariantArrayType"
};

/***
 * @private
 */
export const _enumerationVariantArrayType: Enum = registerEnumeration(schemaVariantArrayType);
