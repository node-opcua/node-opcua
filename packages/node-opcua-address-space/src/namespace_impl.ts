/**
 * @module node-opcua-address-space
 */
// tslint:disable:no-console
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import { coerceInt64 } from "node-opcua-basic-types";
import { AxisScaleEnumeration } from "node-opcua-data-access";
import { AccessRestrictionsFlag, coerceLocalizedText, QualifiedNameLike } from "node-opcua-data-model";
import { QualifiedName } from "node-opcua-data-model";
import { BrowseDirection } from "node-opcua-data-model";
import { LocalizedText, NodeClass } from "node-opcua-data-model";
import { dumpIf, make_errorLog } from "node-opcua-debug";
import { NodeIdLike, NodeIdType, resolveNodeId } from "node-opcua-nodeid";
import { NodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import {
    Argument,
    ArgumentOptions,
    AxisInformation,
    EnumDefinition,
    EnumField,
    EnumValueType,
    EUInformation,
    Range,
    RolePermissionType,
    RolePermissionTypeOptions
} from "node-opcua-types";
import * as utils from "node-opcua-utils";
import { DataType, Variant, VariantArrayType, verifyRankAndDimensions } from "node-opcua-variant";
import {
    AddBaseNodeOptions,
    AddEnumerationTypeOptions,
    AddMethodOptions,
    AddObjectOptions,
    AddObjectTypeOptions,
    AddReferenceOpts,
    AddReferenceTypeOptions,
    AddVariableOptions,
    AddVariableTypeOptions,
    AddViewOptions,
    AddYArrayItemOptions,
    BaseNode,
    CreateDataTypeOptions,
    CreateNodeOptions,
    EnumerationItem,
    INamespace,
    UADataType,
    UAEventType,
    UAMethod,
    UAObject,
    UAObjectType,
    UAReference,
    UAReferenceType,
    UAVariable,
    UAVariableType,
    UAView
} from "node-opcua-address-space-base";
import { UAAnalogItem, UADataItem, UAInitialState, UAState, UAYArrayItem } from "node-opcua-nodeset-ua";

import {
    AddMultiStateDiscreteOptions,
    AddMultiStateValueDiscreteOptions,
    AddTwoStateDiscreteOptions,
    AddTwoStateVariableOptions
} from "../source/address_space_ts";
import { UAStateMachineEx } from "../source/interfaces/state_machine/ua_state_machine_type";
import { UATransitionEx } from "../source/interfaces/state_machine/ua_transition_ex";
import { UATwoStateDiscreteEx, UAYArrayItemEx } from "../source";
import { AddAnalogDataItemOptions, AddDataItemOptions } from "../source/namespace_data_access";
import { UATwoStateVariableEx } from "../source/ua_two_state_variable_ex";
import { UAMultiStateValueDiscreteEx } from "../source/interfaces/data_access/ua_multistate_value_discrete_ex";
import { UAAlarmConditionEx } from "../source/interfaces/alarms_and_conditions/ua_alarm_condition_ex";
import { UADiscreteAlarmEx } from "../source/interfaces/alarms_and_conditions/ua_discrete_alarm_ex";
import { UAExclusiveDeviationAlarmEx } from "../source/interfaces/alarms_and_conditions/ua_exclusive_deviation_alarm_ex";
import { UAExclusiveLimitAlarmEx } from "../source/interfaces/alarms_and_conditions/ua_exclusive_limit_alarm_ex";
import { UALimitAlarmEx } from "../source/interfaces/alarms_and_conditions/ua_limit_alarm_ex";
import { UANonExclusiveDeviationAlarmEx } from "../source/interfaces/alarms_and_conditions/ua_non_exclusive_deviation_alarm_ex";
import { UANonExclusiveLimitAlarmEx } from "../source/interfaces/alarms_and_conditions/ua_non_exclusive_limit_alarm_ex";
import { UAConditionEx } from "../source/interfaces/alarms_and_conditions/ua_condition_ex";

import { _handle_delete_node_model_change_event, _handle_model_change_event } from "./address_space_change_event_tools";
import { AddressSpacePrivate } from "./address_space_private";
import { UAConditionImpl } from "./alarms_and_conditions/ua_condition_impl";
import { UADiscreteAlarmImpl } from "./alarms_and_conditions/ua_discrete_alarm_impl";
import {
    UAExclusiveDeviationAlarmImpl
} from "./alarms_and_conditions/ua_exclusive_deviation_alarm_impl";
import {  UAExclusiveLimitAlarmImpl } from "./alarms_and_conditions/ua_exclusive_limit_alarm_impl";
import {  UALimitAlarmImpl } from "./alarms_and_conditions/ua_limit_alarm_impl";
import {
    UANonExclusiveDeviationAlarmImpl
} from "./alarms_and_conditions/ua_non_exclusive_deviation_alarm_impl";
import {
    UANonExclusiveLimitAlarmImpl
} from "./alarms_and_conditions/ua_non_exclusive_limit_alarm_impl";
import { UAAcknowledgeableConditionImpl, UAAlarmConditionImpl } from "./alarms_and_conditions";
import { UAOffNormalAlarmEx, UAOffNormalAlarmImpl } from "./alarms_and_conditions/ua_off_normal_alarm_impl";
import { add_dataItem_stuff } from "./data_access/add_dataItem_stuff";
import { UAMultiStateDiscreteImpl, _addMultiStateDiscrete } from "./data_access/ua_multistate_discrete_impl";
// state machine
import { _install_TwoStateVariable_machinery, _addTwoStateVariable } from "./state_machine/ua_two_state_variable";

//
import { NamespacePrivate, UANamespace_process_modelling_rule } from "./namespace_private";
import { BaseNodeImpl } from "./base_node_impl";
import { UAVariableImpl } from "./ua_variable_impl";

import { ConstructNodeIdOptions, NodeIdManager } from "./nodeid_manager";
import { _addTwoStateDiscrete } from "./data_access/ua_two_state_discrete_impl";
import { coerceRolePermissions } from "./role_permissions";
import { UAObjectImpl } from "./ua_object_impl";
import { UADataTypeImpl } from "./ua_data_type_impl";
import { UAObjectTypeImpl } from "./ua_object_type_impl";
import { UAMethodImpl } from "./ua_method_impl";
import { UAVariableTypeImpl } from "./ua_variable_type_impl";
import { UAReferenceTypeImpl } from "./ua_reference_type_impl";
import { UAViewImpl } from "./ua_view_impl";
import { UAStateMachineImpl, UATransitionImpl } from "./state_machine/finite_state_machine";
import { _addMultiStateValueDiscrete } from "./data_access/ua_multistate_value_discrete_impl";

function _makeHashKey(nodeId: NodeId): string | number {
    switch (nodeId.identifierType) {
        case NodeIdType.STRING:
        case NodeIdType.GUID:
            return nodeId.value as string;
        case NodeIdType.NUMERIC:
            return nodeId.value as number;
        default:
            // istanbul ignore next
            if (nodeId.identifierType !== NodeIdType.BYTESTRING) {
                throw new Error("invalid nodeIdType");
            }
            return nodeId.value ? nodeId.value.toString() : "OPAQUE:0";
    }
}
const doDebug = false;
const errorLog = make_errorLog("AddressSpace");

const regExp1 = /^(s|i|b|g)=/;
const regExpNamespaceDotBrowseName = /^[0-9]+:(.*)/;

export interface AddFolderOptions {
    browseName: QualifiedNameLike;
}

interface AddVariableOptions2 extends AddVariableOptions {
    nodeClass?: NodeClass.Variable;
}

function detachNode(node: BaseNode) {
    const addressSpace = node.addressSpace;
    const nonHierarchicalReferences = node.findReferencesEx("NonHierarchicalReferences", BrowseDirection.Inverse);
    for (const ref of nonHierarchicalReferences) {
        assert(!ref.isForward);
        ref.node!.removeReference({
            isForward: !ref.isForward,
            nodeId: node.nodeId,
            referenceType: ref.referenceType
        });
    }
    const nonHierarchicalReferencesF = node.findReferencesEx("NonHierarchicalReferences", BrowseDirection.Forward);
    for (const ref of nonHierarchicalReferencesF) {
        if (!ref.node) {
            // could be a special case of a frequently use target node such as ModellingRule_Mandatory that do not back trace
            // their reference
            continue;
        }
        assert(ref.isForward);
        ref.node!.removeReference({
            isForward: !ref.isForward,
            nodeId: node.nodeId,
            referenceType: ref.referenceType
        });
    }

    // remove reversed Hierarchical references
    const hierarchicalReferences = node.findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse);
    for (const ref of hierarchicalReferences) {
        assert(!ref.isForward);
        const parent = addressSpace.findNode(ref.nodeId)! as BaseNode;
        parent.removeReference({
            isForward: !ref.isForward,
            nodeId: node.nodeId,
            referenceType: ref.referenceType
        });
    }
    (<BaseNodeImpl>node).unpropagate_back_references();
}

interface NamespaceConstructorOptions {
    addressSpace: AddressSpacePrivate;
    index: number;
    namespaceUri: string;
    publicationDate: Date;
    version: string;
}
/**
 *
 * @constructor
 * @params options {Object}
 * @params options.namespaceUri {string}
 * @params options.addressSpace {IAddressSpace}
 * @params options.index {number}
 * @params options.version="" {string}
 * @params options.publicationDate="" {Date}
 *
 */
export class NamespaceImpl implements NamespacePrivate {
    public static _handle_hierarchy_parent = _handle_hierarchy_parent;
    public static isNonEmptyQualifiedName = isNonEmptyQualifiedName;

    public readonly namespaceUri: string;
    public addressSpace: AddressSpacePrivate;
    public readonly index: number;

    public version = "0.0.0";
    public publicationDate: Date = new Date(Date.UTC(1900, 0, 1));

