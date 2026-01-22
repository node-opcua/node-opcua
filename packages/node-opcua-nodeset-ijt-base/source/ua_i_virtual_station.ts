// ----- this file has been automatically generated - do not edit
import { UAIJoiningSystemAsset, UAIJoiningSystemAsset_Base, UAIJoiningSystemAsset_identification } from "./ua_i_joining_system_asset"
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IVirtualStationType i=1031                                  |
 * |isAbstract      |true                                                        |
 */
export interface UAIVirtualStation_Base extends UAIJoiningSystemAsset_Base {
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
    identification: UAIJoiningSystemAsset_identification;
}
export interface UAIVirtualStation extends Omit<UAIJoiningSystemAsset, "identification">, UAIVirtualStation_Base {
}