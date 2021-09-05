// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { Byte } from "node-opcua-basic-types"
import { UAWriterGroupTransport, UAWriterGroupTransport_Base } from "./ua_writer_group_transport"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |DatagramWriterGroupTransportType ns=0;i=21133     |
 * |isAbstract      |false                                             |
 */
export interface UADatagramWriterGroupTransport_Base extends UAWriterGroupTransport_Base {
    messageRepeatCount?: UAProperty<Byte, /*z*/DataType.Byte>;
    messageRepeatDelay?: UAProperty<number, /*z*/DataType.Double>;
}
export interface UADatagramWriterGroupTransport extends UAWriterGroupTransport, UADatagramWriterGroupTransport_Base {
}