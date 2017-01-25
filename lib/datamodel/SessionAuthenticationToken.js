import { registerBasicType } from "lib/misc/factories";


// OPC Unified Architecture, Part 4  $7.29 page 139
const SessionAuthenticationToken_Schema = {
  name: "SessionAuthenticationToken",
  subtype: "NodeId"
};
registerBasicType(SessionAuthenticationToken_Schema);

