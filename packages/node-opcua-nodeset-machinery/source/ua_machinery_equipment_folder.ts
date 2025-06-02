// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAFolder, UAFolder_Base } from "node-opcua-nodeset-ua/dist/ua_folder"
export interface UAMachineryEquipmentFolder_$MachineryEquipment$ extends UAObject { // Object
      /**
       * assetId
       * Companywide unique ID for a specific asset (Each
       * 8 mm drill of a company has the same
       * MachineryEquipmentTypeId and a unique AssetId).
       */
      assetId?: UAProperty<UAString, DataType.String>;
      /**
       * componentName
       * Used name for the MachineryEquipment.
       */
      componentName?: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * $description
       * Additional information and description about the
       * MachineryEquipment. Should be used if Description
       * Attribute cannot be written via OPC UA and should
       * be ideally identical to Description Attribute.
       */
      "$description"?: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * deviceClass
       * Class of the MachineryEquipment (e.g.: Each drill
       * of a company has the DeviceClass "drill").
       */
      deviceClass?: UAProperty<UAString, DataType.String>;
      /**
       * location
       * Location of the MachineryEquipment (e.g.: Storage
       * Location; Position in the Tool Changer; Position
       * on the machine).
       */
      location?: UAProperty<UAString, DataType.String>;
      /**
       * machineryEquipmentTypeId
       * Identification of a generic MachineryEquipment.
       * Defined by each company (e.g., company has an
       * MachineryEquipmentTypeId for all 8 mm drills).
       */
      machineryEquipmentTypeId: UAProperty<UAString, DataType.String>;
      /**
       * manufacturerUri
       * Manufacturer of the MachineryEquipment.
       */
      manufacturerUri?: UAProperty<UAString, DataType.String>;
      /**
       * model
       * Model of the MachineryEquipment.
       */
      model?: UAProperty<LocalizedText, DataType.LocalizedText>;
      /**
       * serialNumber
       * Serial Number of the MachineryEquipment.
       */
      serialNumber?: UAProperty<UAString, DataType.String>;
}
/**
 * Defines an entry point for MachineryEquipment of
 * a MachineryItem.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/Machinery/                      |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |MachineryEquipmentFolderType i=1013                         |
 * |isAbstract      |false                                                       |
 */
export interface UAMachineryEquipmentFolder_Base extends UAFolder_Base {
   // PlaceHolder for $MachineryEquipment$
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
}
export interface UAMachineryEquipmentFolder extends UAFolder, UAMachineryEquipmentFolder_Base {
}