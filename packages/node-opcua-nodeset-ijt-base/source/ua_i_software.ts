// ----- this file has been automatically generated - do not edit
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAMachineryItemIdentification } from "node-opcua-nodeset-machinery/source/ua_machinery_item_identification"
import { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base } from "./ua_i_joining_system_asset"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ISoftwareType i=1019                                        |
 * |isAbstract      |true                                                        |
 */
export interface UAISoftware_Base extends UAIJoiningSystemAsset_Base {
    /**
     * identification
     * The Identification Object, using the standardized
     * name defined in OPC 10000-100, provides
     * identification information about the asset. This
     * is a mandatory place holder and any asset
     * inheriting IJoiningSystemAssetType will replace
     * it with MachineIdentificationType or
     * MachineryComponentIdentificationType.
     */
    identification: UAMachineryItemIdentification;
}
export interface UAISoftware extends Omit<UAIJoiningSystemAsset, "identification">, UAISoftware_Base {
}