    private _objectTypeMap: Map<string, UAObjectType>;
    private _variableTypeMap: Map<string, UAVariableType>;
    private _referenceTypeMap: Map<string, UAReferenceType>;
    private _dataTypeMap: Map<string, UADataType>;
    private _referenceTypeMapInv: Map<string, UAReferenceType>;
    private _nodeIdManager: NodeIdManager;
    private _nodeid_index: Map<string | number, BaseNode>;
    private _aliases: Map<string, NodeId>;
    private defaultAccessRestrictions?: AccessRestrictionsFlag;
    private defaultRolePermissions?: RolePermissionType[];

    constructor(options: NamespaceConstructorOptions) {
        // istanbul ignore next
        if (!(typeof options.namespaceUri === "string")) {
            throw new Error("NamespaceImpl constructor: namespaceUri must exists and be a string : got " + options.namespaceUri);
        }
        // istanbul ignore next
        if (typeof options.index !== "number") {
            throw new Error("NamespaceImpl constructor: index must be a number");
        }
        // istanbul ignore next
        if (!options.addressSpace) {
            throw new Error("NamespaceImpl constructor: Must specify a valid address space");
        }

        this.namespaceUri = options.namespaceUri;
        this.addressSpace = options.addressSpace;

        this.index = options.index;
        this._nodeid_index = new Map();
        this._aliases = new Map();
        this._objectTypeMap = new Map();
        this._variableTypeMap = new Map();
        this._referenceTypeMap = new Map();
        this._referenceTypeMapInv = new Map();
        this._dataTypeMap = new Map();
        this._nodeIdManager = new NodeIdManager(this.index, this.addressSpace);
    }

    public getDefaultNamespace(): NamespacePrivate {
        return this.index === 0 ? this : this.addressSpace.getDefaultNamespace();
    }

    public dispose(): void {
        for (const node of this.nodeIterator()) {
            (<BaseNodeImpl>node).dispose();
        }

        this._nodeid_index = new Map();
        this._aliases = new Map();

        this.addressSpace = {} as AddressSpacePrivate;

        this._objectTypeMap = new Map();
        this._variableTypeMap = new Map();
        this._referenceTypeMap = new Map();
        this._referenceTypeMapInv = new Map();
        this._dataTypeMap = new Map();
    }

    public nodeIterator(): IterableIterator<BaseNode> {
        return this._nodeid_index.values();
    }

    public _objectTypeIterator(): IterableIterator<UAObjectType> {
        return this._objectTypeMap.values();
    }
    public _objectTypeCount(): number {
        return this._objectTypeMap.size;
    }
    public _variableTypeIterator(): IterableIterator<UAVariableType> {
        return this._variableTypeMap.values();
    }
    public _variableTypeCount(): number {
        return this._variableTypeMap.size;
    }
    public _dataTypeIterator(): IterableIterator<UADataType> {
        return this._dataTypeMap.values();
    }
    public _dataTypeCount(): number {
        return this._dataTypeMap.size;
    }
    public _referenceTypeIterator(): IterableIterator<UAReferenceType> {
        return this._referenceTypeMap.values();
    }
    public _referenceTypeCount(): number {
        return this._referenceTypeMap.size;
    }
    public _aliasCount(): number {
        return this._aliases.size;
    }

    public findNode2(nodeId: NodeId): BaseNode | null {
        // this one is faster assuming you have a nodeId
        assert(nodeId.namespace === this.index);
        return this._nodeid_index.get(_makeHashKey(nodeId)) || null;
    }
    public findNode(nodeId: string | NodeId): BaseNode | null {
        if (typeof nodeId === "string") {
            if (nodeId.match(regExp1)) {
                nodeId = "ns=" + this.index + ";" + nodeId;
            }
        }
        nodeId = resolveNodeId(nodeId);
        return this.findNode2(nodeId);
    }

    /**
     *
     * @param objectTypeName {String}
     * @return {UAObjectType|null}
     */
    public findObjectType(objectTypeName: string): UAObjectType | null {
        return this._objectTypeMap.get(objectTypeName) || null;
    }

    /**
     *
     * @param variableTypeName {String}
     * @returns {UAVariableType|null}
     */
    public findVariableType(variableTypeName: string): UAVariableType | null {
        return this._variableTypeMap.get(variableTypeName) || null;
    }
    /**
     *
     * @param dataTypeName {String}
     * @returns {UADataType|null}
     */
    public findDataType(dataTypeName: string): UADataType | null {
        return this._dataTypeMap.get(dataTypeName) || null;
    }

    /**
     *
     * @param referenceTypeName {String}
     * @returns  {ReferenceType|null}
     */
    public findReferenceType(referenceTypeName: string): UAReferenceType | null {
        return this._referenceTypeMap.get(referenceTypeName) || null;
    }

    /**
     * find a ReferenceType by its inverse name.
     * @method findReferenceTypeFromInverseName
     * @param inverseName {String} the inverse name of the ReferenceType to find
     * @return {ReferenceType}
     */
    public findReferenceTypeFromInverseName(inverseName: string): UAReferenceType | null {
        assert(typeof inverseName === "string");
        const node = this._referenceTypeMapInv.get(inverseName);
        assert(!node || (node.nodeClass === NodeClass.ReferenceType && node.inverseName.text === inverseName));
        return node ? node : null;
    }

    /**
     *
     * @method addAlias
     * @param alias_name {String} the alias name
     * @param nodeId {NodeId} NodeId must belong to this namespace
     */
    public addAlias(alias_name: string, nodeId: NodeId): void {
        assert(typeof alias_name === "string");
        assert(nodeId instanceof NodeId);
        assert(nodeId.namespace === this.index);
        this._aliases.set(alias_name, nodeId);
    }

    public resolveAlias(name: string): NodeId | null {
        return this._aliases.get(name) || null;
    }

    /**
     * add a new Object type to the address space
     * @method addObjectType
     * @param options
     * @param options.browseName {String} the object type name
     * @param [options.displayName] {String|LocalizedText} the display name
     * @param [options.subtypeOf="BaseObjectType"] {String|NodeId|BaseNode} the base class
     * @param [options.nodeId] {String|NodeId} an optional nodeId for this objectType,
     *                                         if not provided a new nodeId will be created
     * @param [options.isAbstract = false] {Boolean}
     * @param [options.eventNotifier = 0] {Integer}
     * @param [options.postInstantiateFunc = null] {Function}
     *
     */
    public addObjectType(options: AddObjectTypeOptions): UAObjectType {
        assert(!Object.prototype.hasOwnProperty.call(options, "dataType"), "an objectType should not have a dataType");
        assert(!Object.prototype.hasOwnProperty.call(options, "valueRank"), "an objectType should not have a valueRank");
        assert(
            !Object.prototype.hasOwnProperty.call(options, "arrayDimensions"),
            "an objectType should not have a arrayDimensions"
        );
        return this._addObjectOrVariableType(options, "BaseObjectType", NodeClass.ObjectType) as UAObjectType;
    }

    /**
     * add a new Variable type to the address space
     * @method addVariableType
     * @param options
     * @param options.browseName {String} the object type name
     * @param [options.displayName] {String|LocalizedText} the display name
     * @param [options.subtypeOf="BaseVariableType"] {String|NodeId|BaseNode} the base class
     * @param [options.nodeId] {String|NodeId} an optional nodeId for this objectType,
     *                                             if not provided a new nodeId will be created
     * @param [options.isAbstract = false] {Boolean}
     * @param options.dataType {String|NodeId} the variable DataType
     * @param [options.valueRank = -1]
     * @param [options.arrayDimensions = null] { Array<Int>>
     *
     */
    public addVariableType(options: AddVariableTypeOptions): UAVariableType {
        assert(!Object.prototype.hasOwnProperty.call(options, "arrayDimension"), "Do you mean ArrayDimensions ?");

        // dataType
        options.dataType = options.dataType || "Int32";
        options.dataType = this.addressSpace._coerce_DataType(options.dataType);

        // valueRank/ arrayDimensions
        verifyRankAndDimensions(options);

        // arrayDimensions
        const variableType = this._addObjectOrVariableType(options, "BaseVariableType", NodeClass.VariableType) as UAVariableType;

        variableType.dataType = options.dataType;
        variableType.valueRank = options.valueRank || 0;
        variableType.arrayDimensions = options.arrayDimensions!;

        return variableType as UAVariableType;
    }

    /**
     * add a variable as a component of the parent node
     *
     * @method addVariable
     * @param options
     * @param options.browseName       the variable name
     * @param options.dataType        the variable datatype ( "Double", "UInt8" etc...)
     * @param [options.typeDefinition="BaseDataVariableType"]
     * @param [options.modellingRule=null] the Modelling rule : "Optional" , "Mandatory"
     * @param [options.valueRank= -1]    the valueRank
     * @param [options.arrayDimensions]
     * @return UAVariable
     */
    public addVariable(options: AddVariableOptions): UAVariable {
        assert(arguments.length === 1, "Invalid arguments IAddressSpace#addVariable now takes only one argument.");
        if (Object.prototype.hasOwnProperty.call(options, "propertyOf") && options.propertyOf) {
            assert(!options.typeDefinition || options.typeDefinition === "PropertyType");
            options.typeDefinition = options.typeDefinition || "PropertyType";
        } else {
            assert(!options.typeDefinition || options.typeDefinition !== "PropertyType");
        }
        return this._addVariable(options as AddVariableOptions2);
    }

