import type { DataType } from "node-opcua-variant";

import type { EnumNegotiationStatus } from "./enum_negotiation_status";
import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIeeeAutoNegotiationStatusType i=24233                      |
 * |isAbstract      |true                                                        |
 */
export interface UAIIeeeAutoNegotiationStatus_Base extends UABaseInterface_Base {
    negotiationStatus: UABaseDataVariable<EnumNegotiationStatus, DataType.Int32>;
}
export interface UAIIeeeAutoNegotiationStatus extends UABaseInterface, UAIIeeeAutoNegotiationStatus_Base {}