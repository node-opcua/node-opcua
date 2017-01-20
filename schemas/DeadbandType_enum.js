import { registerEnumeration } from "lib/misc/factories";

const DeadbandType_Schema = {
    name:"DeadbandType",
    enumValues: {
        None:       0x00,
        Absolute:   0x01,
        Percent:    0x02,
        Invalid:      -1,

    }
};
export {DeadbandType_Schema};
export const DeadbandType = registerEnumeration(DeadbandType_Schema);
