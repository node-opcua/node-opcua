// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { EUInformation } from "node-opcua-data-access"
import { UAAnalogUnit } from "node-opcua-nodeset-ua/dist/ua_analog_unit"
import { EnumEqualityAndRelationalOperator } from "./enum_equality_and_relational_operator"
import { UASimpleScale, UASimpleScale_Base } from "./ua_simple_scale"
export interface UAHopperScale_levelMax<T, DT extends DataType> extends Omit<UAAnalogUnit<T, DT>, "engineeringUnits"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      levelMode?: UAProperty<EnumEqualityAndRelationalOperator, DataType.Int32>;
}
export interface UAHopperScale_levelMin<T, DT extends DataType> extends Omit<UAAnalogUnit<T, DT>, "engineeringUnits"> { // Variable
      engineeringUnits: UAProperty<EUInformation, DataType.ExtensionObject>;
      levelMode?: UAProperty<EnumEqualityAndRelationalOperator, DataType.Int32>;
}
/**
 * Represents a hopper scale.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Scales/V2/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |HopperScaleType i=9                                         |
 * |isAbstract      |false                                                       |
 */
export interface UAHopperScale_Base extends UASimpleScale_Base {
   // PlaceHolder for $Limits$
    /**
     * levelMax
     * Defines a the maximum fill level where a action
     * is necessary.
     */
    levelMax?: UAHopperScale_levelMax<any, any>;
    /**
     * levelMin
     * Defines a the minimum fill level where a action
     * is necessary.
     */
    levelMin?: UAHopperScale_levelMin<any, any>;
    /**
     * limitMax
     * The current fill level exceeds the allowed
     * maximum level.
     */
    limitMax: UAProperty<boolean, DataType.Boolean>;
    /**
     * limitMin
     * The current fill level falls below the allowed
     * minimum level.
     */
    limitMin: UAProperty<boolean, DataType.Boolean>;
}
export interface UAHopperScale extends UASimpleScale, UAHopperScale_Base {
}