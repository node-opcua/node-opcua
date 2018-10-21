/**
 * @module opcua.address_space
 *
 * @type {{AddressSpace: AddressSpace, SessionContext: SessionContext, BaseNode: BaseNode, UAObject: UAObject, UAVariable: UAVariable, UAObjectType: UAObjectType, UAVariableType: UAVariableType, UAMethod: UAMethod, Reference: Reference, ReferenceType: ReferenceType, UADataType: UADataType, UAStateMachine: UAStateMachine, ConditionInfo: ConditionInfo, ConditionSnapshot: ConditionSnapshot, UAConditionBase: UAConditionBase, UAAcknowledgeableConditionBase: UAAcknowledgeableConditionBase, UALimitAlarm: UALimitAlarm, UANonExclusiveLimitAlarm: UANonExclusiveLimitAlarm, UAExclusiveLimitAlarm: UAExclusiveLimitAlarm, UADiscreteAlarm: UADiscreteAlarm, checkSelectClauses: checkSelectClauses, checkSelectClause: checkSelectClause, getMethodDeclaration_ArgumentList: getMethodDeclaration_ArgumentList, Argument: Argument, binaryStoreSize_ArgumentList: binaryStoreSize_ArgumentList, build_retrieveInputArgumentsDefinition: build_retrieveInputArgumentsDefinition, verifyArguments_ArgumentList: verifyArguments_ArgumentList, bindExtObjArrayNode: bindExtObjArrayNode, addElement: addElement, removeElement: removeElement, EventData: EventData, View: View, generate_address_space: generate_address_space}}
 */


module.exports = {

    AddressSpace: require("./address_space").AddressSpace,
    Namespace: require("./namespace").Namespace,

    SessionContext: require("./session_context").SessionContext,

    BaseNode: require("./base_node").BaseNode,

    UAObject: require("./ua_object").UAObject,
    UAVariable: require("./ua_variable").UAVariable,
    UAObjectType: require("./ua_object_type").UAObjectType,
    UAVariableType: require("./ua_variable_type").UAVariableType,
    UAMethod: require("./ua_method").UAMethod,
    Reference: require("./reference").Reference,

    ReferenceType:require("./referenceType").ReferenceType,

    UADataType: require("./ua_data_type").UADataType,

    UAStateMachine: require("./state_machine/finite_state_machine").UAStateMachine,

    // alarms & conditions
    ConditionInfo: require("./alarms_and_conditions/condition").ConditionInfo,
    ConditionSnapshot: require("./alarms_and_conditions/condition").ConditionSnapshot,

    UAConditionBase:                require("./alarms_and_conditions/condition").UAConditionBase,
    UAAcknowledgeableConditionBase: require("./alarms_and_conditions/acknowledgeable_condition").UAAcknowledgeableConditionBase,
    UALimitAlarm:                   require("./alarms_and_conditions/limit_alarm").UALimitAlarm,
    UANonExclusiveLimitAlarm:       require("./alarms_and_conditions/non_exclusive_limit_alarm").UANonExclusiveLimitAlarm,
    UAExclusiveLimitAlarm:          require("./alarms_and_conditions/exclusive_limit_alarm").UAExclusiveLimitAlarm,
    UADiscreteAlarm:                require("./alarms_and_conditions/discrete_alarm").UADiscreteAlarm,


    checkSelectClauses: require("./check_event_clause").checkSelectClauses,
    checkSelectClause: require("./check_event_clause").checkSelectClause,

    getMethodDeclaration_ArgumentList: require("./argument_list").getMethodDeclaration_ArgumentList,
    Argument: require("./argument_list").Argument,
    binaryStoreSize_ArgumentList: require("./argument_list").binaryStoreSize_ArgumentList,
    build_retrieveInputArgumentsDefinition: require("./argument_list").build_retrieveInputArgumentsDefinition,
    verifyArguments_ArgumentList: require("./argument_list").verifyArguments_ArgumentList,

    bindExtObjArrayNode: require("./extension_object_array_node").bindExtObjArrayNode,
    addElement: require("./extension_object_array_node").addElement,
    removeElement: require("./extension_object_array_node").removeElement,
    createExtObjArrayNode: require("./extension_object_array_node").createExtObjArrayNode,

    EventData: require("./address_space_add_event_type").EventData,

    View: require("./view").View,

    generate_address_space: require("./loader/load_nodeset2").generate_address_space,

    PseudoSession : require("./pseudo_session").PseudoSession
};
