// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Byte } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
/**
 * It is to describe common sematic required for
 * variables in a given system.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |14:JoiningDataVariableType ns=14;i=2011           |
 * |dataType        |Null                                              |
 * |dataType Name   |undefined ns=0;i=0                                |
 * |isAbstract      |false                                             |
 */
export interface UAJoiningDataVariable_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    /**
     * engineeringUnits
     * The optional 0:EngineeringUnits defines the
     * engineering unit of the values.
     */
    engineeringUnits?: UAProperty<EUInformation, DataType.ExtensionObject>;
    /**
     * physicalQuantity
     * The optional PhysicalQuantity is to determine the
     * type of the physical quantity associated to a
     * given value(s).
     */
    physicalQuantity?: UAProperty<Byte, DataType.Byte>;
}
export interface UAJoiningDataVariable<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAJoiningDataVariable_Base<T, DT> {
}