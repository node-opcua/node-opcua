import type { INamespace } from "node-opcua-address-space-base";

import type { INamespaceAlarmAndCondition } from "./namespace_alarm_and_condition.js";
import type { INamespaceDataAccess } from "./namespace_data_access.js";
import type { INamespaceMachineState } from "./namespace_machine_state.js";

export interface Namespace extends INamespace, INamespaceAlarmAndCondition, INamespaceDataAccess, INamespaceMachineState {}
