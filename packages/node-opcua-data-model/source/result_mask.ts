// Specifies the fields in the ReferenceDescription structure that should be
// returned. The fields are assigned the following bits:
import { registerEnumeration } from "node-opcua-factory";
import { Enum } from "node-opcua-enum";

export enum ResultMask {
    ReferenceType=  0x01,
    IsForward=      0x02,
    NodeClass=      0x04,
    BrowseName=     0x08,
    DisplayName=    0x10,
    TypeDefinition= 0x20
}
export const schemaResultMask = {
    name: "ResultMask",
    enumValues: ResultMask
};
export const _enumerationResultMask: Enum = registerEnumeration(schemaResultMask);

// The ReferenceDescription type is defined in 7.24.
// @example
//      makeNodeClassMask("Method | Object").should.eql(5);
export function makeResultMask(str: string): ResultMask {
    const flags = str.split(" | ");
    let r = 0;
    for (const flag of flags) {
        r |= (ResultMask as any)[flag];
    }
    return r as ResultMask;
}

