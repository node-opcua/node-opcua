import { registerEnumeration } from "./enumerations";



export enum NodeIdType {
    ReferenceType = 0x01,
    IsForward = 0x02,
    NodeClass = 0x04,
    BrowseName = 0x08,
    DisplayName = 0x10,
    TypeDefinition = 0x20
}
export const schemaNodeIdType = {
    name: "NodeIdType",
    enumValues: NodeIdType
};
export const _enumerationNodeIdType = registerEnumeration(schemaNodeIdType);