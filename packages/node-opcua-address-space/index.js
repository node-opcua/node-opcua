/**
 * @module opcua.address_space
 *
 * @type {{AddressSpace: AddressSpace, SessionContext: SessionContext, BaseNode: BaseNode, UAObject: UAObject, UAVariable: UAVariable, UAObjectType: UAObjectType, UAVariableType: UAVariableType, UAMethod: UAMethod, Reference: Reference, ReferenceType: ReferenceType, UADataType: UADataType, UAStateMachine: UAStateMachine, ConditionInfo: ConditionInfo, ConditionSnapshot: ConditionSnapshot, UAConditionBase: UAConditionBase, UAAcknowledgeableConditionBase: UAAcknowledgeableConditionBase, UALimitAlarm: UALimitAlarm, UANonExclusiveLimitAlarm: UANonExclusiveLimitAlarm, UAExclusiveLimitAlarm: UAExclusiveLimitAlarm, UADiscreteAlarm: UADiscreteAlarm, checkSelectClauses: checkSelectClauses, checkSelectClause: checkSelectClause, getMethodDeclaration_ArgumentList: getMethodDeclaration_ArgumentList, Argument: Argument, binaryStoreSize_ArgumentList: binaryStoreSize_ArgumentList, build_retrieveInputArgumentsDefinition: build_retrieveInputArgumentsDefinition, verifyArguments_ArgumentList: verifyArguments_ArgumentList, bindExtObjArrayNode: bindExtObjArrayNode, addElement: addElement, removeElement: removeElement, EventData: EventData, View: View, generate_address_space: generate_address_space}}
 */


module.exports = {

    AddressSpace: require("./src/address_space").AddressSpace,

    SessionContext: require("./src/session_context").SessionContext,

    BaseNode: require("./src/base_node").BaseNode,

    UAObject: require("./src/ua_object").UAObject,
    UAVariable: require("./src/ua_variable").UAVariable,
    UAObjectType: require("./src/ua_object_type").UAObjectType,
    UAVariableType: require("./src/ua_variable_type").UAVariableType,
    UAMethod: require("./src/ua_method").UAMethod,
    Reference: require("./src/reference").Reference,

    ReferenceType:require("./src/referenceType").ReferenceType,

    UADataType: require("./src/ua_data_type").UADataType,

    UAStateMachine: require("./src/state_machine/finite_state_machine").UAStateMachine,

    // alarms & conditions
    ConditionInfo: require("./src/alarms_and_conditions/condition").ConditionInfo,
    ConditionSnapshot: require("./src/alarms_and_conditions/condition").ConditionSnapshot,

    UAConditionBase:                require("./src/alarms_and_conditions/condition").UAConditionBase,
    UAAcknowledgeableConditionBase: require("./src/alarms_and_conditions/acknowledgeable_condition").UAAcknowledgeableConditionBase,    
    UALimitAlarm:                   require("./src/alarms_and_conditions/limit_alarm").UALimitAlarm,
    UANonExclusiveLimitAlarm:       require("./src/alarms_and_conditions/non_exclusive_limit_alarm").UANonExclusiveLimitAlarm,
    UAExclusiveLimitAlarm:          require("./src/alarms_and_conditions/exclusive_limit_alarm").UAExclusiveLimitAlarm,
    UADiscreteAlarm:                require("./src/alarms_and_conditions/discrete_alarm").UADiscreteAlarm,
    
 
    checkSelectClauses: require("./src/check_event_clause").checkSelectClauses,
    checkSelectClause: require("./src/check_event_clause").checkSelectClause,

    getMethodDeclaration_ArgumentList: require("./src/argument_list").getMethodDeclaration_ArgumentList,
    Argument: require("./src/argument_list").Argument,
    binaryStoreSize_ArgumentList: require("./src/argument_list").binaryStoreSize_ArgumentList,
    build_retrieveInputArgumentsDefinition: require("./src/argument_list").build_retrieveInputArgumentsDefinition,
    verifyArguments_ArgumentList: require("./src/argument_list").verifyArguments_ArgumentList,

    bindExtObjArrayNode: require("./src/extension_object_array_node").bindExtObjArrayNode,
    addElement: require("./src/extension_object_array_node").addElement,
    removeElement: require("./src/extension_object_array_node").removeElement,
    EventData: require("./src/address_space_add_event_type").EventData,

    View: require("./src/view").View,

    generate_address_space: require("./src/loader/load_nodeset2").generate_address_space

};
