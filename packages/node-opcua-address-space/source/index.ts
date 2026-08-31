/**
 * @module node-opcua-address-space
 */

export * from "node-opcua-address-space-base";
export * from "node-opcua-nodeset-ua";
// ---------------------------------------------------------------------------------------
// Implementation detail, exported only so that it keeps being exported.
//
// These names reached consumers through the old `main`, src/index_current.js, which this
// entry replaces. Dropping them would be a breaking change for anyone importing one, so they
// are re-exported here and marked internal instead: the documentation excludes them
// (typedoc's excludeInternal is already on), while the runtime surface stays exactly what it
// was. They go at 3.0, together with stripInternal.
//
// 52 names. Nothing new belongs in this block.
// ---------------------------------------------------------------------------------------
/** @internal */
export {
    ConditionInfoImpl,
    ConditionSnapshotImpl,
    OneDayDuration,
    promoteToCertificateExpirationAlarm,
    TwoWeeksDuration,
    UAAcknowledgeableConditionImpl,
    UAAcknowledgeableConditionImplBase,
    UAAlarmConditionImpl,
    UAAlarmConditionImplBase,
    UACertificateExpirationAlarmImpl,
    UAConditionImpl,
    UAConditionImplBase,
    UADiscreteAlarmImpl,
    UADiscreteAlarmImplBase,
    UAExclusiveDeviationAlarmImpl,
    UAExclusiveDeviationAlarmImplBase,
    UAExclusiveLevelAlarmImpl,
    UAExclusiveLimitAlarmImpl,
    UAExclusiveLimitAlarmImplBase,
    UALimitAlarmImpl,
    UALimitAlarmImplBase,
    UANonExclusiveDeviationAlarmImpl,
    UANonExclusiveDeviationAlarmImplBase,
    UANonExclusiveLimitAlarmImpl,
    UANonExclusiveLimitAlarmImplBase
} from "../src/alarms_and_conditions/index.js";
export { instantiateCertificateExpirationAlarm } from "../src/alarms_and_conditions/ua_certificate_expiration_alarm_impl.js";
/** @internal */
export { makeAttributeEventName } from "../src/base_node_impl.js";
/** @internal */
export { add_dataItem_stuff } from "../src/data_access/add_dataItem_stuff.js";
/** @internal */
export { adjustDataValueStatusCode } from "../src/data_access/adjust_datavalue_status_code.js";
/** @internal */
export {
    _addMultiStateDiscrete,
    promoteToMultiStateDiscrete,
    UAMultiStateDiscreteImpl,
    UAMultiStateDiscreteImplBase
} from "../src/data_access/ua_multistate_discrete_impl.js";
// deprecated: validateDataType
/** @internal */
export {
    _addMultiStateValueDiscrete,
    promoteToMultiStateValueDiscrete,
    UAMultiStateValueDiscreteImpl,
    UAMultiStateValueDiscreteImplBase,
    validateDataType,
    validateIsNumericDataType
} from "../src/data_access/ua_multistate_value_discrete_impl.js";
/** @internal */
export {
    _addTwoStateDiscrete,
    promoteToTwoStateDiscrete,
    UATwoStateDiscreteImpl,
    UATwoStateDiscreteImplBase
} from "../src/data_access/ua_two_state_discrete_impl.js";
export * from "../src/event_data.js";
/** @internal */
export { addElement, bindExtObjArrayNode, createExtObjArrayNode, removeElement } from "../src/extension_object_array_node.js";
/** @internal */
export { VariableHistorian } from "../src/historical_access/address_space_historical_data_node.js";
/** @internal */
export { isNonEmptyQualifiedName, NamespaceImpl } from "../src/namespace_impl.js";
/** @internal */
export { ConstructNodeIdOptions, NamespaceOptions, NodeIdManager } from "../src/nodeid_manager.js";
/** @internal */
export { adjustNamespaceArray } from "../src/nodeset_tools/adjust_namespace_array.js";
export * from "../src/nodeset_tools/construct_namespace_dependency.js";
/** @internal */
export { dumpToBSD } from "../src/nodeset_tools/dump_to_bsd.js";
/** @internal */
export { sortByBrowseName } from "../src/nodeset_tools/nodeset_to_xml.js";
export * from "../src/private_namespace.js";
/** @internal */
export { resolveReferenceNode, resolveReferenceType } from "../src/reference_impl.js";
/** @internal */
export { promoteToStateMachine, promoteToStateMachineType } from "../src/state_machine/finite_state_machine.js";
export { validateDataTypeCorrectness } from "../src/validate_data_type_correctness.js";
export * from "./address_space_public.js";
export * from "./address_space_ts.js";
export { ContinuationPointManager } from "./continuation_points/continuation_point_manager.js";
export { adjustBrowseDirection } from "./helpers/adjust_browse_direction.js";
export * from "./helpers/argument_list.js";
export * from "./helpers/call_helpers.js";
export * from "./helpers/dump_tools.js";
export * from "./helpers/ensure_secure_access.js";
export * from "./helpers/make_optionals_map.js";
export { resolveOpaqueOnAddressSpace } from "./helpers/resolve_opaque_on_address_space.js";
export * from "./interfaces/alarms_and_conditions/condition_info_i.js";
export * from "./interfaces/alarms_and_conditions/condition_snapshot.js";
export * from "./interfaces/alarms_and_conditions/instantiate_alarm_condition_options.js";
export * from "./interfaces/alarms_and_conditions/instantiate_condition_options.js";
export * from "./interfaces/alarms_and_conditions/instantiate_exclusive_limit_alarm_options.js";
export * from "./interfaces/alarms_and_conditions/instantiate_limit_alarm_options.js";
export * from "./interfaces/alarms_and_conditions/instantiate_off_normal_alarm_options.js";
export * from "./interfaces/alarms_and_conditions/ua_acknowledgeable_condition_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_alarm_condition_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_base_event_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_certificate_expiration_alarm_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_condition_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_discrete_alarm_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_exclusive_deviation_alarm_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_exclusive_limit_alarm_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_limit_alarm_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_non_exclusive_deviation_alarm_ex.js";
export * from "./interfaces/alarms_and_conditions/ua_non_exclusive_limit_alarm_ex.js";
export * from "./interfaces/data_access/ua_multistate_discrete_ex.js";
export * from "./interfaces/data_access/ua_multistate_value_discrete_ex.js";
export * from "./interfaces/data_access/ua_two_state_discrete_ex.js";
export * from "./interfaces/data_access/ua_y_array_item_ex.js";
export * from "./interfaces/extension_object_constructor.js";
export * from "./interfaces/nodeset_loader_options.js";
export * from "./interfaces/state_machine/ua_exclusive_limit_state_machine_type_ex.js";
export * from "./interfaces/state_machine/ua_finite_state_machine_type.js";
export * from "./interfaces/state_machine/ua_program_state_machine_type.js";
export * from "./interfaces/state_machine/ua_shelved_state_machine_ex.js";
export * from "./interfaces/state_machine/ua_state_machine_type.js";
export * from "./interfaces/state_machine/ua_transition_ex.js";
export * from "./interfaces/ua_subscription_diagnostics_variable_ex.js";
export { ensureDatatypeExtracted, ensureDatatypeExtractedWithCallback } from "./loader/ensure_datatype_extracted.js";
export * from "./loader/generateAddressSpaceRaw.js";
export * from "./loader/register_node_promoter.js";
export * from "./namespace.js";
export type { INamespaceAlarmAndCondition } from "./namespace_alarm_and_condition.js";
export * from "./namespace_data_access.js";
export * from "./pseudo_session.js";
export * from "./session_context.js";
export * from "./set_namespace_meta_data.js";
export * from "./ua_addin.js";
export * from "./ua_interface.js";
export * from "./ua_root_folder.js";