    public addView(options: AddViewOptions): UAView {
        assert(arguments.length === 1, "Namespace#addView expecting a single argument");
        assert(options);
        assert(Object.prototype.hasOwnProperty.call(options, "browseName"));
        assert(Object.prototype.hasOwnProperty.call(options, "organizedBy"));
        const browseName = options.browseName;
        assert(typeof browseName === "string");

        const addressSpace = this.addressSpace;
        const baseDataVariableTypeId = addressSpace.findVariableType("BaseDataVariableType")!.nodeId;

        // ------------------------------------------ TypeDefinition
        const typeDefinition = options.typeDefinition || baseDataVariableTypeId;
        options.references = options.references || [];

        options.references.push({
            isForward: true,
            nodeId: typeDefinition,
            referenceType: "HasTypeDefinition"
        });

        // xx assert(this.FolderTypeId && this.BaseObjectTypeId); // is default address space generated.?

        const createOptions = options as CreateNodeOptions;
        assert(!createOptions.nodeClass);
        createOptions.nodeClass = NodeClass.View;

        const view = this.createNode(createOptions)! as UAView;
        assert(view.nodeId instanceof NodeId);
        assert(view.nodeClass === NodeClass.View);
        return view;
    }

    public addObject(options1: AddObjectOptions): UAObject {
        const options: CreateNodeOptions = options1 as CreateNodeOptions;

        assert(!options.nodeClass || options.nodeClass === NodeClass.Object);
        options.nodeClass = NodeClass.Object;

        const typeDefinition = options.typeDefinition || "BaseObjectType";
        options.references = options.references || [];
        options.references.push({ referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition });
        options.eventNotifier = +options.eventNotifier;
        const obj = this.createNode(options) as UAObject;
        assert(obj instanceof UAObjectImpl);
        assert(obj.nodeClass === NodeClass.Object);
        return obj;
    }

    /**
     *
     * @method addFolder
     * @param parentFolder
     * @param options {String|Object}
     * @param options.browseName {String} the name of the folder
     * @param [options.nodeId] {NodeId}. An optional nodeId for this object
     *
     * @return {BaseNode}
     */
    public addFolder(parentFolder: UAObject, options: AddFolderOptions | string): UAObject {
        if (typeof options === "string") {
            options = { browseName: options };
        }

        const addressSpace = this.addressSpace;

        assert(!(options as any).typeDefinition, "addFolder does not expect typeDefinition to be defined ");
        const typeDefinition = addressSpace._coerceTypeDefinition("FolderType");
        parentFolder = addressSpace._coerceFolder(parentFolder)! as UAObject;
        (options as any).nodeClass = NodeClass.Object;
        (options as any).references = [
            { referenceType: "HasTypeDefinition", isForward: true, nodeId: typeDefinition },
            { referenceType: "Organizes", isForward: false, nodeId: parentFolder.nodeId }
        ];
        const node = this.createNode(options) as UAObject;
        return node;
    }

    /**
     * @method addReferenceType
     * @param options
     * @param options.isAbstract
     * @param options.browseName
     * @param options.inverseName
     */
    public addReferenceType(options: AddReferenceTypeOptions): UAReferenceType {
        const addressSpace = this.addressSpace;

        const options1 = options as any;
        options1.nodeClass = NodeClass.ReferenceType;
        options1.references = options1.references || [];

        if (options.subtypeOf) {
            const subtypeOfNodeId = addressSpace._coerceType(options.subtypeOf, "References", NodeClass.ReferenceType);

            assert(subtypeOfNodeId);

            options1.references.push({
                isForward: false,
                nodeId: subtypeOfNodeId,
                referenceType: "HasSubtype"
            });
        }
        const node = this.internalCreateNode(options1) as UAReferenceType;

        node.propagate_back_references();

        return node;
    }

    /**
     */
    public addMultiStateDiscrete<T, DT extends DataType>(options: AddMultiStateDiscreteOptions): UAMultiStateDiscreteImpl<T, DT> {
        return _addMultiStateDiscrete<T, DT>(this, options);
    }

    /**
     * @method createDataType
     */
    public createDataType(options: CreateDataTypeOptions): UADataType {
        assert(Object.prototype.hasOwnProperty.call(options, "isAbstract"), "must provide isAbstract");
        assert(!Object.prototype.hasOwnProperty.call(options, "nodeClass"));
        assert(Object.prototype.hasOwnProperty.call(options, "browseName"), "must provide a browseName");

        const options1 = options as any;
        options1.nodeClass = NodeClass.DataType;
        options1.references = options.references || [];

        if (options1.references.length === 0) {
            if (!options1.subtypeOf) {
                throw new Error("must provide a subtypeOf");
            }
        }
        if (options1.subtypeOf) {
            if (!(options1.subtypeOf instanceof UADataTypeImpl)) {
                options1.subtypeOf = this.addressSpace.findDataType(options1.subtypeOf) as UADataType;
            }
            if (!options1.subtypeOf) {
                throw new Error("cannot find subtypeOf ");
            }
            options1.references.push({
                isForward: false,
                nodeId: options1.subtypeOf.nodeId,
                referenceType: "HasSubtype"
            });
        }
        const node = this.internalCreateNode(options) as UADataType;
        return node;
    }

    /**
     * @method createNode
     * @param options
     * @param options.nodeClass
     * @param [options.nodeVersion {String} = "0" ] install nodeVersion
     * @param [options.modellingRule {String} = null]
     * @internal
     */
    public createNode(options: CreateNodeOptions): BaseNode {
        let node: BaseNode = null as any as BaseNode;

        const addressSpace = this.addressSpace;
        addressSpace.modelChangeTransaction(() => {
            assert(isNonEmptyQualifiedName(options.browseName));
            // xx assert(Object.prototype.hasOwnProperty.call(options,"browseName") && options.browseName.length > 0);

            assert(Object.prototype.hasOwnProperty.call(options, "nodeClass"));
            options.references = addressSpace.normalizeReferenceTypes(options.references);

            const references = _copy_references(options.references);

            _handle_hierarchy_parent(addressSpace, references, options);

            _handle_event_hierarchy_parent(addressSpace, references, options);

            UANamespace_process_modelling_rule(references, options.modellingRule);

            options.references = references;

            node = this.internalCreateNode(options);
            assert(node.nodeId instanceof NodeId);

            node.propagate_back_references();

            node.install_extra_properties();

            _handle_node_version(node, options);

            _handle_model_change_event(node as BaseNodeImpl);
        });
        return node;
    }

    /**
     * remove the specified Node from the address space
     *
     * @method deleteNode
     * @param  nodeOrNodeId
     *
     *
     */
    public deleteNode(nodeOrNodeId: NodeId | BaseNode): void {
        let node: BaseNode | null = null;
        let nodeId: NodeId = new NodeId();
        if (nodeOrNodeId instanceof NodeId) {
            nodeId = nodeOrNodeId;
            node = this.findNode(nodeId);
            // istanbul ignore next
            if (!node) {
                throw new Error(" deleteNode : cannot find node with nodeId" + nodeId.toString());
            }
        } else if (nodeOrNodeId instanceof BaseNodeImpl) {
            node = nodeOrNodeId;
            nodeId = node.nodeId;
        }
        // istanbul ignore next
        if (nodeId.namespace !== this.index) {
            throw new Error("this node doesn't belong to this namespace");
        }

        const addressSpace = this.addressSpace;

        addressSpace.modelChangeTransaction(() => {
            /* istanbul ignore next */
            if (!node) {
                throw new Error("this node doesn't belong to this namespace");
            }
            // notify parent that node is being removed
            const hierarchicalReferences = node.findReferencesEx("HierarchicalReferences", BrowseDirection.Inverse);
            for (const ref of hierarchicalReferences) {
                assert(!ref.isForward);
                const parent = addressSpace.findNode(ref.nodeId)! as BaseNodeImpl;
                assert(parent);
                parent._on_child_removed(node);
            }

            function deleteNodePointedByReference(ref: { nodeId: NodeId }) {
                const o = addressSpace.findNode(ref.nodeId)! as BaseNode;
                addressSpace.deleteNode(o.nodeId);
            }

            // recursively delete all nodes below in the hierarchy of nodes
            // TODO : a better idea would be to extract any references of type "HasChild"
            const components = node.findReferencesEx("HasComponent", BrowseDirection.Forward);
            const properties = node.findReferencesEx("HasProperty", BrowseDirection.Forward);
            // TODO: shall we delete nodes pointed by "Organizes" links here ?
            const subFolders = node.findReferencesEx("Organizes", BrowseDirection.Forward);

            for (const r of components) {
                deleteNodePointedByReference(r);
            }
            for (const r of properties) {
                deleteNodePointedByReference(r);
            }
            for (const r of subFolders) {
                deleteNodePointedByReference(r);
            }

            _handle_delete_node_model_change_event(node);

            detachNode(node);

            // delete nodes from global index
            const namespace = addressSpace.getNamespace(node.nodeId.namespace);
            namespace._deleteNode(node);
        });
    }

    /**
     * @internals
     */
    public getStandardsNodeIds(): { referenceTypeIds: { [key: string]: string }; objectTypeIds: { [key: string]: string } } {
        const standardNodeIds = {
            objectTypeIds: {} as { [key: string]: string },
            referenceTypeIds: {} as { [key: string]: string }
        };

        for (const referenceType of this._referenceTypeMap.values()) {
            standardNodeIds.referenceTypeIds[referenceType!.browseName!.name!] = referenceType.nodeId.toString();
        }
        for (const objectType of this._objectTypeMap.values()) {
            standardNodeIds.objectTypeIds[objectType!.browseName!.name!] = objectType.nodeId.toString();
        }
        return standardNodeIds;
    }

    // - Events --------------------------------------------------------------------------------------
    /**
     * add a new event type to the address space
     * @method addEventType
     * @param options
     * @param options.browseName {String} the eventType name
     * @param [options.subtypeOf ="BaseEventType"]
     * @param [options.isAbstract = true]
     * @return {UAObjectType} : the object type
     *
     * @example
     *
     *      var evtType = namespace.addEventType({
     *          browseName: "MyAuditEventType",
     *          subtypeOf:  "AuditEventType"
     *      });
     *      var myConditionType = namespace.addEventType({
     *          browseName: "MyConditionType",
     *          subtypeOf:  "ConditionType",
     *          isAbstract: false
     *      });
     *
     */
    public addEventType(options: any): UAObjectType {
        options.subtypeOf = options.subtypeOf || "BaseEventType";
        // are eventType always abstract ?? No => Condition can be instantiated!
        // but, by default is abstract is true
        options.isAbstract = Object.prototype.hasOwnProperty.call(options, "isAbstract") ? !!options.isAbstract : true;
        return this.addObjectType(options);
    }

