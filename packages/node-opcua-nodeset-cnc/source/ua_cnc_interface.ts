// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { NodeId } from "node-opcua-nodeid"
import { UInt32, UAString } from "node-opcua-basic-types"
import { DTCncPosition } from "./dt_cnc_position"
import { UACncAxisList } from "./ua_cnc_axis_list"
import { UACncChannelList } from "./ua_cnc_channel_list"
import { UACncSpindleList } from "./ua_cnc_spindle_list"
/**
 * Entry point to CNC data interface.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CNC                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |11:CncInterfaceType ns=11;i=1007                  |
 * |isAbstract      |false                                             |
 */
export interface UACncInterface_Base {
    /**
     * cncAxisList
     * List of CNC axis objects.
     */
    cncAxisList: UACncAxisList;
    /**
     * cncChannelList
     * List of CNC channel objects.
     */
    cncChannelList: UACncChannelList;
    /**
     * cncSpindleList
     * List of CNC spindle objects.
     */
    cncSpindleList: UACncSpindleList;
    cncTypeName?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * fix
     * Version of CNC interface considering changes in
     * implementation (Bug Fix).
     */
    fix?: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * vendorName
     * Name of CNC system vendor. Format and content may
     * be chosen by vendor.
     */
    vendorName: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * vendorRevision
     * Vendor revision of CNC interface. Format and
     * content may be chosen by vendor.
     */
    vendorRevision: UAProperty<UAString, /*z*/DataType.String>;
    /**
     * version
     * Version of CNC interface - corresponds to version
     * of OPC UA companion standard.
     */
    version: UAProperty<UAString, /*z*/DataType.String>;
}
export interface UACncInterface extends UAObject, UACncInterface_Base {
}