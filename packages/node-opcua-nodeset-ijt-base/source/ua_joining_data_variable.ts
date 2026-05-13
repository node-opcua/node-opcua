import type { UAProperty } from "node-opcua-address-space-base";
import type { Byte } from "node-opcua-basic-types";
import type { EUInformation } from "node-opcua-data-access";
import type { UABaseDataVariable, UABaseDataVariable_Base } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UAMultiStateDiscrete } from "node-opcua-nodeset-ua/dist/ua_multi_state_discrete";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

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
export interface UAJoiningDataVariable<T, DT extends DataType> extends UABaseDataVariable<T, DT>, UAJoiningDataVariable_Base<T, DT> {}