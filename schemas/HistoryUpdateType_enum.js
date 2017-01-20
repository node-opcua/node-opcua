import { registerEnumeration } from "lib/misc/factories";

// see part 4 $7.14
const HistoryUpdateType_Schema = {
    name: "HistoryUpdateType",
    enumValues: {
        INVALID: 0, // The MessageSecurityMode is invalid
        INSERT:  1, //Data was inserted
        REPLACE: 2, //Data was replaced
        UPDATE:  3, //Data was updated
        DELETE:  4  //Data was deleted
    }
};

export const HistoryUpdateType = registerEnumeration(HistoryUpdateType_Schema);
