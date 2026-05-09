import type { INamespace } from "node-opcua-address-space-base";

import type { INamespaceAlarmAndCondition } from "./namespace_alarm_and_condition";
import type { INamespaceDataAccess } from "./namespace_data_access";
import type { INamespaceMachineState } from "./namespace_machine_state";

export interface Namespace extends INamespace, INamespaceAlarmAndCondition, INamespaceDataAccess, INamespaceMachineState {}
