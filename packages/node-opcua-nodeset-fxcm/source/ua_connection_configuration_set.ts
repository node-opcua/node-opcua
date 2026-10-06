import type { UAObject, UAProperty } from "node-opcua-address-space-base";
import type { UInt32 } from "node-opcua-basic-types";
import type { UALockingServices } from "node-opcua-nodeset-di/dist/ua_locking_services.js";
import type { DTPubSubKeyPushTarget } from "node-opcua-nodeset-ua/dist/dt_pub_sub_key_push_target.js";
import type { DTSecurityGroup } from "node-opcua-nodeset-ua/dist/dt_security_group.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { DataType } from "node-opcua-variant";

import type { DTConnectionDiagnostics } from "./dt_connection_diagnostics.js";
import type { DTSecurityKeyServerAddress } from "./dt_security_key_server_address.js";
import type { UAConnectionConfigurationSetStateMachine } from "./ua_connection_configuration_set_state_machine.js";
import type { UASecurityKeyServerAddress } from "./ua_security_key_server_address.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/CM/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |ConnectionConfigurationSetType i=1012                       |
 * |isAbstract      |false                                                       |
 */
export interface UAConnectionConfigurationSet_Base {
   // PlaceHolder for $AutomationComponentConfiguration$
   // PlaceHolder for $CommunicationFlow$
   // PlaceHolder for $Connection$
   // PlaceHolder for $ServerAddress$
    connectionConfigurationSetStateMachine: UAConnectionConfigurationSetStateMachine;
    connectionsDiagnostics?: UABaseDataVariable<DTConnectionDiagnostics[], DataType.ExtensionObject>;
    edit?: UAProperty<boolean, DataType.Boolean>;
    lock: UALockingServices;
    pubSubKeyPushTargets?: UABaseDataVariable<DTPubSubKeyPushTarget[], DataType.ExtensionObject>;
    rollbackOnError: UAProperty<boolean, DataType.Boolean>;
    securityGroups?: UABaseDataVariable<DTSecurityGroup[], DataType.ExtensionObject>;
    securityKeyServer?: UASecurityKeyServerAddress<DTSecurityKeyServerAddress>;
    version?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
export interface UAConnectionConfigurationSet extends UAObject, UAConnectionConfigurationSet_Base {}