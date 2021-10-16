import { INamespace } from "node-opcua-address-space-base";

import { INamespaceAlarmAndCondition } from "./namespace_alarm_and_condition";
import { INamespaceDataAccess } from "./namespace_data_access";
import { INamespaceMachineState } from "./namespace_machine_state";

export interface Namespace extends INamespace, INamespaceAlarmAndCondition, INamespaceDataAccess, INamespaceMachineState {}
