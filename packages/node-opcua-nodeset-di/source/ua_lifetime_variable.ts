// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant, VariantOptions } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { NodeId } from "node-opcua-nodeid"
import { UAString } from "node-opcua-basic-types"
import { DTRange } from "node-opcua-nodeset-ua/source/dt_range"
import { UAAnalogUnit, UAAnalogUnit_Base } from "node-opcua-nodeset-ua/source/ua_analog_unit"
/**
 * Remaining lifetime
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |VariableType                                      |
 * |typedDefinition |1:LifetimeVariableType ns=1;i=468                 |
 * |dataType        |Variant                                           |
 * |dataType Name   |Variant ns=0;i=26                                 |
 * |isAbstract      |false                                             |
 */
export interface UALifetimeVariable_Base<T, DT extends DataType>  extends UAAnalogUnit_Base<T, DT> {
    /**
     * startValue
     * StartValue indicates the initial value, when
     * there is still the full lifetime left.
     */
    startValue: UAProperty<any, any>;
    /**
     * limitValue
     * LimitValue indicates when the end of lifetime has
     * been reached.
     */
    limitValue: UAProperty<any, any>;
    /**
     * indication
     * Indication gives an indication of what is
     * actually measured / represented by the Value of
     * the Variable and the StartValue and LimitValue.
     */
    indication?: UAProperty<NodeId, DataType.NodeId>;
    /**
     * warningValues
     * WarningValues indicates one or more levels when
     * the end of lifetime is reached soon and may be
     * used to inform the user when reached.
     */
    warningValues?: UAProperty<any, any>;
}
export interface UALifetimeVariable<T, DT extends DataType> extends UAAnalogUnit<T, DT>, UALifetimeVariable_Base<T, DT> {
}