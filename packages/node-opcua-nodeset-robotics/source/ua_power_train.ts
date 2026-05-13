import type { UAProperty } from "node-opcua-address-space-base";
import type { LocalizedText } from "node-opcua-data-model";
import type { UAComponent, UAComponent_Base } from "node-opcua-nodeset-di/dist/ua_component";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * The PowerTrainType represents instances of
 * powertrains of a motion device.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Robotics/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PowerTrainType i=16794                                      |
 * |isAbstract      |false                                                       |
 */
export interface UAPowerTrain_Base extends UAComponent_Base {
   // PlaceHolder for $GearIdentifier$
   // PlaceHolder for $MotorIdentifier$
    componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAPowerTrain extends Omit<UAComponent, "componentName">, UAPowerTrain_Base {}