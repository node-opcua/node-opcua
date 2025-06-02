// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { DTRange } from "node-opcua-nodeset-ua/dist/dt_range"
export interface UAWeighingRangeElement_range<T, DT extends DataType> extends UABaseDataVariable<T, DT> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
}
/**
 * For each weighing range a scale supports the OPC
 * UA server provides an object of
 * WeighingRangeElementType that contains the
 * propertys of the weighing range like the
 * ScaleDivision.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |WeighingRangeElementType i=23                               |
 * |isAbstract      |false                                                       |
 */
export interface UAWeighingRangeElement_Base {
    /**
     * actualScaleInterval
     * Value expressed in units of mass of the
     * difference between two consecutive indicated
     * values, for digital indication ("d" as described
     * in Welmec /OIML).
     */
    actualScaleInterval: UAAnalogUnit<number, DataType.Double>;
    /**
     * range
     * Defines the range within the scale may be
     * operated depending on the additional parameters
     * within this type.
     */
    range: UAWeighingRangeElement_range<DTRange, DataType.ExtensionObject>;
    /**
     * verificationScaleInterval
     * Value, expressed in units of mass, used for the
     * classification and verification of an instrument.
     * ("e" as described in Welmec /OIML)
     */
    verificationScaleInterval: UAAnalogUnit<number, DataType.Double>;
}
export interface UAWeighingRangeElement extends UAObject, UAWeighingRangeElement_Base {
}