    // ---------------------------------------------------------------------------------------------------
    /**
     * @method addDataItem
     * @param options
     * @param options.browseName {String}
     * @param options.definition {String}
     * @param [options.valuePrecision {Double |null} =null]
     * @param options.dataType {NodeId} // todo :check
     * @param options.value
     * @param options.componentOf
     * @return {UAVariable}
     */
    public addDataItem<T, DT extends DataType>(options: AddDataItemOptions): UADataItem<T, DT> {
        const addressSpace = this.addressSpace;
        const dataType = options.dataType || "Number";

        const dataItemType = addressSpace.findVariableType("DataItemType");
        if (!dataItemType) {
            throw new Error("Cannot find DataItemType");
        }
        const variable = this.addVariable({
            ...options,
            dataType,
            typeDefinition: dataItemType.nodeId
        });

        add_dataItem_stuff(variable, options);

        variable.install_extra_properties();
        return variable as UADataItem<T, DT>;
    }

    /**
     *
     * @method addAnalogDataItem
     *
     * AnalogDataItem DataItems that represent continuously-variable physical quantities ( e.g., length, temperature),
     * in contrast to the digital representation of data in discrete  items
     * NOTE Typical examples are the values provided by temperature sensors or pressure sensors. OPC UA defines a
     * specific UAVariableType to identify an AnalogItem. Properties describe the possible ranges of  AnalogItems.
     *
     *
     * @example:
     *
     *
     *   namespace.add_analog_dataItem({
     *      componentOf: parentObject,
     *      browseName: "TemperatureSensor",
     *
     *      definition: "(tempA -25) + tempB",
     *      valuePrecision: 0.5,
     *      //-
     *      instrumentRange: { low: 100 , high: 200}, // optional
     *      engineeringUnitsRange: { low: 100 , high: 200}, // mandatory
     *      engineeringUnits: standardUnits.degree_celsius,, // optional
     *
     *      // access level
     *      accessLevel: 1
     *      minimumSamplingInterval: 10,
     *
     *   });
     *
  
     * @return {UAVariable}
     */
    public addAnalogDataItem<T, DT extends DataType>(options: AddAnalogDataItemOptions): UAAnalogItem<T, DT> {
        const addressSpace = this.addressSpace;

        assert(Object.prototype.hasOwnProperty.call(options, "engineeringUnitsRange"), "expecting engineeringUnitsRange");

        const dataType = options.dataType || "Number";

        const analogItemType = addressSpace.findVariableType("AnalogItemType");

        if (!analogItemType) {
            throw new Error("expecting AnalogItemType to be defined , check nodeset xml file");
        }

        const clone_options = { ...options, dataType, typeDefinition: analogItemType.nodeId } as AddVariableOptions;

        const variable = this.addVariable(clone_options) as UAVariableImpl;

        add_dataItem_stuff(variable, options);

        // mandatory (EURange in the specs)
        // OPC Unified Architecture, Part 8  6  Release 1.02
        // EURange  defines the value range likely to be obtained in normal operation. It is intended for such
        // use as automatically scaling a bar graph display
        // Sensor or instrument failure or deactivation can result in a return ed item value which is actually
        // outside  of  this range. Client software must be prepared to deal with this   possibility. Similarly a client
        // may attempt to write a value that is outside  of  this range back to the server. The exact behavior
        // (accept, reject, clamp, etc.) in this case is server - dependent. However ,   in general servers  shall  be
        // prepared to handle this.
        //     Example:    EURange ::= {-200.0,1400.0}

        const euRange = this.addVariable({
            browseName: { name: "EURange", namespaceIndex: 0 },
            dataType: "Range",
            minimumSamplingInterval: 0,
            modellingRule: options.modellingRule,
            propertyOf: variable,
            typeDefinition: "PropertyType",
            value: new Variant({
                dataType: DataType.ExtensionObject,
                value: new Range(options.engineeringUnitsRange)
            })
        }) as UAVariableImpl;

        assert(euRange.readValue().value.value instanceof Range);

        const handler = variable.handle_semantic_changed.bind(variable);
        euRange.on("value_changed", handler);

        if (Object.prototype.hasOwnProperty.call(options, "instrumentRange")) {
            const instrumentRange = this.addVariable({
                accessLevel: "CurrentRead | CurrentWrite",
                browseName: { name: "InstrumentRange", namespaceIndex: 0 },
                dataType: "Range",
                minimumSamplingInterval: 0,
                modellingRule: options.modellingRule ? "Mandatory" : undefined,
                propertyOf: variable,
                typeDefinition: "PropertyType",
                value: new Variant({
                    dataType: DataType.ExtensionObject,
                    value: new Range(options.instrumentRange)
                })
            });

            instrumentRange.on("value_changed", handler);
        }

        if (Object.prototype.hasOwnProperty.call(options, "engineeringUnits")) {
            const engineeringUnits = new EUInformation(options.engineeringUnits);
            assert(engineeringUnits instanceof EUInformation, "expecting engineering units");

            // EngineeringUnits  specifies the units for the   DataItem‟s value (e.g., degree, hertz, seconds).   The
            // EUInformation   type is specified in   5.6.3.

            const eu = this.addVariable({
                accessLevel: "CurrentRead",
                browseName: { name: "EngineeringUnits", namespaceIndex: 0 },
                dataType: "EUInformation",
                minimumSamplingInterval: 0,
                modellingRule: options.modellingRule ? "Mandatory" : undefined,
                propertyOf: variable,
                typeDefinition: "PropertyType",
                value: new Variant({
                    dataType: DataType.ExtensionObject,
                    value: engineeringUnits
                })
            });

            eu.on("value_changed", handler);
        }

        variable.install_extra_properties();

        return variable as unknown as UAAnalogItem<T, DT>;
    }

    /**
     *
     * @method addMultiStateValueDiscrete
     * @param options {Object}
     * @param options.browseName {String}
     * @param [options.nodeId  {NodeId}]
     * @param [options.value {UInt32} = 0 }
     * @param options.enumValues { EnumValueType[]| {Key,Value} }
     * @return {Object|UAVariable}
     *
     * @example
     *
     *
     *      namespace.addMultiStateValueDiscrete({
     *          componentOf:parentObj,
     *          browseName: "myVar",
     *          enumValues: {
     *              "Red":    0xFF0000,
     *              "Green":  0x00FF00,
     *              "Blue":   0x0000FF
     *          }
     *      });
     *      addMultiStateValueDiscrete(parentObj,{
     *          browseName: "myVar",
     *          enumValues: [
     *              {
     *                 value: 0xFF0000,
     *                 displayName: "Red",
     *                 description: " The color Red"
     *              },
     *              {
     *                 value: 0x00FF000,
     *                 displayName: "Green",
     *                 description: " The color Green"
     *              },
     *              {
     *                 value: 0x0000FF,
     *                 displayName: "Blue",
     *                 description: " The color Blue"
     *              }
     *
     *          ]
     *      });
     */
    public addMultiStateValueDiscrete<T, DT extends DataType>(
        options: AddMultiStateValueDiscreteOptions
    ): UAMultiStateValueDiscreteEx<T, DT> {
        return _addMultiStateValueDiscrete<T, DT>(this, options);
    }

    // -
    /**
     *
     * @method addYArrayItem
     * @param options
     * @param options.componentOf {NodeId}
     * @param options.browseName {String}
     * @param options.title {String}
     * @param [options.instrumentRange]
     * @param [options.instrumentRange.low] {Double}
     * @param [options.instrumentRange.high] {Double}
     * @param options.engineeringUnitsRange.low {Double}
     * @param options.engineeringUnitsRange.high {Double}
     * @param options.engineeringUnits {String}
     * @param [options.nodeId = {NodeId}]
     * @param options.accessLevel
     * @param options.userAccessLevel
     * @param options.title {String}
     * @param options.axisScaleType {AxisScaleEnumeration}
     *
     * @param options.xAxisDefinition {AxisInformation}
     * @param options.xAxisDefinition.engineeringUnits  EURange
     * @param options.xAxisDefinition.range
     * @param options.xAxisDefinition.range.low
     * @param options.xAxisDefinition.range.high
     * @param options.xAxisDefinition.title  {LocalizedText}
     * @param options.xAxisDefinition.axisScaleType {AxisScaleEnumeration}
     * @param options.xAxisDefinition.axisSteps = <null>  {Array<Double>}
     * @param options.value
     */
    public addYArrayItem<DT extends DataType.Double | DataType.Float>(options: AddYArrayItemOptions): UAYArrayItemEx<DT> {
        assert(Object.prototype.hasOwnProperty.call(options, "engineeringUnitsRange"), "expecting engineeringUnitsRange");
        assert(Object.prototype.hasOwnProperty.call(options, "axisScaleType"), "expecting axisScaleType");
        assert(options.xAxisDefinition !== null && typeof options.xAxisDefinition === "object", "expecting a xAxisDefinition");

        const addressSpace = this.addressSpace;

        const YArrayItemType = addressSpace.findVariableType("YArrayItemType");
        if (!YArrayItemType) {
            throw new Error("expecting YArrayItemType to be defined , check nodeset xml file");
        }

        function toNodeId(options?: NodeIdLike | BaseNode | string | null): NodeId {
            if (!options) {
                return resolveNodeId(DataType.Float);
            }
            if (Object.prototype.hasOwnProperty.call(options, "nodeId") || options instanceof BaseNodeImpl) {
                return (options as UADataType).nodeId;
            }
            return resolveNodeId(options as NodeIdLike);
        }
        const dataType = toNodeId(options.dataType as any);
        const optionals = [];
        if (Object.prototype.hasOwnProperty.call(options, "instrumentRange")) {
            optionals.push("InstrumentRange");
        }
        const variable = YArrayItemType.instantiate({
            browseName: options.browseName,
            componentOf: options.componentOf,
            dataType,
            optionals
        }) as UAYArrayItemEx<DataType.Float | DataType.Double>;

        function coerceAxisScale(value: any) {
            const ret = AxisScaleEnumeration[value];
            assert(!utils.isNullOrUndefined(ret));
            return ret;
        }

        variable.setValueFromSource(options.value as Variant, StatusCodes.Good);

        variable.euRange.setValueFromSource(
            new Variant({
                dataType: DataType.ExtensionObject,
                value: new Range(options.engineeringUnitsRange)
            })
        );

        if (Object.prototype.hasOwnProperty.call(options, "instrumentRange") && variable.instrumentRange) {
            variable.instrumentRange.setValueFromSource(
                new Variant({
                    dataType: DataType.ExtensionObject,
                    value: new Range(options.instrumentRange)
                })
            );
        }

        variable.title.setValueFromSource(
            new Variant({
                dataType: DataType.LocalizedText,
                value: coerceLocalizedText(options.title || "")
            })
        );

        // Linear/Log/Ln
        variable.axisScaleType.setValueFromSource(
            new Variant({
                dataType: DataType.Int32,
                value: coerceAxisScale(options.axisScaleType)
            })
        );

        variable.xAxisDefinition.setValueFromSource(
            new Variant({
                dataType: DataType.ExtensionObject,
                value: new AxisInformation(options.xAxisDefinition)
            })
        );

        return variable as any;
    }

