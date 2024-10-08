/**
 * @module node-opcua-data-value
 */
import { Enum } from "node-opcua-enum";
import { registerEnumeration } from "node-opcua-factory";

/**
 * @private
 */
export enum DataValueEncodingByte {
    Value = 0x01,
    StatusCode = 0x02,
    SourceTimestamp = 0x04,
    ServerTimestamp = 0x08,
    SourcePicoseconds = 0x10,
    ServerPicoseconds = 0x20
}
/**
 * @private
 */
export const schemaDataValueEncodingByte = {
    name: "DataValue_EncodingByte",

    enumValues: DataValueEncodingByte
};
/**
 * @private
 */
export const _enumerationDataValueEncodingByte: Enum = registerEnumeration(schemaDataValueEncodingByte);
