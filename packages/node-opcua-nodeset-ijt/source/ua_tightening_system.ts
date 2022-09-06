// ----- this file has been automatically generated - do not edit
import { UAObject, UAMethod, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { QualifiedName } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAFolder } from "node-opcua-nodeset-ua/source/ua_folder"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UAResultManagement } from "./ua_result_management"
export interface UATighteningSystem_assetManagement extends UAFolder { // Object
      /**
       * assets
       * The mandatory Assets Object is an instance of
       * FolderType to group set of assets available in
       * the given system.
       */
      assets: UAFolder;
}
export interface UATighteningSystem_resultManagement extends Omit<UAResultManagement, "defaultInstanceBrowseName"|"getLatestResult"|"getResultById"|"getResultListFiltered"|"releaseResultHandle"|"results"> { // Object
      /**
       * defaultInstanceBrowseName
       * The default BrowseName for instances of the type.
       */
      defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
      getLatestResult?: UAMethod;
      getResultById?: UAMethod;
      getResultListFiltered?: UAMethod;
      releaseResultHandle?: UAMethod;
      /**
       * results
       * This is an instance of FolderType and is used to
       * organize multiple available results in the
       * underlying system which the server decides to
       * expose in the Address Space. It may contain no
       * results if the server does not expose results in
       * the Address Space at all or if no available
       * result matches the criteria for exposure in the
       * Address Space.
       */
      results?: UAFolder;
}
export interface UATighteningSystem_systemInformation extends UAFolder { // Object
      /**
       * $description
       * The optional Description is the description of
       * the system which could be written by the customer
       * to identify the system. It could be the purpose
       * of the system in the assembly line. Examples:
       * Fixtured System, Handheld System, Brake bolt M10
       * left side, etc.
       */
      "$description"?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * integratorName
       * The optional IntegratorName is the name of the
       * system integrator.
       */
      integratorName?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * location
       * The optional Location is the location of the
       * given system in the given plant or factory in
       * text format.
       */
      location?: UABaseDataVariable<UAString, DataType.String>;
      /**
       * name
       * The mandatory Name is the name or model of the
       * tightening system. It can be provided by the
       * system integrator to identify the system.
       */
      name: UABaseDataVariable<UAString, DataType.String>;
      /**
       * systemId
       * The optional SystemId is the system integrator
       * specific identifier for the system. It represents
       * a reference to the manufacturer ERP system to
       * know determine what is the system.
       */
      systemId?: UABaseDataVariable<UAString, DataType.String>;
}
/**
 * The TighteningSystemType provides the overview of
 * data exposed from a given tightening system.
 *
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/                  |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |14:TighteningSystemType ns=14;i=1005              |
 * |isAbstract      |false                                             |
 */
export interface UATighteningSystem_Base {
    /**
     * assetManagement
     * The mandatory AssetManagement Object is an
     * instance of FolderType to group set of assets and
     * related objects in the tightening system.
     */
    assetManagement: UATighteningSystem_assetManagement;
    /**
     * resultManagement
     * The mandatory ResultManagement Object is an
     * instance of ResultManagementType which provides
     * mechanism to access results generated by the
     * underlying system.
     */
    resultManagement: UATighteningSystem_resultManagement;
    /**
     * systemInformation
     * The mandatory SystemInformation Object is an
     * instance of FolderType to group common parameters
     * for the tightening system.
     */
    systemInformation: UATighteningSystem_systemInformation;
}
export interface UATighteningSystem extends UAObject, UATighteningSystem_Base {
}