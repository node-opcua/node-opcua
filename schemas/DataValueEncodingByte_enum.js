import { registerEnumeration } from "lib/misc/factories";
const DataValueEncodingByte_Schema = {
    name:"DataValue_EncodingByte",
    enumValues: {
        Value:              0x01,
        StatusCode:         0x02,
        SourceTimestamp:    0x04,
        ServerTimestamp:    0x08,
        SourcePicoseconds:  0x10,
        ServerPicoseconds:  0x20
    }
};
export {DataValueEncodingByte_Schema};
export const DataValueEncodingByte = registerEnumeration(DataValueEncodingByte_Schema);
