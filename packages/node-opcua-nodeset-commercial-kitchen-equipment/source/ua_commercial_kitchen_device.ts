// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType, Variant } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { Int32, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { DTTimeZone } from "node-opcua-nodeset-ua/source/dt_time_zone"
import { UADevice, UADevice_Base } from "node-opcua-nodeset-di/source/ua_device"
import { UAFunctionalGroup } from "node-opcua-nodeset-di/source/ua_functional_group"
import { UABatchInformation } from "./ua_batch_information"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/CommercialKitchenEquipment/|
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |5:CommercialKitchenDeviceType ns=5;i=1005         |
 * |isAbstract      |true                                              |
 */
export interface UACommercialKitchenDevice_Base extends UADevice_Base {
    batchInformation?: UABatchInformation;
    /**
     * deviceClass
     * Indicates in which domain or for what purpose a
     * device is used.
     */
    deviceClass: UAProperty<UAString, /*z*/DataType.String>;
    deviceLocationName?: UAProperty<UAString, /*z*/DataType.String>;
    errorConditions: UAObject;
    haCCPValues?: UAFunctionalGroup;
    informationConditions: UAObject;
}
export interface UACommercialKitchenDevice extends Omit<UADevice, "deviceClass">, UACommercialKitchenDevice_Base {
}