    // - Methods ----------------------------------------------------------------------------------------------------
    /**
     * @method addMethod
     * @param parentObject {Object}
     * @param options {Object}
     * @param [options.nodeId=null] {NodeId} the object nodeid.
     * @param [options.browseName=""] {String} the object browse name.
     * @param [options.description=""] {String} the object description.
     * @param options.inputArguments  {Array<Argument>}
     * @param options.outputArguments {Array<Argument>}
     * @return {Object}
     */
    public addMethod(parentObject: UAObject, options: AddMethodOptions): UAMethod {
        const addressSpace = this.addressSpace;

        assert(
            parentObject !== null && typeof parentObject === "object" && parentObject instanceof BaseNodeImpl,
            "expecting a valid parent object"
        );
        assert(Object.prototype.hasOwnProperty.call(options, "browseName"));
        options.componentOf = parentObject;

        const method = this._addMethod(options);

        const propertyTypeId = addressSpace._coerce_VariableTypeIds("PropertyType");

        const nodeId_ArgumentDataType = "Argument"; // makeNodeId(DataTypeIds.Argument);

        if (options.inputArguments) {
            const _inputArgs = new Variant({
                arrayType: VariantArrayType.Array,
                dataType: DataType.ExtensionObject,
                value: options.inputArguments.map((opt: ArgumentOptions) => new Argument(opt))
            });

            const inputArguments = this.addVariable({
                accessLevel: "CurrentRead",
                arrayDimensions: [_inputArgs.value.length],
                browseName: { name: "InputArguments", namespaceIndex: 0 },
                dataType: nodeId_ArgumentDataType,
                description:
                    "the definition of the input argument of method " +
                    parentObject.browseName.toString() +
                    "." +
                    method.browseName.toString(),
                minimumSamplingInterval: -1,
                modellingRule: "Mandatory",
                propertyOf: method,
                typeDefinition: "PropertyType",
                value: _inputArgs,
                valueRank: 1
            });
            inputArguments.setValueFromSource(_inputArgs);
            assert(inputArguments.typeDefinition.toString() === propertyTypeId.toString());
            assert(Array.isArray(inputArguments.arrayDimensions));
        }

        if (options.outputArguments) {
            const _outputArgs = new Variant({
                arrayType: VariantArrayType.Array,
                dataType: DataType.ExtensionObject,
                value: options.outputArguments.map((opts) => new Argument(opts))
            });

            const outputArguments = this.addVariable({
                accessLevel: "CurrentRead",
                arrayDimensions: [_outputArgs.value.length],
                browseName: { name: "OutputArguments", namespaceIndex: 0 },
                dataType: nodeId_ArgumentDataType,
                description:
                    "the definition of the output arguments of method " +
                    parentObject.browseName.toString() +
                    "." +
                    method.browseName.toString(),
                minimumSamplingInterval: -1,
                modellingRule: "Mandatory",
                propertyOf: method,
                typeDefinition: "PropertyType",
                value: _outputArgs,
                valueRank: 1
            });
            outputArguments.setValueFromSource(_outputArgs);

            assert(outputArguments.typeDefinition.toString() === propertyTypeId.toString());
            assert(Array.isArray(outputArguments.arrayDimensions));
        }

        // verifying post-conditions
        parentObject.install_extra_properties();

        return method;
    }

    // - Enumeration ------------------------------------------------------------------------------------------------

    /**
     *
     * @method addEnumerationType
     * @param options
     * @param options.browseName  {String}
     * @param options.enumeration {Array}
     * @param options.enumeration[].displayName {String|LocalizedText}
     * @param options.enumeration[].value       {Number}
     * @param options.enumeration[].description {String|LocalizedText|null}
     */
    public addEnumerationType(options: AddEnumerationTypeOptions): UADataType {
        // Release 1.03 OPC Unified Architecture, Part 3 - page 34
        // Enumeration DataTypes are DataTypes that represent discrete sets of named values.
        // Enumerations are always encoded as Int32 on the wire as defined in Part 6. Enumeration
        // DataTypes inherit directly or indirectly from the DataType Enumeration defined in 8.14.
        // Enumerations have no encodings exposed in the IAddressSpace. To expose the human readable
        // representation of an enumerated value the DataType Node may have the EnumString
        // Property that contains an array of LocalizedText. The Integer representation of the enumeration
        // value points to a position within that array. EnumValues Property can be used instead of the
        // EnumStrings to support integer representation of enumerations that are not zero-based or have
        // gaps. It contains an array of a Structured DataType containing the integer representation as
        // well as the human-readable representation. An example of an enumeration DataType containing
        // a sparse list of Integers is NodeClass which is defined in 8.30.

        // OPC Unified Architecture, Part 3  Release 1.03 page 35
        // Table 11 – DataType NodeClass
        // EnumStrings O LocalizedText[] The EnumStrings Property only applies for Enumeration DataTypes.
        //                               It shall not be applied for other DataTypes. If the EnumValues
        //                               Property is provided, the EnumStrings Property shall not be provided.
        //                               Each entry of the array of LocalizedText in this Property represents
        //                               the human-readable representation of an enumerated value. The
        //                               Integer representation of the enumeration value points to a position
        //                               of the array.
        // EnumValues O EnumValueType[]  The EnumValues Property only applies for Enumeration DataTypes.
        //                               It shall not be applied for other DataTypes. If the EnumStrings
        //                               Property is provided, the EnumValues Property shall not be provided.
        //                               Using the EnumValues Property it is possible to represent.
        //                               Enumerations with integers that are not zero-based or have gaps
        //                               (e.g. 1, 2, 4, 8, 16).
        //                               Each entry of the array of EnumValueType in this Property
        //                               represents one enumeration value with its integer notation, human readable
        //                                representation and help information.
        // The Property EnumStrings contains human-readable representations of enumeration values and is
        // only applied to Enumeration DataTypes. Instead of the EnumStrings Property an Enumeration
        // DataType can also use the EnumValues Property to represent Enumerations with integer values that are not
        // zero-based or containing gaps. There are no additional Properties defined for DataTypes in this standard.
        // Additional parts of this series of standards may define additional Properties for DataTypes.

        // 8.40 EnumValueType
        // This Structured DataType is used to represent a human-readable representation of an
        // Enumeration. Its elements are described inTable 27. When this type is used in an array representing
        // human-readable representations of an enumeration, each Value shall be unique in that array.
        // Table 27 – EnumValueType Definition
        // Name               Type            Description
        // EnumValueType structure
        // Value              Int64           The Integer representation of an Enumeration.
        // DisplayName        LocalizedText   A human-readable representation of the Value of the Enumeration.
        // Description        LocalizedText   A localized description of the enumeration value. This field can
        //                                    contain an empty string if no description is available.
        // Note that the EnumValueType has been defined with a Int64 Value to meet a variety of usages.
        // When it is used to define the string representation of an Enumeration DataType, the value range
        // is limited to Int32, because the Enumeration DataType is a subtype of Int32. Part 8 specifies
        // other usages where the actual value might be between 8 and 64 Bit.

        assert(typeof options.browseName === "string");
        assert(Array.isArray(options.enumeration));

        const addressSpace = this.addressSpace;
        let definition;
        const enumerationType = addressSpace.findDataType("Enumeration")!;
        assert(enumerationType.nodeId instanceof NodeId);
        assert(enumerationType instanceof UADataTypeImpl);
        const references = [{ referenceType: "HasSubtype", isForward: false, nodeId: enumerationType.nodeId }];
        const opts = {
            browseName: options.browseName,
            definition,
            description: coerceLocalizedText(options.description) || null,
            displayName: options.displayName || null,
            isAbstract: false,
            nodeClass: NodeClass.DataType,
            references
        };

        const enumType = this.internalCreateNode(opts) as UADataType; //  as UAEnumeration;

        enumType.propagate_back_references();

        if (typeof options.enumeration[0] === "string") {
            const enumeration = options.enumeration as string[];
            // enumeration is a array of string
            definition = enumeration.map((str: string, index: number) => coerceLocalizedText(str));

            const value = new Variant({
                arrayType: VariantArrayType.Array,
                dataType: DataType.LocalizedText,
                value: definition
            });

            const enumStrings = this.addVariable({
                browseName: { name: "EnumStrings", namespaceIndex: 0 },
                dataType: "LocalizedText",
                description: "",
                modellingRule: "Mandatory",
                propertyOf: enumType,
                value,
                valueRank: 1
            });
            assert(enumStrings.browseName.toString() === "EnumStrings");

            // set $definition
            // EnumDefinition
            //   This Structured DataType is used to provide the metadata for a custom Enumeration or
            //   OptionSet DataType. It is derived from the DataType DataTypeDefinition.
            // Enum Field:
            //   This Structured DataType is used to provide the metadata for a field of a custom Enumeration
            //   or OptionSet DataType. It is derived from the DataType EnumValueType. If used for an
            //   OptionSet, the corresponding Value in the base type contains the number of the bit associated
            //   with the field. The EnumField is formally defined in Table 37.
            (enumType as any).$fullDefinition = new EnumDefinition({
                fields: enumeration.map(
                    (x: string, index: number) =>
                        new EnumField({
                            name: x,

                            description: coerceLocalizedText(x),
                            value: coerceInt64(index)
                        })
                )
            });
        } else {
            const enumeration = options.enumeration as EnumerationItem[];
            // construct the definition object
            definition = enumeration.map((enumItem: EnumerationItem) => {
                return new EnumValueType({
                    description: coerceLocalizedText(enumItem.description),
                    displayName: coerceLocalizedText(enumItem.displayName),
                    value: [0, enumItem.value]
                });
            });

            const value = new Variant({
                arrayType: VariantArrayType.Array,
                dataType: DataType.ExtensionObject,
                value: definition
            });

            const enumValues = this.addVariable({
                browseName: { name: "EnumValues", namespaceIndex: 0 },
                dataType: "EnumValueType",
                description: undefined,
                modellingRule: "Mandatory",
                propertyOf: enumType,
                value,
                valueRank: 1
            });
            assert(enumValues.browseName.toString() === "EnumValues");

            (enumType as any).$fullDefinition = new EnumDefinition({
                fields: enumeration.map(
                    (x: EnumerationItem, index: number) =>
                        new EnumField({
                            name: x.displayName.toString(),

                            description: x.description || "",
                            value: coerceInt64(x.value)
                        })
                )
            });
        }
        // now create the string value property
        // <UAVariable NodeId="i=7612" BrowseName="EnumStrings"
        //               ParentNodeId="i=852" DataType="LocalizedText" ValueRank="1">
        // <DisplayName>EnumStrings</DisplayName>
        // <References>
        //   <Reference ReferenceType="HasTypeDefinition">i=68</Reference>
        //   <Reference ReferenceType="HasModellingRule">i=78</Reference>
        //    <Reference ReferenceType="HasProperty" IsForward="false">i=852</Reference>
        // </References>
        // <Value>
        //    <ListOfLocalizedText xmlns="http://opcfoundation.org/UA/2008/02/Types.xsd">
        //      <LocalizedText><Locale></Locale><Text>Running</Text></LocalizedText>
        //      <LocalizedText><Locale></Locale><Text>Failed</Text>
        //    </ListOfLocalizedText>
        // </Value>
        // </UAVariable>

        return enumType;
    }

