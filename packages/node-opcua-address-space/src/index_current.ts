/**
 * @module node-opcua-address-space
 */
export { AddressSpace } from "./address_space";
export * from "../source/session_context";
export * from "../source/helpers/dump_tools";
export * from "../source/helpers/adjust_browse_direction";
export * from "../source/pseudo_session";
export * from "../source/helpers/make_optionals_map";
export * from "../source/helpers/argument_list";
export * from "../source/helpers/call_helpers";
export * from "../source/helpers/ensure_secure_access";
export * from "../source/helpers/resolve_opaque_on_address_space";
export * from "../source/interfaces/alarms_and_conditions/condition_info_i";
export * from "../src/nodeset_tools/construct_namespace_dependency";


export * from "../source/set_namespace_meta_data";
export * from "../source/namespace";
export * from "../source/namespace_data_access";
export * from "../source/namespace_machine_state"
export * from "../source/namespace_alarm_and_condition";

export { ensureDatatypeExtracted, ensureDatatypeExtractedWithCallback } from "../source/loader/ensure_datatype_extracted";

export * from "../source/loader/generateAddressSpaceRaw";
export * from "../source/loader/register_node_promoter";

export { ContinuationPointManager } from "../source/continuation_points/continuation_point_manager";

export { promoteToStateMachine, promoteToStateMachineType } from "./state_machine/finite_state_machine";
export * from "../source/interfaces/state_machine/ua_transition_ex";

export * from "./namespace_impl";
export * from "./extension_object_array_node";
export * from "./event_data";

export { NamespaceOptions } from "./nodeid_manager";
export * from "./nodeset_tools/nodeset_to_xml";
export { dumpToBSD } from "./nodeset_tools/dump_to_bsd";
export { adjustNamespaceArray } from "./nodeset_tools/adjust_namespace_array";
export { makeAttributeEventName } from "./base_node_impl";
export { resolveReferenceNode, resolveReferenceType } from "./reference_impl";

export * from "./data_access/adjust_datavalue_status_code";
export * from "./data_access/add_dataItem_stuff";
export * from "./data_access/ua_multistate_discrete_impl";
export * from "./data_access/ua_multistate_value_discrete_impl";
export * from "./data_access/ua_two_state_discrete_impl";

export { VariableHistorian } from "./historical_access/address_space_historical_data_node";
export { NodeIdManager } from "../src/nodeid_manager";
export * from "../src/private_namespace";

export * from "./alarms_and_conditions";
export * from "./event_data";

export * from "node-opcua-nodeset-ua";

export * from "../src/validate_data_type_correctness";
export * from "../source/ua_addin";
export * from "../source/ua_interface";