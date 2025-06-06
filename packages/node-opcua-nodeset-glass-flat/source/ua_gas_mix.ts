// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UAString } from "node-opcua-basic-types"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { UABaseMaterial, UABaseMaterial_Base } from "./ua_base_material"
export interface UAGasMix_gas_1 extends Omit<UABaseMaterial, "identifier"|"location"|"materialIdentifier"> { // Object
      identifier: UAProperty<UAString, DataType.String>;
      location: UAProperty<UAString, DataType.String>;
      materialIdentifier: UAProperty<UAString, DataType.String>;
}
export interface UAGasMix_gas_2 extends Omit<UABaseMaterial, "identifier"|"location"|"materialIdentifier"> { // Object
      identifier: UAProperty<UAString, DataType.String>;
      location: UAProperty<UAString, DataType.String>;
      materialIdentifier: UAProperty<UAString, DataType.String>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Glass/Flat/                     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |GasMixType i=1010                                           |
 * |isAbstract      |false                                                       |
 */
export interface UAGasMix_Base extends UABaseMaterial_Base {
    gas_1?: UAGasMix_gas_1;
    gas_2?: UAGasMix_gas_2;
    gasFilling?: UAAnalogUnit<any, any>;
    mixingRatio?: UAAnalogUnit<any, any>;
}
export interface UAGasMix extends UABaseMaterial, UAGasMix_Base {
}