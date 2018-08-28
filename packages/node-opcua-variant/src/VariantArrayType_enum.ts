/**
* @module node-opcua-variant
 */
import { registerEnumeration } from "node-opcua-factory";
import { Enum } from "node-opcua-enum";

export enum VariantArrayType {
    Scalar= 0x00,
    Array=  0x01,
    Matrix=  0x02
}

const schemaVariantArrayType = {
    name: "VariantArrayType",
    enumValues: VariantArrayType
};

/***
 * @private
 */
export const _enumerationVariantArrayType: Enum = registerEnumeration(schemaVariantArrayType);
