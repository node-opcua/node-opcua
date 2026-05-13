import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { Int32, UAString } from "node-opcua-basic-types";
import type { LocalizedText, QualifiedName } from "node-opcua-data-model";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable";
import type { UATemporaryFileTransfer } from "node-opcua-nodeset-ua/dist/ua_temporary_file_transfer";
import type { DataType } from "node-opcua-variant";

import type { EnumSoftwareClass } from "./enum_software_class";
import type { UAConfirmationStateMachine } from "./ua_confirmation_state_machine";
import type { UAInstallationStateMachine } from "./ua_installation_state_machine";
import type { UAPowerCycleStateMachine } from "./ua_power_cycle_state_machine";
import type { UAPrepareForUpdateStateMachine } from "./ua_prepare_for_update_state_machine";
import type { UASoftwareLoading } from "./ua_software_loading";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                             |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |SoftwareUpdateType i=1                                      |
 * |isAbstract      |false                                                       |
 */
export interface UASoftwareUpdate_Base {
    loading?: UASoftwareLoading;
    prepareForUpdate?: UAPrepareForUpdateStateMachine;
    installation?: UAInstallationStateMachine;
    powerCycle?: UAPowerCycleStateMachine;
    confirmation?: UAConfirmationStateMachine;
    parameters?: UATemporaryFileTransfer;
    updateStatus?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    softwareClass?: UAProperty<EnumSoftwareClass, DataType.Int32>;
    softwareSubclass?: UAProperty<UAString, DataType.String>;
    softwareName?: UAProperty<UAString, DataType.String>;
    unsignedPackageAllowed?: UAProperty<boolean, DataType.Boolean>;
    vendorErrorCode?: UABaseDataVariable<Int32, DataType.Int32>;
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
}
export interface UASoftwareUpdate extends UAObject, UASoftwareUpdate_Base {}