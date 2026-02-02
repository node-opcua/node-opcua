// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/PADIM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IGasChromatographSignalConditionSetType i=1108              |
 * |isAbstract      |true                                                        |
 */
export interface UAIGasChromatographSignalConditionSet_Base extends UABaseInterface_Base {
    peakWidth?: UAAnalogUnit<number, DataType.Float>;
    peakHeight?: UAAnalogUnit<number, DataType.Float>;
    peakArea?: UAAnalogUnit<number, DataType.Float>;
    tailingFactor?: UAProperty<number, DataType.Float>;
    expectedRetentionTime?: UAAnalogUnit<number, DataType.Float>;
    actualRetentionTime?: UAAnalogUnit<number, DataType.Float>;
    injectionTime?: UAProperty<Date, DataType.DateTime>;
    componentName?: UAProperty<UAString, DataType.String>;
}
export interface UAIGasChromatographSignalConditionSet extends UABaseInterface, UAIGasChromatographSignalConditionSet_Base {
}