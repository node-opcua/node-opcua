// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { UInt32, Byte, UAString } from "node-opcua-basic-types"
import { EnumTsnStreamState } from "./enum_tsn_stream_state"
import { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface"
import { UABaseDataVariable } from "./ua_base_data_variable"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                      |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |IIeeeBaseTsnStreamType ns=0;i=24173               |
 * |isAbstract      |true                                              |
 */
export interface UAIIeeeBaseTsnStream_Base extends UABaseInterface_Base {
    streamId: UABaseDataVariable<Byte[], /*z*/DataType.Byte>;
    streamName: UABaseDataVariable<UAString, /*z*/DataType.String>;
    state: UABaseDataVariable<EnumTsnStreamState, /*z*/DataType.Int32>;
    accumulatedLatency?: UABaseDataVariable<UInt32, /*z*/DataType.UInt32>;
    srClassId?: UABaseDataVariable<Byte, /*z*/DataType.Byte>;
}
export interface UAIIeeeBaseTsnStream extends UABaseInterface, UAIIeeeBaseTsnStream_Base {
}