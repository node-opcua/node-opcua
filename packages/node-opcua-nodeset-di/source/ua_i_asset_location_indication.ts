// ----- this file has been automatically generated - do not edit
import { UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt16 } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IAssetLocationIndicationType i=118                          |
 * |isAbstract      |true                                                        |
 */
export interface UAIAssetLocationIndication_Base extends UABaseInterface_Base {
    startLocationIndication: UAMethod;
    stopLocationIndication: UAMethod;
    isIndicating: UAProperty<boolean, DataType.Boolean>;
    usedIndicationType?: UAProperty<UInt16, DataType.UInt16>;
    supportedIndicationTypes?: UAProperty<UInt16, DataType.UInt16>;
}
export interface UAIAssetLocationIndication extends UABaseInterface, UAIAssetLocationIndication_Base {
}