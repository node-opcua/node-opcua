/**
 * @module node-opcua-address-space
 */

export * from "node-opcua-address-space-base";
export * from "node-opcua-nodeset-ua";
export { instantiateCertificateExpirationAlarm } from "../src/alarms_and_conditions/ua_certificate_expiration_alarm_impl.js";
export { promoteToMultiStateDiscrete } from "../src/data_access/ua_multistate_discrete_impl.js";
// deprecated: validateDataType
export {
    promoteToMultiStateValueDiscrete,
    validateDataType,
    validateIsNumericDataType
} from "../src/data_access/ua_multistate_value_discrete_impl.js";
export { promoteToTwoStateDiscrete } from "../src/data_access/ua_two_state_discrete_impl.js";
export * from "../src/event_data.js";
export { ConstructNodeIdOptions, NodeIdManager } from "../src/nodeid_manager.js";
export * from "../src/nodeset_tools/construct_namespace_dependency.js";
export * from "../src/private_namespace.js";
export { validateDataTypeCorrectness } from "../src/validate_data_type_correctness.js";
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