    // -------------------------------------------------------------------------
    // State and Transition
    // -------------------------------------------------------------------------
    public toNodeset2XML(): string {
        return "";
    }

    // -------------------------------------------------------------------------
    // State and Transition
    // -------------------------------------------------------------------------
    /**
     * @class IAddressSpace
     * @method addState
     * @param component
     * @param stateName   {string}
     * @param stateNumber {number}
     * @param isInitialState {boolean}
     * @return {UAObject} {StateType|InitialStateType}
     */
    public addState(
        component: UAStateMachineEx,
        stateName: string,
        stateNumber: number,
        isInitialState: boolean
    ): UAState | UAInitialState {
        const addressSpace = this.addressSpace;

        isInitialState = !!isInitialState;

        const _component = component as UAStateMachineImpl;

        assert(_component.nodeClass === NodeClass.Object || _component.nodeClass === NodeClass.ObjectType);
        assert(typeof stateName === "string");
        assert(typeof isInitialState === "boolean");

        const initialStateType = addressSpace.findObjectType("InitialStateType")!;
        const stateType = addressSpace.findObjectType("StateType")!;

        let state: UAState | UAInitialState;
        if (isInitialState) {
            state = initialStateType.instantiate({
                browseName: stateName,
                componentOf: _component
            }) as UAInitialState;
        } else {
            state = stateType.instantiate({
                browseName: stateName,
                componentOf: _component
            }) as UAState;
        }
        // ensure state number is unique
        state.stateNumber.setValueFromSource({
            dataType: DataType.UInt32,
            value: stateNumber
        });
        return state;
    }

    /**
     */
    public addTransition(
        component: UAStateMachineEx,
        fromState: string,
        toState: string,
        transitionNumber: number
    ): UATransitionEx {
        const addressSpace = this.addressSpace;

        const _component = component as UAStateMachineImpl;

        assert(_component.nodeClass === NodeClass.Object || _component.nodeClass === NodeClass.ObjectType);
        assert(typeof fromState === "string");
        assert(typeof toState === "string");
        assert(isFinite(transitionNumber));

        const fromStateNode = _component.getComponentByName(fromState, _component.nodeId.namespace);

        // istanbul ignore next
        if (!fromStateNode) {
            throw new Error("Cannot find state with name " + fromState);
        }
        assert(fromStateNode.browseName.name!.toString() === fromState);

        const toStateNode = _component.getComponentByName(toState);

        // istanbul ignore next
        if (!toStateNode) {
            throw new Error("Cannot find state with name " + toState);
        }
        assert(toStateNode.browseName.name!.toString() === toState);

        const transitionType = addressSpace.findObjectType("TransitionType");
        if (!transitionType) {
            throw new Error("Cannot find TransitionType");
        }
        const transition = transitionType.instantiate({
            browseName: fromState + "To" + toState + "Transition",
            componentOf: _component
        }) as UATransitionImpl;

        transition.addReference({
            isForward: true,
            nodeId: toStateNode.nodeId,
            referenceType: "ToState"
        });
        transition.addReference({
            isForward: true,
            nodeId: fromStateNode.nodeId,
            referenceType: "FromState"
        });

        transition.transitionNumber.setValueFromSource({
            dataType: DataType.UInt32,
            value: transitionNumber
        });

        return transition;
    }

    /**
     * @method addTwoStateVariable
     *
     * @return {UATwoStateVariable}
     */
    public addTwoStateVariable(options: AddTwoStateVariableOptions): UATwoStateVariableEx {
        return _addTwoStateVariable(this, options);
    }

    /**
     * @method addTwoStateDiscrete
     *
     * Add a TwoStateDiscrete Variable
     * @return {UATwoStateDiscrete}
     */
    public addTwoStateDiscrete(options: AddTwoStateDiscreteOptions): UATwoStateDiscreteEx {
        return _addTwoStateDiscrete(this, options);
    }

    // --- Alarms & Conditions -------------------------------------------------
    public instantiateCondition(conditionTypeId: UAEventType | NodeId | string, options: any, data: any): UAConditionEx {
        return UAConditionImpl.instantiate(this, conditionTypeId, options, data);
    }

    public instantiateAcknowledgeableCondition(
        conditionTypeId: UAEventType | NodeId | string,
        options: any,
        data: any
    ): UAAcknowledgeableConditionImpl {
        return UAAcknowledgeableConditionImpl.instantiate(this, conditionTypeId, options, data);
    }

    public instantiateAlarmCondition(
        alarmConditionTypeId: UAEventType | NodeId | string,
        options: any,
        data: any
    ): UAAlarmConditionEx {
        return UAAlarmConditionImpl.instantiate(this, alarmConditionTypeId, options, data);
    }

    public instantiateLimitAlarm(limitAlarmTypeId: UAEventType | NodeId | string, options: any, data: any): UALimitAlarmEx {
        return UALimitAlarmImpl.instantiate(this, limitAlarmTypeId, options, data);
    }

    public instantiateExclusiveLimitAlarm(
        exclusiveLimitAlarmTypeId: UAEventType | NodeId | string,
        options: any,
        data: any
    ): UAExclusiveLimitAlarmEx {
        return UAExclusiveLimitAlarmImpl.instantiate(this, exclusiveLimitAlarmTypeId, options, data);
    }

    public instantiateExclusiveDeviationAlarm(options: any, data: any): UAExclusiveDeviationAlarmEx {
        return UAExclusiveDeviationAlarmImpl.instantiate(this, "ExclusiveDeviationAlarmType", options, data);
    }

    public instantiateNonExclusiveLimitAlarm(
        nonExclusiveLimitAlarmTypeId: UAEventType | NodeId | string,
        options: any,
        data: any
    ): UANonExclusiveLimitAlarmEx {
        return UANonExclusiveLimitAlarmImpl.instantiate(this, nonExclusiveLimitAlarmTypeId, options, data);
    }

    public instantiateNonExclusiveDeviationAlarm(options: any, data: any): UANonExclusiveDeviationAlarmEx {
        return UANonExclusiveDeviationAlarmImpl.instantiate(this, "NonExclusiveDeviationAlarmType", options, data);
    }

    public instantiateDiscreteAlarm(discreteAlarmType: UAEventType | NodeId | string, options: any, data: any): UADiscreteAlarmEx {
        return UADiscreteAlarmImpl.instantiate(this, discreteAlarmType, options, data);
    }
    public instantiateOffNormalAlarm(options: any, data: any): UAOffNormalAlarmEx {
        return UAOffNormalAlarmImpl.instantiate(this, "OffNormalAlarmType", options, data);
    }

