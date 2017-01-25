import { registerEnumeration } from "lib/misc/factories";
const DataChangeTrigger_Schema = {
    name:"DataChangeTrigger",
    enumValues: {
        Status:                  0x00,
        StatusValue:             0x01,
        StatusValueTimestamp:    0x02,
        Invalid             :    -1,

    }
};
export {DataChangeTrigger_Schema};
export const DataChangeTrigger = registerEnumeration(DataChangeTrigger_Schema);
