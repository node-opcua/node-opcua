/**
 * @module node-opcua-address-space
 */

export * from "node-opcua-address-space-base";
export * from "node-opcua-nodeset-ua";
// ---------------------------------------------------------------------------------------
// Implementation, exported only so that it keeps being exported.
//
// These reached consumers through the old `main`, and are kept and marked internal so the
// run-time surface does not change: the documentation excludes them, and they go at 3.0.
//
// This block started at 52 names. The ones with real use are now published above with the
// rest of the API - scanning downstream code found `promoteToStateMachine` in five separate
// projects and a dozen more names in others, so dropping the block wholesale, as first
// planned, would have broken working code to tidy a list.
//
// What is left is the *Impl classes and the underscore helpers. Nothing new belongs here.
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
} from "../impl/alarms_and_conditions/index.js";
export { instantiateCertificateExpirationAlarm } from "../impl/alarms_and_conditions/ua_certificate_expiration_alarm_impl.js";
/** The event name a node emits when one of its attributes changes. */
export { childAccessorNamesShadowedBy, makeAttributeEventName } from "../impl/base_node_impl.js";
/** @internal */
export { add_dataItem_stuff } from "../impl/data_access/add_dataItem_stuff.js";
/** @internal */
export { adjustDataValueStatusCode } from "../impl/data_access/adjust_datavalue_status_code.js";
/** @see promoteToStateMachine */
/** @internal */
export {
    _addMultiStateDiscrete,
    promoteToMultiStateDiscrete,
    UAMultiStateDiscreteImpl,
    UAMultiStateDiscreteImplBase
} from "../impl/data_access/ua_multistate_discrete_impl.js";
/** @see promoteToStateMachine */
// validateDataType is deprecated
/** @internal */
export {
    _addMultiStateValueDiscrete,
    promoteToMultiStateValueDiscrete,
    UAMultiStateValueDiscreteImpl,
    UAMultiStateValueDiscreteImplBase,
    validateDataType,
    validateIsNumericDataType
} from "../impl/data_access/ua_multistate_value_discrete_impl.js";
/** @see promoteToStateMachine */
/** @internal */
export {
    _addTwoStateDiscrete,
    promoteToTwoStateDiscrete,
    UATwoStateDiscreteImpl,
    UATwoStateDiscreteImplBase
} from "../impl/data_access/ua_two_state_discrete_impl.js";
export * from "../impl/event_data.js";
/** Building and maintaining a variable whose value is an array of extension objects. */
export { addElement, bindExtObjArrayNode, createExtObjArrayNode, removeElement } from "../impl/extension_object_array_node.js";
/** The default historian, installed through {@link AddressSpace.historizerFactory}. */
export { VariableHistorian } from "../impl/historical_access/address_space_historical_data_node.js";
/** @internal */
export { isNonEmptyQualifiedName, NamespaceImpl } from "../impl/namespace_impl.js";
/** How node ids are assigned within a namespace. */
export { ConstructNodeIdOptions, NamespaceOptions, NodeIdManager } from "../impl/nodeid_manager.js";
/** Rewrites the server's namespace array to match the namespaces actually loaded. */
export { adjustNamespaceArray } from "../impl/nodeset_tools/adjust_namespace_array.js";
export * from "../impl/nodeset_tools/construct_namespace_dependency.js";
/** A namespace's data types as an OPC binary schema (BSD) document. */
export { dumpToBSD } from "../impl/nodeset_tools/dump_to_bsd.js";
export {
    type NamespaceToImageOptions,
    NodesetExportError,
    namespaceToImage,
    namespaceToRecords,
    type ToNodesetRecordsOptions
} from "../impl/nodeset_tools/nodeset_to_records.js";
/** @internal */
export { sortByBrowseName } from "../impl/nodeset_tools/nodeset_to_xml.js";
export * from "../impl/private_namespace.js";
/** Following a reference to the node, or the reference type, it points at. */
export { resolveReferenceNode, resolveReferenceType } from "../impl/reference_impl.js";
/**
 * Upgrading a node to the typed view of what it already is.
 *
 * Loading a nodeset gives plain nodes; promoting one returns the same node seen through the
 * interface for its type, with the helpers that go with it.
 */
export { promoteToStateMachine, promoteToStateMachineType } from "../impl/state_machine/finite_state_machine.js";
export { validateDataTypeCorrectness } from "../impl/validate_data_type_correctness.js";
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
export {
    imageLinesToRecords,
    imageNodesetRecords,
    inflatedImageLines,
    isNodesetImage,
    NodesetImageError,
    type NodesetImageHeader,
    type NodesetImageTrailer,
    NodesetImageWriter,
    type NodesetImageWriterOptions,
    nodesetImageProblem,
    type ReadNodesetImageOptions,
    readNodesetImageInfo,
    setImageInflater
} from "./loader/nodeset_image.js";
export { decodeValue, encodeValue, type JsonNodeId, type JsonQualifiedName, type JsonValue } from "./loader/nodeset_image_codec.js";
export {
    MemoryNodesetImageStore,
    type NodesetImageStore,
    nodesetImageKey,
    sharedMemoryNodesetImageStore
} from "./loader/nodeset_image_store.js";
export {
    NODESET_RECORD_SCHEMA,
    type NodesetDataTypeDefinitionRecord,
    type NodesetDefinitionField,
    type NodesetHeaderRecord,
    type NodesetModelRecord,
    type NodesetNodeRecord,
    type NodesetRecord,
    type NodesetRecordConsumer,
    type NodesetRecordProducer,
    type NodesetReferenceRecord,
    type NodesetRolePermissionRecord,
    recordBytes,
    XmlExtensionObjectFragment
} from "./loader/nodeset_record.js";
export type { NamedNodesetSource, NodesetChunk, NodesetChunkStream, NodesetSource } from "./loader/nodeset_source.js";
export { sha256Hex } from "./loader/nodeset_source.js";
export * from "./loader/nodeset_source_helpers.js";
export { type NodesetToImageOptions, nodesetToImage } from "./loader/nodeset_to_image.js";
export { makeXmlNodesetRecordReader, type XmlNodesetRecordReader, xmlNodesetRecords } from "./loader/nodeset_xml_producer.js";
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
