// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { UATopologyElement, UATopologyElement_Base } from "node-opcua-nodeset-di/source/ua_topology_element"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/ADI/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |2:AccessoryType ns=2;i=1019                       |
 * |isAbstract      |false                                             |
 */
export interface UAAccessory_Base extends UATopologyElement_Base {
    configuration: UAFunctionalGroup;
    status: UAFunctionalGroup;
    factorySettings: UAFunctionalGroup;
    /**
     * isHotSwappable
     * True if this accessory can be inserted in the
     * accessory slot while it is powered
     */
    isHotSwappable: UAProperty<boolean, /*z*/DataType.Boolean>;
    /**
     * isReady
     * True if this accessory is ready for use
     */
    isReady: UAProperty<boolean, /*z*/DataType.Boolean>;
}
export interface UAAccessory extends UATopologyElement, UAAccessory_Base {
}