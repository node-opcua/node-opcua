// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { Int32, UAString } from "node-opcua-basic-types"
import { UATopologyElement, UATopologyElement_Base } from "./ua_topology_element"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:ComponentType ns=1;i=15063                      |
 * |isAbstract      |true                                              |
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
export interface UAComponent extends UATopologyElement, UAComponent_Base {
}