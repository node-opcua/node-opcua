/**
 * @module node-opcua-basic-types
 */
import { assert } from "node-opcua-assert";

export enum AttributeIds {
    NodeId = 1,
    NodeClass = 2,
    BrowseName = 3,
    DisplayName = 4,
    Description = 5,
    WriteMask = 6,
    UserWriteMask = 7,
    IsAbstract = 8,
    Symmetric = 9,
    InverseName = 10,
    ContainsNoLoops = 11,
    EventNotifier = 12,
    Value = 13,
    DataType = 14,
    ValueRank = 15,
    ArrayDimensions = 16,
    AccessLevel = 17,
    UserAccessLevel = 18,
    MinimumSamplingInterval = 19,
    Historizing = 20,
    Executable = 21,
    UserExecutable = 22,
    // new in 1.04
    DataTypeDefinition = 23,
    RolePermissions = 24,
    UserRolePermissions = 25,
    AccessRestrictions = 26,
    AccessLevelEx = 27,
    INVALID = 999
}
const AttributeIds_LAST = AttributeIds.AccessLevelEx;

// see https://github.com/you-dont-need/You-Dont-Need-Lodash-Underscore/issues/296
function invert(a: { [key: string]: string | number }) {
    return Object.entries(a).reduce((c, [k, v]) => {
        c[v] = k;
        return c;
    }, {} as { [key: string]: string | number });
}
export const attributeNameById = invert(AttributeIds);

export function isValidAttributeId(attributeId: number): boolean {
    return attributeId >= 1 && attributeId <= AttributeIds_LAST;
}
