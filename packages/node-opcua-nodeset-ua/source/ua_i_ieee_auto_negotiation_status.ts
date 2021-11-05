// ----- this file has been automatically generated - do not edit
import { DataType, Variant } from "node-opcua-variant"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIeeeAutoNegotiationStatusType ns=0;i=24233       |
 * |isAbstract      |true                                              |
 */
export interface UAIIeeeAutoNegotiationStatus_Base extends UABaseInterface_Base {
    negotiationStatus: UABaseDataVariable<any, any>;
}
export interface UAIIeeeAutoNegotiationStatus extends UABaseInterface, UAIIeeeAutoNegotiationStatus_Base {
}