import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UInt16 } from "node-opcua-basic-types";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface.js";
import type { DataType } from "node-opcua-variant";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IAssetRevisionType i=9                                      |
 * |isAbstract      |true                                                        |
 */
export interface UAIAssetRevision_Base extends UABaseInterface_Base {
    buildAssetNumber?: UAProperty<UInt16, DataType.UInt16>;
    majorAssetVersion?: UAProperty<UInt16, DataType.UInt16>;
    minorAssetVersion?: UAProperty<UInt16, DataType.UInt16>;
    subBuildAssetNumber?: UAProperty<UInt16, DataType.UInt16>;
    verifyAsset?: UAMethod;
}
export interface UAIAssetRevision extends UABaseInterface, UAIAssetRevision_Base {}