    // default roles and permissions
    public setDefaultRolePermissions(rolePermissions: RolePermissionTypeOptions[] | null): void {
        this.defaultRolePermissions = rolePermissions ? coerceRolePermissions(rolePermissions) : undefined;
    }
    public getDefaultRolePermissions(): RolePermissionType[] | null {
        return this.defaultRolePermissions || null;
    }
    public setDefaultAccessRestrictions(accessRestrictions: AccessRestrictionsFlag): void {
        this.defaultAccessRestrictions = accessRestrictions;
    }
    public getDefaultAccessRestrictions(): AccessRestrictionsFlag {
        return this.defaultAccessRestrictions || AccessRestrictionsFlag.None;
    }

    // --- internal stuff
    public constructNodeId(options: ConstructNodeIdOptions): NodeId {
        return this._nodeIdManager.constructNodeId(options);
    }

    public _register(node: BaseNode): void {
        assert(node instanceof BaseNodeImpl, "Expecting a instance of BaseNode in _register");
        assert(node.nodeId instanceof NodeId, "Expecting a NodeId");
        if (node.nodeId.namespace !== this.index) {
            throw new Error("node must belongs to this namespace");
        }
        assert(node.nodeId.namespace === this.index, "node must belongs to this namespace");
        assert(Object.prototype.hasOwnProperty.call(node, "browseName"), "Node must have a browseName");
        // assert(node.browseName.namespaceIndex === this.index,"browseName must belongs to this namespace");

        const hashKey = _makeHashKey(node.nodeId);

        // istanbul ignore next
        if (this._nodeid_index.has(hashKey)) {
            throw new Error(
                "node " +
                    node.browseName.toString() +
                    "nodeId = " +
                    node.nodeId.displayText() +
                    " already registered " +
                    node.nodeId.toString() +
                    "\n" +
                    " in namespace " +
                    this.namespaceUri +
                    " index = " +
                    this.index +
                    "\n" +
                    " browseName = " +
                    node.browseName.toString()
            );
        }

        this._nodeid_index.set(hashKey, node);

        switch (node.nodeClass) {
            case NodeClass.ObjectType:
                this._registerObjectType(node as UAObjectType);
                break;
            case NodeClass.VariableType:
                this._registerVariableType(node as UAVariableType);
                break;
            case NodeClass.ReferenceType:
                this._registerReferenceType(node as UAReferenceType);
                break;
            case NodeClass.DataType:
                this._registerDataType(node as UADataType);
                break;
            case NodeClass.Object:
            case NodeClass.Variable:
            case NodeClass.Method:
            case NodeClass.View:
                break;
            default:
                // tslint:disable-next-line:no-console
                console.log("Invalid class Name", node.nodeClass);
                throw new Error("Invalid class name specified");
        }
    }

    /**
     * @method internalCreateNode
     * @internal
     */
    public internalCreateNode(options: CreateNodeOptions): BaseNode {
        assert(options.nodeClass !== undefined, " options.nodeClass must be specified");
        assert(options.browseName, "options.browseName must be specified");
        // xx assert(options.browseName instanceof QualifiedName
        // ? (options.browseName.namespaceIndex === this.index): true,
        // "Expecting browseName to have the same namespaceIndex as the namespace");

        options.description = coerceLocalizedText(options.description);

        // browseName adjustment
        if (typeof options.browseName === "string") {
            const match = options.browseName.match(regExpNamespaceDotBrowseName);
            if (match) {
                const correctedName = match[1];
                // the application is using an old scheme
                console.log(
                    chalk.green(
                        "Warning : since node-opcua 0.4.2 " + "namespace index should not be prepended to the browse name anymore"
                    )
                );
                console.log("   ", options.browseName, " will be replaced with ", correctedName);
                console.log(" Please update your code");

                const indexVerif = parseInt(match[0], 10);
                if (indexVerif !== this.index) {
                    errorLog(
                        chalk.red.bold(
                            "Error: namespace index used at the front of the browseName " +
                                indexVerif +
                                " do not match the index of the current namespace (" +
                                this.index +
                                ")"
                        )
                    );
                    errorLog(
                        " Please fix your code so that the created node is inserted in the correct namespace," +
                            " please refer to the NodeOPCUA documentation"
                    );
                }
            }

            options.browseName = new QualifiedName({ name: options.browseName, namespaceIndex: this.index });
        } else if (!(options.browseName instanceof QualifiedName)) {
            options.browseName = new QualifiedName(options.browseName);
        }
        assert(options.browseName instanceof QualifiedName, "Expecting options.browseName to be instanceof  QualifiedName ");

        // ------------- set display name
        if (!options.displayName) {
            assert(typeof options.browseName.name === "string");
            options.displayName = options.browseName.name;
        }

        // --- nodeId adjustment
        options.nodeId = this.constructNodeId(options);
        dumpIf(!options.nodeId, options); // missing node Id
        assert(options.nodeId instanceof NodeId);

        // assert(options.browseName.namespaceIndex === this.index,"Expecting browseName to have
        // the same namespaceIndex as the namespace");

        const Constructor = _constructors_map[NodeClass[options.nodeClass]];

        if (!Constructor) {
            throw new Error(" missing constructor for NodeClass " + NodeClass[options.nodeClass]);
        }

        options.addressSpace = this.addressSpace;
        const node = new Constructor(options);
        this._register(node);

        // object shall now be registered
        // istanbul ignore next
        if (doDebug) {
            assert(this.findNode(node.nodeId) !== null && typeof this.findNode(node.nodeId) === "object");
        }
        return node;
    }

    public _deleteNode(node: BaseNode): void {
        assert(node instanceof BaseNodeImpl);

        const hashKey = _makeHashKey(node.nodeId);
        // istanbul ignore next
        if (!this._nodeid_index.has(hashKey)) {
            throw new Error("deleteNode : nodeId " + node.nodeId.displayText() + " is not registered " + node.nodeId.toString());
        }
        switch (node.nodeClass) {
            case NodeClass.ObjectType:
                this._unregisterObjectType(node as UAObjectType);
                break;
            case NodeClass.VariableType:
                this._unregisterVariableType(node as UAVariableType);
                break;
            case NodeClass.Object:
            case NodeClass.Variable:
            case NodeClass.Method:
            case NodeClass.View:
                break;
            default:
                // tslint:disable:no-console
                console.log("Invalid class Name", node.nodeClass);
                throw new Error("Invalid class name specified");
        }
        const deleted = this._nodeid_index.delete(hashKey);
        assert(deleted);
        (<BaseNodeImpl>node).dispose();
    }

    // --- Private stuff

    private _addObjectOrVariableType<T>(
        options1: AddBaseNodeOptions,
        topMostBaseType: string,
        nodeClass: NodeClass.ObjectType | NodeClass.VariableType
    ) {
        const addressSpace = this.addressSpace;

        assert(typeof topMostBaseType === "string");
        assert(nodeClass === NodeClass.ObjectType || nodeClass === NodeClass.VariableType);

        const options = options1 as CreateNodeOptions;
        assert(!options.nodeClass);
        assert(options.browseName);
        assert(typeof options.browseName === "string");
        if (Object.prototype.hasOwnProperty.call(options, "references")) {
            throw new Error("options.references should not be provided, use options.subtypeOf instead");
        }
        const references: UAReference[] = [];

        function process_subtypeOf_options(this: NamespaceImpl, options2: any, references1: AddReferenceOpts[]) {
            // check common misspelling mistake
            assert(!options2.subTypeOf, "misspell error : it should be 'subtypeOf' instead");
            if (Object.prototype.hasOwnProperty.call(options2, "hasTypeDefinition")) {
                throw new Error("hasTypeDefinition option is invalid. Do you mean typeDefinition instead ?");
            }
            assert(!options2.typeDefinition, " do you mean subtypeOf ?");

            const subtypeOfNodeId = addressSpace._coerceType(options2.subtypeOf, topMostBaseType, nodeClass);

            assert(subtypeOfNodeId);
            references1.push({
                isForward: false,
                nodeId: subtypeOfNodeId,
                referenceType: "HasSubtype"
            });
        }

        process_subtypeOf_options.call(this, options, references);

        const objectType = this.internalCreateNode({
            browseName: options.browseName,
            displayName: options.displayName,
            description: options.description,
            eventNotifier: +options.eventNotifier,
            isAbstract: !!options.isAbstract,
            nodeClass,
            nodeId: options.nodeId,
            references
        });

        objectType.propagate_back_references();

        objectType.install_extra_properties();

        (<BaseNodeImpl>objectType).installPostInstallFunc(options.postInstantiateFunc);
        return objectType;
    }

    // private  _adjust_options(options: any) {
    //     const ns = this.addressSpace.getNamespaceIndex(this.namespaceUri);
    //     if (!options.nodeId) {
    //         const id = this._getNextAvailableId();
    //         options.nodeId = new NodeId(NodeId.NodeIdType.NUMERIC, id, ns);
    //     }
    //     options.nodeId = NodeId.coerce(options.nodeId);
    //     if (typeof options.browseName === "string") {
    //         options.browseName = new QualifiedName({
    //             name: options.browseName,
    //             namespaceIndex: ns
    //         });
    //     }
    //     return options;
    // }

    private _registerObjectType(node: UAObjectType) {
        assert(this.index === node.nodeId.namespace);
        const key = node.browseName.name!;
        assert(!this._objectTypeMap.has(key), " UAObjectType already declared");
        this._objectTypeMap.set(key, node);
    }

    private _registerVariableType(node: UAVariableType) {
        assert(this.index === node.nodeId.namespace);
        const key = node.browseName.name!;
        assert(!this._variableTypeMap.has(key), " UAVariableType already declared");
        this._variableTypeMap.set(key, node);
    }

