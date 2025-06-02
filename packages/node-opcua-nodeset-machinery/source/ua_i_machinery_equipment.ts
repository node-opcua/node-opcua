// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UALifetimeVariable } from "node-opcua-nodeset-di/dist/ua_lifetime_variable"
import { UAIMachineTagNameplate, UAIMachineTagNameplate_Base } from "./ua_i_machine_tag_nameplate"
/**
 * Provides base identification information of
 * MachineryEquipment that can be set by the user.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IMachineryEquipmentType i=1007                              |
 * |isAbstract      |true                                                        |
 */
export interface UAIMachineryEquipment_Base extends UAIMachineTagNameplate_Base {
    /**
     * $description
     * Additional information and description about the
     * MachineryEquipment. Should be used if Description
     * Attribute cannot be written via OPC UA and should
     * be ideally identical to Description Attribute.
     */
    "$description"?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * equipmentLife
     * Lifetime indication of the MachineryEquipment.
     */
    equipmentLife?: UALifetimeVariable<any, any>;
    /**
     * machineryEquipmentTypeId
     * Identification of a generic MachineryEquipment.
     * Defined by each company (e.g., company has an
     * MachineryEquipmentTypeId for all 8 mm drills).
     */
    machineryEquipmentTypeId: UAProperty<UAString, DataType.String>;
}
export interface UAIMachineryEquipment extends UAIMachineTagNameplate, UAIMachineryEquipment_Base {
}