/**
 * @module node-opcua-address-space
 */
export * from "./address_space_ts";

export * from "./interfaces/state_machine/ua_state_machine_type";
export * from "./interfaces/state_machine/ua_exclusive_limit_state_machine_type_ex";
export * from "./interfaces/state_machine/ua_finite_state_machine_type";
export * from "./interfaces/state_machine/ua_program_state_machine_type";
export * from "./interfaces/state_machine/ua_transition_ex";

export * from "./interfaces/ua_subscription_diagnostics_variable_ex";

export * from "./interfaces/data_access/ua_multistate_discrete_ex";
export * from "./interfaces/data_access/ua_multistate_value_discrete_ex";
export * from "./interfaces/data_access/ua_two_state_discrete_ex";
export * from "./interfaces/data_access/ua_y_array_item_ex";

export { promoteToMultiStateDiscrete } from "../src/data_access/ua_multistate_discrete_impl";
export { promoteToMultiStateValueDiscrete } from "../src/data_access/ua_multistate_value_discrete";
export { promoteToTwoStateDiscrete } from "../src/data_access/ua_two_state_discrete";

export * from "../source/ua_root_folder";
export * from "./session_context";
export * from "./pseudo_session";

export * from "./helpers/dump_tools";
export * from "./helpers/make_optionals_map";
export * from "./helpers/check_event_clause";
export * from "./helpers/argument_list";
export * from "./helpers/call_helpers";
export * from "./helpers/ensure_secure_access";
export { adjustBrowseDirection } from "./helpers/adjust_browse_direction";
export { resolveOpaqueOnAddressSpace } from "./helpers/resolve_opaque_on_address_space";

export { ContinuationPointManager } from "./continuation_points/continuation_point_manager";
export { ensureDatatypeExtracted, ensureDatatypeExtractedWithCallback } from "./loader/ensure_datatype_extracted";

export * from "../source/loader/generateAddressSpaceRaw";

export * from "./namespace";
export * from "../src/alarms_and_conditions";
export * from "../src/namespace_private";

export { NodeIdManager, ConstructNodeIdOptions } from "../src/nodeid_manager";
export * from "../src/event_data";
export * from "./set_namespace_meta_data";

export * from "node-opcua-address-space-base";
export * from "node-opcua-nodeset-ua";
