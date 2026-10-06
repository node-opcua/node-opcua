import type { UAMethod, UAProperty } from "node-opcua-address-space-base";
import type { UAString, UInt32 } from "node-opcua-basic-types";
import type { UAFunctionalGroup } from "node-opcua-nodeset-di/dist/ua_functional_group.js";
import type { UABaseDataVariable } from "node-opcua-nodeset-ua/dist/ua_base_data_variable.js";
import type { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/dist/ua_base_interface.js";
import type { UAFolder } from "node-opcua-nodeset-ua/dist/ua_folder.js";
import type { DataType } from "node-opcua-variant";

import type { DTApplicationIdentifier } from "./dt_application_identifier.js";
import type { DTFxVersion } from "./dt_fx_version.js";
import type { UAConfigurationDataFolder } from "./ua_configuration_data_folder.js";
import type { UAConnectionEndpointsFolder } from "./ua_connection_endpoints_folder.js";
import type { UAControlGroupsFolder } from "./ua_control_groups_folder.js";
import type { UAFunctionalEntityCapabilities } from "./ua_functional_entity_capabilities.js";
import type { UAInputsFolder } from "./ua_inputs_folder.js";
import type { UAOutputsFolder } from "./ua_outputs_folder.js";
import type { UAPublisherCapabilities } from "./ua_publisher_capabilities.js";
import type { UASubscriberCapabilities } from "./ua_subscriber_capabilities.js";

// ----- this file has been automatically generated - do not edit

export interface UAIFunctionalEntity_configurationData extends UAConfigurationDataFolder { // Object
      configuration?: UAFunctionalGroup;
      tuning?: UAFunctionalGroup;
}
export interface UAIFunctionalEntity_diagnostics extends UAFunctionalGroup { // Object
      cleanedUpConnectionCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      errorConnectionCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      existingConnectionCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      failedConnectionCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      failedEstablishAttemptsCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      failedVerificationCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      operationalConnectionCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
      totalEstablishAttemptsCount?: UABaseDataVariable<UInt32, DataType.UInt32>;
}
/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/FX/AC/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IFunctionalEntityType i=11                                  |
 * |isAbstract      |true                                                        |
 */
export interface UAIFunctionalEntity_Base extends UABaseInterface_Base {
    applicationIdentifier?: UAProperty<DTApplicationIdentifier[], DataType.ExtensionObject>;
    authorAssignedIdentifier?: UAProperty<UAString, DataType.String>;
    authorAssignedVersion?: UAProperty<DTFxVersion, DataType.ExtensionObject>;
    authorUri?: UAProperty<UAString, DataType.String>;
    capabilities?: UAFunctionalEntityCapabilities;
    configurationData?: UAIFunctionalEntity_configurationData;
    connectionEndpoints?: UAConnectionEndpointsFolder;
    controlGroups?: UAControlGroupsFolder;
    diagnostics?: UAIFunctionalEntity_diagnostics;
    inputData?: UAInputsFolder;
    operational?: UAFunctionalGroup;
    operationalHealth?: UABaseDataVariable<UInt32, DataType.UInt32>;
    operationalHealthAlarms?: UAFolder;
    outputData?: UAOutputsFolder;
    publisherCapabilities?: UAPublisherCapabilities;
    status?: UAFunctionalGroup;
    subscriberCapabilities?: UASubscriberCapabilities;
    verify?: UAMethod;
}
export interface UAIFunctionalEntity extends UABaseInterface, UAIFunctionalEntity_Base {}