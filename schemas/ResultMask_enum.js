const BrowseDescriptionResultMask = {

};
import { registerEnumeration } from "lib/misc/factories";

const ResultMask_Schema = {
    name: "ResultMask",
    enumValues: {
        ReferenceType: 0x01,
        IsForward:     0x02,
        NodeClass:     0x04,
        BrowseName:    0x08,
        DisplayName:   0x10,
        TypeDefinition:0x20
    }
};
export {ResultMask_Schema};
export const ResultMask = registerEnumeration(ResultMask_Schema);


