import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { UADevice, UADevice_Base } from "node-opcua-nodeset-di/dist/ua_device";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group";
import type { DataType } from "node-opcua-variant";

import type { UABatchInformation } from "./ua_batch_information";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/     |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |CommercialKitchenDeviceType i=1005                          |
 * |isAbstract      |true                                                        |
 */
export interface UACommercialKitchenDevice_Base extends UADevice_Base {
    batchInformation?: UABatchInformation;
    /**
     * deviceClass
     * Indicates in which domain or for what purpose a
     * device is used.
     */
    deviceClass: UAProperty<UAString, DataType.String>;
    deviceLocationName?: UAProperty<UAString, DataType.String>;
    errorConditions: UAObject;
    haCCPValues?: UAFunctionalGroup;
    informationConditions: UAObject;
}
export interface UACommercialKitchenDevice extends Omit<UADevice, "deviceClass">, UACommercialKitchenDevice_Base {}