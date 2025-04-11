// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { Byte } from "node-opcua-basic-types"
import { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_discrete"
/**
 * The JoiningDataVariableType is a subtype of the
 * BaseDataVariableType. It is to describe common
 * semantic required for variables in the system. In
 * this version of the specification, it provides
 * information about physical quantity and
 * Engineering Units.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |VariableType                                                |
 * |typedDefinition |JoiningDataVariableType i=2011                              |
 * |dataType        |Null                                                        |
 * |dataType Name   |VariantOptions i=0                                          |
 * |value rank      |-1                                                          |
 * |isAbstract      |false                                                       |
 */
export interface UAJoiningDataVariable_Base<T, DT extends DataType>  extends UABaseDataVariable_Base<T, DT> {
    /**
     * engineeringUnits
     * 0:EngineeringUnits defines the engineering unit
     * of the values.
     */
    engineeringUnits?: UAProperty<EUInformation, DataType.ExtensionObject>;
    /**
     * physicalQuantity
     * PhysicalQuantity is to determine the type of the
     * physical quantity associated to a given value(s).
     */
    physicalQuantity?: UAMultiStateDiscrete<Byte, DataType.Byte>;
}
export interface UAJoiningDataVariable<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAJoiningDataVariable_Base<T, DT> {
}