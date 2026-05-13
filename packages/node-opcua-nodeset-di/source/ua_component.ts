import type { UAProperty } from "node-opcua-address-space-base";
import type { Int32, UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { UATopologyElement, UATopologyElement_Base } from "./ua_topology_element";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ComponentType i=15063                                       |
 * |isAbstract      |true                                                        |
 */
export interface UAComponent_Base extends UATopologyElement_Base {
    manufacturer?: UAProperty<LocalizedText, DataType.LocalizedText>;
    manufacturerUri?: UAProperty<UAString, DataType.String>;
    model?: UAProperty<LocalizedText, DataType.LocalizedText>;
    hardwareRevision?: UAProperty<UAString, DataType.String>;
    softwareRevision?: UAProperty<UAString, DataType.String>;
    deviceRevision?: UAProperty<UAString, DataType.String>;
    productCode?: UAProperty<UAString, DataType.String>;
    deviceManual?: UAProperty<UAString, DataType.String>;
    deviceClass?: UAProperty<UAString, DataType.String>;
    serialNumber?: UAProperty<UAString, DataType.String>;
    productInstanceUri?: UAProperty<UAString, DataType.String>;
    revisionCounter?: UAProperty<Int32, DataType.Int32>;
    assetId?: UAProperty<UAString, DataType.String>;
    componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
}
export interface UAComponent extends UATopologyElement, UAComponent_Base {}