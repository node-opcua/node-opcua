// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UInt32 } from "node-opcua-basic-types"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |PubSubCapabilitiesType i=23832                              |
 * |isAbstract      |false                                                       |
 */
export interface UAPubSubCapabilities_Base {
    maxPubSubConnections: UAProperty<UInt32, DataType.UInt32>;
    maxWriterGroups: UAProperty<UInt32, DataType.UInt32>;
    maxReaderGroups: UAProperty<UInt32, DataType.UInt32>;
    maxDataSetWriters: UAProperty<UInt32, DataType.UInt32>;
    maxDataSetReaders: UAProperty<UInt32, DataType.UInt32>;
    maxFieldsPerDataSet: UAProperty<UInt32, DataType.UInt32>;
    maxDataSetWritersPerGroup?: UAProperty<UInt32, DataType.UInt32>;
    maxNetworkMessageSizeDatagram?: UAProperty<UInt32, DataType.UInt32>;
    maxNetworkMessageSizeBroker?: UAProperty<UInt32, DataType.UInt32>;
    supportSecurityKeyPull?: UAProperty<boolean, DataType.Boolean>;
    supportSecurityKeyPush?: UAProperty<boolean, DataType.Boolean>;
}
export interface UAPubSubCapabilities extends UAObject, UAPubSubCapabilities_Base {
}