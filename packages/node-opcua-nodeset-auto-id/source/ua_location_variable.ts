// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { DTLocation } from "./dt_location"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/AutoID/               |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |3:LocationVariableType ns=3;i=2002                |
 * |dataType        |ExtensionObject                                   |
 * |dataType Name   |DTLocation ns=3;i=3008                            |
 * |isAbstract      |false                                             |
 */
export interface UALocationVariable_Base<T extends DTLocation/*j*/>  extends UABaseDataVariable_Base<T, /*e*/DataType.ExtensionObject> {
    geographicalUnit?: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    lengthUnit?: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    rotationalUnit?: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
    speedUnit?: UAProperty<EUInformation, /*z*/DataType.ExtensionObject>;
}
export interface UALocationVariable<T extends DTLocation/*j*/> extends UABaseDataVariable<T, /*n*/DataType.ExtensionObject>, UALocationVariable_Base<T /*B*/> {
}