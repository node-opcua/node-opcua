// ----- this file has been automatically generated - do not edit
import { UAObject, UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UInt32, Int32, UAString } from "node-opcua-basic-types"
import { DTArgument } from "node-opcua-nodeset-ua/source/dt_argument"
import { UATemporaryFileTransfer } from "node-opcua-nodeset-ua/source/ua_temporary_file_transfer"
import { UABaseDataVariable } from "node-opcua-nodeset-ua/source/ua_base_data_variable"
import { UASoftwareLoading } from "./ua_software_loading"
import { UAPrepareForUpdateStateMachine } from "./ua_prepare_for_update_state_machine"
import { UAInstallationStateMachine } from "./ua_installation_state_machine"
import { UAPowerCycleStateMachine } from "./ua_power_cycle_state_machine"
import { UAConfirmationStateMachine } from "./ua_confirmation_state_machine"
/**
 * |                |                                                  |
 * |----------------|--------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/DI/                   |
 * |nodeClass       |ObjectType                                        |
 * |typedDefinition |1:SoftwareUpdateType ns=1;i=1                     |
 * |isAbstract      |false                                             |
 */
export interface UASoftwareUpdate_Base {
    loading?: UASoftwareLoading;
    prepareForUpdate?: UAPrepareForUpdateStateMachine;
    installation?: UAInstallationStateMachine;
    powerCycle?: UAPowerCycleStateMachine;
    confirmation?: UAConfirmationStateMachine;
    parameters?: UATemporaryFileTransfer;
    updateStatus?: UABaseDataVariable<LocalizedText, DataType.LocalizedText>;
    vendorErrorCode?: UABaseDataVariable<Int32, DataType.Int32>;
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
}
export interface UASoftwareUpdate extends UAObject, UASoftwareUpdate_Base {
}