export {AddressSpace} from "./address_space";
export * from "../source/session_context";
export * from "../source/helpers/dump_tools";
export * from "../source/helpers/adjust_browse_direction";
export * from "../source/pseudo_session";
export * from "../source/helpers/make_optionals_map";
export * from "../source/helpers/check_event_clause";
export * from "../source/helpers/argument_list";
export * from "../source/interfaces/alarms_and_conditions/condition_info_i";

export { generateAddressSpace } from "../source";
export { promoteToStateMachine } from "./state_machine/finite_state_machine";

export * from "./namespace";
export * from "./base_node";
export * from "./extension_object_array_node";
export * from "./event_data";

export { NamespaceOptions } from "./namespace";
export { dumpXml } from "./nodeset_to_xml";
export * from "./data_access/ua_analog_item";
export * from "./data_access/ua_data_item";
export * from "./data_access/ua_multistate_discrete";
export * from "./data_access/ua_mutlistate_value_discrete";
export * from "./alarms_and_conditions/condition_info";
export * from "../test_helpers";

//  */
// module.exports = {
//
//     AddressSpace: require("./address_space").AddressSpace,
//     Namespace: require("./namespace").Namespace,
//
//     SessionContext: require("./session_context").SessionContext,
//
//     BaseNode: require("./base_node").BaseNode,
//
//     UAObject: require("./ua_object").UAObject,
//     UAVariable: require("./ua_variable").UAVariable,
//     UAObjectType: require("./ua_object_type").UAObjectType,
//     UAVariableType: require("./ua_variable_type").UAVariableType,
//     UAMethod: require("./ua_method").UAMethod,
//     Reference: require("./reference").Reference,
//
//     ReferenceType:require("./referenceType").ReferenceType,
//
//     UADataType: require("./ua_data_type").UADataType,
//
//     StateMachine: require("./state_machine/finite_state_machine").StateMachine,
//
//     // alarms & conditions
//     ConditionInfo: require("./alarms_and_conditions/condition").ConditionInfo,
//     ConditionSnapshot: require("./alarms_and_conditions/condition").ConditionSnapshot,
//
//     UAConditionBase:                require("./alarms_and_conditions/condition").UAConditionBase,
//     UAAcknowledgeableConditionBase: require("./alarms_and_conditions/acknowledgeable_condition").UAAcknowledgeableConditionBase,
//     UALimitAlarm:                   require("./alarms_and_conditions/limit_alarm").UALimitAlarm,
//     UANonExclusiveLimitAlarm:       require("./alarms_and_conditions/non_exclusive_limit_alarm").UANonExclusiveLimitAlarm,
//     UAExclusiveLimitAlarm:          require("./alarms_and_conditions/exclusive_limit_alarm").UAExclusiveLimitAlarm,
//     UADiscreteAlarm:                require("./alarms_and_conditions/discrete_alarm").UADiscreteAlarm,
//
//
//     checkSelectClauses: require("./check_event_clause").checkSelectClauses,
//     checkSelectClause: require("./check_event_clause").checkSelectClause,
//
//     getMethodDeclaration_ArgumentList: require("./argument_list").getMethodDeclaration_ArgumentList,
//     Argument: require("./argument_list").Argument,
//     binaryStoreSize_ArgumentList: require("./argument_list").binaryStoreSize_ArgumentList,
//     build_retrieveInputArgumentsDefinition: require("./argument_list").build_retrieveInputArgumentsDefinition,
//     verifyArguments_ArgumentList: require("./argument_list").verifyArguments_ArgumentList,
//
//     bindExtObjArrayNode: require("./extension_object_array_node").bindExtObjArrayNode,
//     addElement: require("./extension_object_array_node").addElement,
//     removeElement: require("./extension_object_array_node").removeElement,
//     createExtObjArrayNode: require("./extension_object_array_node").createExtObjArrayNode,
//
//     EventData: require("./address_space_add_event_type").EventData,
//
//     View: require("./ua_view").View,
//
//     generateAddressSpace: require("./loader/load_nodeset2").generateAddressSpace,
//
//     PseudoSession : require("../dist").PseudoSession,
//
//     VariableHistorian: require("./historical_access/address_space_historical_data_node").VariableHistorian
// };
// require("../src/nodeset_to_xml");
