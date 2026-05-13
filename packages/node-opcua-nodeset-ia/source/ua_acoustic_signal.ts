import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * Represents an acoustic signal.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IA/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AcousticSignalType i=1009                                   |
 * |isAbstract      |false                                                       |
 */
export interface UAAcousticSignal_Base {
    /**
     * audioSample
     * Contains the audio data, e.g. for devices capable
     * of audio playback.
     */
    audioSample?: UABaseDataVariable<Buffer, DataType.ByteString>;
    /**
     * numberInList
     * Enumerate the acoustic signals. Instances of
     * StackElementAcousticType index into this number
     * using the OperationMode Property.
     */
    numberInList: UAProperty<any, any>;
}
export interface UAAcousticSignal extends UAObject, UAAcousticSignal_Base {}