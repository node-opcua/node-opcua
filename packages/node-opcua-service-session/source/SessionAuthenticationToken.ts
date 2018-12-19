/**
 * @module node-opcua-service-session
 */
import { registerBasicType } from "node-opcua-factory";

// OPC Unified Architecture, Part 4  $7.29 page 139
export const schemaSessionAuthenticationToken = {
    name: "SessionAuthenticationToken",
    subType: "NodeId"
};
registerBasicType(schemaSessionAuthenticationToken);
