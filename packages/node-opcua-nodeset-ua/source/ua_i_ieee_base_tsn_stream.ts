import type { Byte, UAString, UInt32 } from "node-opcua-basic-types";
import type { DataType } from "node-opcua-variant";

import type { EnumTsnStreamState } from "./enum_tsn_stream_state";
import type { UABaseDataVariable } from "./ua_base_data_variable";
import type { UABaseInterface, UABaseInterface_Base } from "./ua_base_interface";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/                                |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IIeeeBaseTsnStreamType i=24173                              |
 * |isAbstract      |true                                                        |
 */
export interface UAIIeeeBaseTsnStream_Base extends UABaseInterface_Base {
    streamId: UABaseDataVariable<Byte[], DataType.Byte>;
    streamName: UABaseDataVariable<UAString, DataType.String>;
    state: UABaseDataVariable<EnumTsnStreamState, DataType.Int32>;
    accumulatedLatency?: UABaseDataVariable<UInt32, DataType.UInt32>;
    srClassId?: UABaseDataVariable<Byte, DataType.Byte>;
}
export interface UAIIeeeBaseTsnStream extends UABaseInterface, UAIIeeeBaseTsnStream_Base {}