    private _registerReferenceType(node: UAReferenceType) {
        assert(this.index === node.nodeId.namespace);
        assert(node.browseName instanceof QualifiedName);
        const key: string = node.browseName.name!;
        this._referenceTypeMap.set(key, node);
        this._referenceTypeMapInv.set(node.inverseName.text!, node);
    }

    private _registerDataType(node: UADataType) {
        assert(this.index === node.nodeId.namespace);
        const key = node.browseName.name!;
        assert(node.browseName instanceof QualifiedName);
        assert(!this._dataTypeMap.has(key), " DataType already declared");
        this._dataTypeMap.set(key, node);
    }

    private _unregisterObjectType(node: UAObjectType): void {
        const key = node.browseName.name!;
        this._objectTypeMap.delete(key);
    }

    private _unregisterVariableType(node: UAVariableType): void {
        const key = node.browseName.name!;
        this._variableTypeMap.delete(key);
    }

    /**
     * @private
     */
    private _addVariable(options: AddVariableOptions2): UAVariable {
        const addressSpace = this.addressSpace;

        const baseDataVariableType = addressSpace.findVariableType("BaseDataVariableType");
        if (!baseDataVariableType) {
            throw new Error("cannot find BaseDataVariableType");
        }
        const baseDataVariableTypeId = baseDataVariableType.nodeId;

        assert(Object.prototype.hasOwnProperty.call(options, "browseName"), "options.browseName must be provided");
        assert(Object.prototype.hasOwnProperty.call(options, "dataType"), "options.dataType must be provided");

        options.historizing = !!options.historizing;

        // xx assert(this.FolderTypeId && this.BaseObjectTypeId); // is default address space generated.?

        // istanbul ignore next
        if (Object.prototype.hasOwnProperty.call(options, "hasTypeDefinition")) {
            throw new Error("hasTypeDefinition option is invalid. Do you mean typeDefinition instead ?");
        }
        // ------------------------------------------ TypeDefinition
        let typeDefinition = options.typeDefinition || baseDataVariableTypeId;
        typeDefinition = addressSpace._coerce_VariableTypeIds(typeDefinition);
        assert(typeDefinition instanceof NodeId);

        // ------------------------------------------ DataType
        options.dataType = addressSpace._coerce_DataType(options.dataType!);

        options.valueRank = utils.isNullOrUndefined(options.valueRank)
            ? options.arrayDimensions
                ? options.arrayDimensions.length
                : -1
            : options.valueRank;
        assert(typeof options.valueRank === "number" && isFinite(options.valueRank!));

        options.arrayDimensions = options.arrayDimensions || null;
        assert(Array.isArray(options.arrayDimensions) || options.arrayDimensions === null);
        // -----------------------------------------------------

        options.minimumSamplingInterval = options.minimumSamplingInterval !== undefined ? +options.minimumSamplingInterval : 0;
        let references = options.references || ([] as AddReferenceOpts[]);

        references = ([] as AddReferenceOpts[]).concat(references, [
            {
                isForward: true,
                nodeId: typeDefinition,
                referenceType: "HasTypeDefinition"
            }
        ]);

        assert(!options.nodeClass || options.nodeClass === NodeClass.Variable);
        options.nodeClass = NodeClass.Variable;

        options.references = references;

        const variable = this.createNode(options) as UAVariable;
        return variable;
    }

    /**
     * @private
     */
    private _addMethod(options: any): UAMethod {
        const addressSpace = this.addressSpace;

        assert(isNonEmptyQualifiedName(options.browseName));

        const references: UAReference[] = [];
        assert(isNonEmptyQualifiedName(options.browseName));

        _handle_hierarchy_parent(addressSpace, references, options);

        UANamespace_process_modelling_rule(references, options.modellingRule);

        const method = this.internalCreateNode({
            browseName: options.browseName,
            description: options.description || "",
            displayName: options.displayName,
            eventNotifier: +options.eventNotifier,
            isAbstract: false,
            nodeClass: NodeClass.Method,
            nodeId: options.nodeId,
            references,
            rolePermissions: options.rolePermissions
        }) as UAMethod;
        assert(method.nodeId !== null);
        method.propagate_back_references();
        assert(!method.typeDefinition);

        return method;
    }
}

const _constructors_map: any = {
    DataType: UADataTypeImpl,
    Method: UAMethodImpl,
    Object: UAObjectImpl,
    ObjectType: UAObjectTypeImpl,
    ReferenceType: UAReferenceTypeImpl,
    Variable: UAVariableImpl,
    VariableType: UAVariableTypeImpl,
    View: UAViewImpl
};

/**
 * @method _coerce_parent
 * convert a 'string' , NodeId or Object into a valid and existing object
 * @param addressSpace  {IAddressSpace}
 * @param value
 * @param coerceFunc
 * @private
 */
function _coerce_parent(
    addressSpace: AddressSpacePrivate,
    value: null | string | BaseNode,
    coerceFunc: (data: string | NodeId | BaseNode) => BaseNode | null
): BaseNode | null {
    assert(typeof coerceFunc === "function");
    if (value) {
        if (typeof value === "string") {
            value = coerceFunc.call(addressSpace, value);
        }
        if (value instanceof NodeId) {
            value = addressSpace.findNode(value) as BaseNode;
        }
    }
    assert(!value || value instanceof BaseNodeImpl);
    return value as BaseNode;
}

function _handle_event_hierarchy_parent(
    addressSpace: AddressSpacePrivate,
    references: AddReferenceOpts[],
    options: CreateNodeOptions
) {
    options.eventSourceOf = _coerce_parent(addressSpace, options.eventSourceOf, addressSpace._coerceNode);
    options.notifierOf = _coerce_parent(addressSpace, options.notifierOf, addressSpace._coerceNode);
    if (options.eventSourceOf) {
        assert(!options.notifierOf, "notifierOf shall not be provided with eventSourceOf ");
        references.push({
            isForward: false,
            nodeId: options.eventSourceOf.nodeId,
            referenceType: "HasEventSource"
        });

        options.eventNotifier = options.eventNotifier || 1;
    } else if (options.notifierOf) {
        assert(!options.eventSourceOf, "eventSourceOf shall not be provided with notifierOf ");
        references.push({
            isForward: false,
            nodeId: options.notifierOf.nodeId,
            referenceType: "HasNotifier"
        });
    }
}

export function _handle_hierarchy_parent(addressSpace: AddressSpacePrivate, references: AddReferenceOpts[], options: any): void {
    options.componentOf = _coerce_parent(addressSpace, options.componentOf, addressSpace._coerceNode);
    options.propertyOf = _coerce_parent(addressSpace, options.propertyOf, addressSpace._coerceNode);
    options.organizedBy = _coerce_parent(addressSpace, options.organizedBy, addressSpace._coerceFolder);
    options.encodingOf = _coerce_parent(addressSpace, options.encodingOf, addressSpace._coerceNode);

    if (options.componentOf) {
        assert(!options.propertyOf);
        assert(!options.organizedBy);
        assert(addressSpace.rootFolder.objects, "addressSpace must have a rootFolder.objects folder");
        assert(
            options.componentOf.nodeId !== addressSpace.rootFolder.objects.nodeId,
            "Only Organizes References are used to relate Objects to the 'Objects' standard Object."
        );
        references.push({
            isForward: false,
            nodeId: options.componentOf.nodeId,
            referenceType: "HasComponent"
        });
    }

    if (options.propertyOf) {
        assert(!options.componentOf);
        assert(!options.organizedBy);
        assert(
            options.propertyOf.nodeId !== addressSpace.rootFolder.objects.nodeId,
            "Only Organizes References are used to relate Objects to the 'Objects' standard Object."
        );
        references.push({
            isForward: false,
            nodeId: options.propertyOf.nodeId,
            referenceType: "HasProperty"
        });
    }

    if (options.organizedBy) {
        assert(!options.propertyOf);
        assert(!options.componentOf);
        references.push({
            isForward: false,
            nodeId: options.organizedBy.nodeId,
            referenceType: "Organizes"
        });
    }
    if (options.encodingOf) {
        // parent must be a DataType
        assert(options.encodingOf.nodeClass === NodeClass.DataType, "encodingOf must be toward a DataType");
        references.push({
            isForward: false,
            nodeId: options.encodingOf.nodeId,
            referenceType: "HasEncoding"
        });
    }
}

function _copy_reference(reference: UAReference): AddReferenceOpts {
    assert(Object.prototype.hasOwnProperty.call(reference, "referenceType"));
    assert(Object.prototype.hasOwnProperty.call(reference, "isForward"));
    assert(Object.prototype.hasOwnProperty.call(reference, "nodeId"));
    assert(reference.nodeId instanceof NodeId);
    return {
        isForward: reference.isForward,
        nodeId: reference.nodeId,
        referenceType: reference.referenceType
    };
}

function _copy_references(references?: UAReference[] | null): AddReferenceOpts[] {
    references = references || [];
    return references.map(_copy_reference);
}

export function isNonEmptyQualifiedName(browseName?: null | string | QualifiedName): boolean {
    if (!browseName) {
        return false;
    }
    if (typeof browseName === "string") {
        return browseName.length >= 0;
    }
    if (!(browseName instanceof QualifiedName)) {
        browseName = new QualifiedName(browseName);
    }
    assert(browseName instanceof QualifiedName);
    return browseName.name!.length > 0;
}

function _handle_node_version(node: BaseNode, options: any) {
    assert(options);
    if (options.nodeVersion) {
        assert(node.nodeClass === NodeClass.Variable || node.nodeClass === NodeClass.Object);

        const nodeVersion = node.addressSpace.getOwnNamespace().addVariable({
            browseName: "NodeVersion",
            dataType: "String",
            propertyOf: node
        });
        const initialValue = typeof options.nodeVersion === "string" ? options.nodeVersion : "0";
        // xx console.log(" init value =",initialValue);
        nodeVersion.setValueFromSource({ dataType: "String", value: initialValue });
    }
}
