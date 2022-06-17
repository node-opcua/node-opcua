/**
 * @module node-opcua-address-space
 */
// tslint:disable:max-classes-per-file
// tslint:disable:no-console
import * as chalk from "chalk";

import { assert } from "node-opcua-assert";
import {
    IAddressSpace,
    AddVariableOptions,
    BaseNode,
    InstantiateVariableOptions,
    ModellingRuleType,
    INamespace,
    UAMethod,
    UAObject,
    UAObjectType,
    UAReference,
    UAVariable,
    UAVariableType,
    CloneFilter
} from "node-opcua-address-space-base";
import { ReferenceTypeIds } from "node-opcua-constants";
import { coerceQualifiedName, NodeClass, QualifiedName, BrowseDirection, AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog, make_warningLog, make_errorLog } from "node-opcua-debug";
import { coerceNodeId, makeNodeId, NodeId, NodeIdLike, sameNodeId } from "node-opcua-nodeid";
import { StatusCode, StatusCodes } from "node-opcua-status-code";
import { UInt32 } from "node-opcua-basic-types";
import { isNullOrUndefined } from "node-opcua-utils";
import { DataType, Variant, VariantArrayType, verifyRankAndDimensions } from "node-opcua-variant";

import { SessionContext } from "../source/session_context";
import { makeOptionalsMap, OptionalMap } from "../source/helpers/make_optionals_map";

import { AddressSpacePrivate } from "./address_space_private";
import { BaseNodeImpl, InternalBaseNodeOptions } from "./base_node_impl";
import { _clone_children_references, ToStringBuilder, UAVariableType_toString } from "./base_node_private";
import * as tools from "./tool_isSupertypeOf";
import { get_subtypeOfObj } from "./tool_isSupertypeOf";
import { get_subtypeOf } from "./tool_isSupertypeOf";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);
const warningLog = make_warningLog(__filename);
const errorLog = make_errorLog(__filename);

// eslint-disable-next-line prefer-const
let doTrace = checkDebugFlag("INSTANTIATE");
const traceLog = errorLog;

interface InstantiateS {
    propertyOf?: any;
    componentOf?: any;
    modellingRule?: ModellingRuleType;
}
export function topMostParentIsObjectTypeOrVariableType(addressSpace: AddressSpacePrivate, options: InstantiateS): boolean {
    if (options.modellingRule) {
        return true;
    }

    const parent = options.propertyOf || options.componentOf;
    if (!parent) {
        return false;
    }
    const parentNode = addressSpace._coerceNode(parent);
    if (!parentNode) {
        return false;
    }

    let currentNode: BaseNode | null = parentNode;
    while (currentNode) {
        const nodeClass = parentNode.nodeClass;
        if (nodeClass === NodeClass.ObjectType || nodeClass === NodeClass.VariableType) {
            return true;
        }
        if (nodeClass === NodeClass.Object || nodeClass === NodeClass.Variable || nodeClass === NodeClass.Method) {
            /** */
        }
        currentNode = currentNode.findReferencesEx("HasChild", BrowseDirection.Inverse)[0]?.node as BaseNode;
    }
    return false;
}
export interface UAVariableTypeOptions extends InternalBaseNodeOptions {
    /**  */
    valueRank?: number;
    arrayDimensions?: number[] | null;
    historizing?: boolean;
    isAbstract?: boolean;
    value?: any;
    dataType: NodeIdLike;
}
export class UAVariableTypeImpl extends BaseNodeImpl implements UAVariableType {
    public readonly nodeClass = NodeClass.VariableType;

    public get subtypeOf(): NodeId | null {
        return get_subtypeOf.call(this);
    }

    public get subtypeOfObj(): UAVariableType | null {
        return get_subtypeOfObj.call(this) as UAVariableType;
    }

    public isSupertypeOf = tools.construct_isSupertypeOf<UAVariableType>(UAVariableTypeImpl);

    public readonly isAbstract: boolean;
    public dataType: NodeId;
    public valueRank: number;
    public arrayDimensions: UInt32[] | null;
    public readonly minimumSamplingInterval: number;
    public readonly value: any;
    public historizing: boolean;

    constructor(options: UAVariableTypeOptions) {
        super(options);

        verifyRankAndDimensions(options);
        this.valueRank = options.valueRank || -1;
        this.arrayDimensions = options.arrayDimensions || null;

        this.minimumSamplingInterval = 0;

        this.historizing = isNullOrUndefined(options.historizing) ? false : (options.historizing as boolean);
        this.isAbstract = isNullOrUndefined(options.isAbstract) ? false : (options.isAbstract as boolean);

        this.value = options.value; // optional default value for instances of this UAVariableType

        this.dataType = coerceNodeId(options.dataType); // DataType (NodeId)

        if (options.value) {
            this.value = new Variant(options.value);
        }
    }

    public readAttribute(context: SessionContext | null, attributeId: AttributeIds): DataValue {
        assert(!context || context instanceof SessionContext);

        const options: DataValueLike = {};
        switch (attributeId) {
            case AttributeIds.IsAbstract:
                options.value = { dataType: DataType.Boolean, value: this.isAbstract ? true : false };
                options.statusCode = StatusCodes.Good;
                break;
            case AttributeIds.Value:
                if (Object.prototype.hasOwnProperty.call(this, "value") && this.value !== undefined) {
                    assert(this.value.schema.name === "Variant");
                    options.value = this.value;
                    options.statusCode = StatusCodes.Good;
                } else {
                    debugLog(" warning Value not implemented");
                    options.value = { dataType: DataType.Null };
                    options.statusCode = StatusCodes.BadAttributeIdInvalid;
                }
                break;
            case AttributeIds.DataType:
                assert(this.dataType instanceof NodeId);
                options.value = { dataType: DataType.NodeId, value: this.dataType };
                options.statusCode = StatusCodes.Good;
                break;
            case AttributeIds.ValueRank:
                options.value = { dataType: DataType.Int32, value: this.valueRank };
                options.statusCode = StatusCodes.Good;
                break;
            case AttributeIds.ArrayDimensions:
                assert(Array.isArray(this.arrayDimensions) || this.arrayDimensions === null);
                options.value = {
                    arrayType: VariantArrayType.Array,
                    dataType: DataType.UInt32,
                    value: this.arrayDimensions
                };
                options.statusCode = StatusCodes.Good;
                break;
            default:
                return super.readAttribute(context, attributeId);
        }
        return new DataValue(options);
    }

    public toString(): string {
        const options = new ToStringBuilder();
        UAVariableType_toString.call(this, options);
        return options.toString();
    }

    /**
     * instantiate an object of this UAVariableType
     * The instantiation takes care of object type inheritance when constructing inner properties
   
     * Note : HasComponent usage scope
     *
     * ```text
     *    Source          |     Destination
     * -------------------+---------------------------
     *  Object            | Object, Variable,Method
     *  ObjectType        |
     * -------------------+---------------------------
     *  DataVariable      | Variable
     *  DataVariableType  |
     * ```
     *
     *  see : OPCUA 1.03 page 44 $6.4 Instances of ObjectTypes and VariableTypes
     */
    public instantiate(options: InstantiateVariableOptions): UAVariable {
        const addressSpace = this.addressSpace as AddressSpacePrivate;
        // xx assert(!this.isAbstract, "cannot instantiate abstract UAVariableType");

        assert(options, "missing option object");
        assert(
            typeof options.browseName === "string" || (options.browseName !== null && typeof options.browseName === "object"),
            "expecting a browse name"
        );
        assert(
            !Object.prototype.hasOwnProperty.call(options, "propertyOf"),
            "Use addressSpace#addVariable({ propertyOf: xxx}); to add a property"
        );

        assertUnusedChildBrowseName(addressSpace, options);

        const baseVariableType = addressSpace.findVariableType("BaseVariableType")!;
        assert(baseVariableType, "BaseVariableType must be defined in the address space");

        let dataType = options.dataType !== undefined ? options.dataType : this.dataType;
        // may be required (i.e YArrayItemType )

        dataType = this.resolveNodeId(dataType); // DataType (NodeId)
        assert(dataType instanceof NodeId);

        const valueRank = options.valueRank !== undefined ? options.valueRank : this.valueRank;
        const arrayDimensions = options.arrayDimensions !== undefined ? options.arrayDimensions : this.arrayDimensions;

        // istanbul ignore next
        if (!dataType || dataType.isEmpty()) {
            warningLog(" options.dataType", options.dataType ? options.dataType.toString() : "<null>");
            warningLog(" this.dataType", this.dataType ? this.dataType.toString() : "<null>");
            throw new Error(" A valid dataType must be specified");
        }

        const copyAlsoModellingRules = topMostParentIsObjectTypeOrVariableType(addressSpace, options);

        const defaultDataType = this.dataType;
        // BadAttributeIdInvalid
        const defaultDataValue = this.readAttribute(null, AttributeIds.Value);
        const defaultValue =
            (defaultDataType.namespace === 0 && defaultDataType.value == 0) || defaultDataValue.statusCode !== StatusCodes.Good
                ? undefined
                : defaultDataValue.value;

        const opts: AddVariableOptions = {
            arrayDimensions,
            browseName: options.browseName,
            componentOf: options.componentOf,
            dataType,
            description: options.description || this.description,
            displayName: options.displayName || "",
            eventSourceOf: options.eventSourceOf,
            minimumSamplingInterval: options.minimumSamplingInterval,
            modellingRule: options.modellingRule,
            nodeId: options.nodeId,
            notifierOf: options.notifierOf,
            organizedBy: options.organizedBy,
            typeDefinition: this.nodeId,
            value: options.value || defaultValue,
            valueRank
        };

        const namespace: INamespace = options.namespace || addressSpace.getOwnNamespace();
        const instance = namespace.addVariable(opts);

        // xx assert(instance.minimumSamplingInterval === options.minimumSamplingInterval);

        initialize_properties_and_components(instance, baseVariableType, this, copyAlsoModellingRules, options.optionals);

        // if VariableType is a type of Structure DataType
        // we need to instantiate a dataValue
        // and create a bidirectional binding with the individual properties of this type
        instance.bindExtensionObject(options.extensionObject);

        assert(instance.typeDefinition.toString() === this.nodeId.toString());

        instance.install_extra_properties();

        if (this._postInstantiateFunc) {
            this._postInstantiateFunc(instance, this);
        }

        return instance;
    }
}

/**
 * return true if node is a mandatory child or a requested optional
 * @method MandatoryChildOrRequestedOptionalFilter
 * @param instance
 * @param optionalsMap
 * @return {Boolean}
 */
class MandatoryChildOrRequestedOptionalFilter implements CloneFilter {
    private readonly instance: BaseNode;
    private readonly optionalsMap: any;
    private readonly references: UAReference[];

    constructor(instance: BaseNode, optionalsMap: any) {
        // should we clone the node to be a component or propertyOf of a instance
        assert(optionalsMap !== null && typeof optionalsMap === "object");
        assert(null !== instance);
        this.optionalsMap = optionalsMap;
        this.instance = instance;
        this.references = instance.allReferences();
    }

    public shouldKeep(node: BaseNode): boolean {
        const addressSpace = node.addressSpace;

        const alreadyIn = this.references.filter((r: UAReference) => {
            const n = addressSpace.findNode(r.nodeId)!;
            // istanbul ignore next
            if (!n) {
                warningLog(" cannot find node ", r.nodeId.toString());
                return false;
            }
            return n.browseName!.name!.toString() === node.browseName!.name!.toString();
        });

        if (alreadyIn.length > 0) {
            assert(alreadyIn.length === 1, "Duplication found ?");
            // a child with the same browse name has already been install
            // probably from a SuperClass, we should ignore this.
            return false; // ignore
        }

        const modellingRule = node.modellingRule;

        switch (modellingRule) {
            case null:
            case undefined:
                debugLog(
                    "node ",
                    node.browseName.toString(),
                    node.nodeId.toString(),
                    " has no modellingRule ",
                    node.parentNodeId?.toString()
                );
                /**
                 * in some badly generated NodeSet2.xml file, the modellingRule is not specified
                 *
                 * but in some other NodeSet2.xml, this means that the data are only attached to the Type node and shall not be
                 * instantiate in the corresponding instance (example is the state variable of a finite state machine that are only
                 * defined in the Type node)
                 *
                 * we should not consider it as an error, and treat it as not present
                 */
                return false;

            case "Mandatory":
                return true; // keep;
            case "Optional":
                // only if in requested optionals
                return node.browseName!.name! in this.optionalsMap;
            case "OptionalPlaceholder":
                return false; // ignored
            default:
                return false; // ignored
        }
    }

    public filterFor(childInstance: UAVariable | UAObject | UAMethod): CloneFilter {
        const browseName: string = childInstance.browseName.name!;

        let map = {};

        if (browseName in this.optionalsMap) {
            map = this.optionalsMap[browseName];
        }
        const newFilter = new MandatoryChildOrRequestedOptionalFilter(childInstance, map);
        return newFilter;
    }
}

/*
 * @function _get_parent_as_VariableOrObjectType
 * @param originalObject
 * @return {null|BaseNode}
 * @private
 */
function _get_parent_as_VariableOrObjectType(originalObject: BaseNode): UAVariableType | UAObjectType | null {
    if (originalObject.nodeClass === NodeClass.Method) {
        return null;
    }

    const addressSpace = originalObject.addressSpace;

    const parents = originalObject.findReferencesEx("HasChild", BrowseDirection.Inverse);

    // istanbul ignore next
    if (parents.length > 1) {
        warningLog(" object ", originalObject.browseName.toString(), " has more than one parent !");
        warningLog(originalObject.toString());
        warningLog(" parents : ");
        for (const parent of parents) {
            warningLog("     ", parent.toString(), addressSpace.findNode(parent.nodeId)!.browseName.toString());
        }
        return null;
    }

    assert(parents.length === 0 || parents.length === 1);
    if (parents.length === 0) {
        return null;
    }
    const theParent = addressSpace.findNode(parents[0]!.nodeId)!;
    if (theParent && (theParent.nodeClass === NodeClass.VariableType || theParent.nodeClass === NodeClass.ObjectType)) {
        return theParent as UAVariableType | UAObjectType;
    }
    return null;
}

interface CloneInfo {
    cloned: UAObject | UAVariable | UAMethod;
    original: UAVariableType | UAObjectType;
}
class CloneHelper {
    public level = 0;
    private readonly mapOrgToClone: Map<string, CloneInfo> = new Map();

    public pad(): string {
        return " ".padEnd(this.level * 2, " ");
    }
    public registerClonedObject<TT extends UAVariableType | UAObjectType, T extends UAObject | UAVariable | UAMethod>(
        objInType: TT,
        clonedObj: T
    ) {
        this.mapOrgToClone.set(objInType.nodeId.toString(), {
            cloned: clonedObj,
            original: objInType
        });

        //
        //   /-----------------------------\
        //   | AcknowledgeableConditionType |
        //   \-----------------------------/
        //              ^        |
        //              |        +---------------------|- (EnabledState)   (shadow element)
        //              |
        //   /-----------------------------\
        //   |        AlarmConditionType   |
        //   \-----------------------------/
        //              |
        //              +-------------------------------|- EnabledState    <
        //
        // find also child object with the same browse name that are
        // overridden in the SuperType
        //
        const origParent = _get_parent_as_VariableOrObjectType(objInType);
        if (origParent) {
            let base = origParent.subtypeOfObj;
            while (base) {
                const shadowChild = base.getChildByName(objInType.browseName) as UAObjectType | UAVariableType | null;
                if (shadowChild) {
                    this.mapOrgToClone.set(shadowChild.nodeId.toString(), {
                        cloned: clonedObj,
                        original: shadowChild
                    });
                }
                base = base.subtypeOfObj;
            }
        }
        // find subTypeOf
    }
}
// install properties and components on a instantiated Object
//
// based on their ModelingRule
//  => Mandatory                 => Installed
//  => Optional                  => Not Installed , unless it appear in optionals array
//  => OptionalPlaceHolder       => Not Installed
//  => null (no modelling rule ) => Not Installed
//

function _initialize_properties_and_components<B extends UAObject | UAVariable | UAMethod, T extends UAObjectType | UAVariableType>(
    instance: B,
    topMostType: T,
    typeDefinitionNode: T,
    copyAlsoModellingRules: boolean,
    optionalsMap: OptionalMap,
    extraInfo: CloneHelper
) {
    if (doDebug) {
        debugLog("instance browseName =", instance.browseName.toString());
        debugLog("typeNode         =", typeDefinitionNode.browseName.toString());
        debugLog("optionalsMap     =", Object.keys(optionalsMap).join(" "));

        const c = typeDefinitionNode.findReferencesEx("Aggregates");
        debugLog("typeDefinition aggregates      =", c.map((x) => x.node!.browseName.toString()).join(" "));
    }
    optionalsMap = optionalsMap || {};

    if (sameNodeId(topMostType.nodeId, typeDefinitionNode.nodeId)) {
        return; // nothing to do
    }

    const filter = new MandatoryChildOrRequestedOptionalFilter(instance, optionalsMap);

    doTrace &&
        traceLog(
            chalk.cyan(extraInfo.pad(), "cloning relevant member of typeDefinition class"),
            typeDefinitionNode.browseName.toString()
        );

    const browseNameMap = new Set<string>();

    _clone_children_references(typeDefinitionNode, instance, copyAlsoModellingRules, filter, extraInfo, browseNameMap);

    // now apply recursion on baseTypeDefinition  to get properties and components from base class

    const baseTypeDefinitionNodeId = typeDefinitionNode.subtypeOf;
    const baseTypeDefinition = typeDefinitionNode.subtypeOfObj!;

    doTrace &&
        traceLog(
            chalk.cyan(
                extraInfo.pad(),
                "now apply recursion on baseTypeDefinition  to get properties and components from base class"
            ),
            baseTypeDefinition.browseName.toString()
        );

    // istanbul ignore next
    if (!baseTypeDefinition) {
        throw new Error(chalk.red("Cannot find object with nodeId ") + baseTypeDefinitionNodeId);
    }
    extraInfo.level++;
    _initialize_properties_and_components(
        instance,
        topMostType,
        baseTypeDefinition,
        copyAlsoModellingRules,
        optionalsMap,
        extraInfo
    );
    extraInfo.level--;
}

/**
 * @method hasChildWithBrowseName
 * returns true if the parent object has a child  with the provided browseName
 * @param parent
 * @param childBrowseName
 */
function hasChildWithBrowseName(parent: BaseNode, childBrowseName: QualifiedName): boolean {
    if (!parent) {
        throw Error("Internal error");
    }
    // extract children
    const children = parent.findReferencesAsObject("HasChild", true);

    return (
        children.filter((child: BaseNode) => {
            return child.browseName.name?.toString() === childBrowseName.name?.toString();
        }).length > 0
    );
}

function getParent(addressSpace: IAddressSpace, options: any) {
    const parent = options.componentOf || options.organizedBy;
    if (parent instanceof NodeId) {
        return addressSpace.findNode(parent as NodeId);
    }
    return parent;
}

export function assertUnusedChildBrowseName(addressSpace: AddressSpacePrivate, options: InstantiateVariableOptions): void {
    const resolveOptionalObject = (node: BaseNode | NodeIdLike | undefined): BaseNode | undefined =>
        node ? addressSpace._coerceNode(node) || undefined : undefined;

    options.componentOf = resolveOptionalObject(options.componentOf);
    options.organizedBy = resolveOptionalObject(options.organizedBy);

    assert(!(options.componentOf && options.organizedBy));

    const parent = getParent(addressSpace, options);
    if (!parent) {
        return;
    }
    assert(parent !== null && typeof parent === "object");
    if (!(parent instanceof BaseNodeImpl)) {
        throw new Error("Invalid parent  parent is " + parent.constructor.name);
    }
    // istanbul ignore next
    // verify that no components already exists in parent
    if (parent && hasChildWithBrowseName(parent, coerceQualifiedName(options.browseName))) {
        throw new Error(
            "object " +
                parent.browseName.name!.toString() +
                " have already a child with browseName " +
                options.browseName.toString()
        );
    }
}

exports.assertUnusedChildBrowseName = assertUnusedChildBrowseName;
exports.initialize_properties_and_components = initialize_properties_and_components;

const hasTypeDefinitionNodeId = makeNodeId(ReferenceTypeIds.HasTypeDefinition);
const hasModellingRuleNodeId = makeNodeId(ReferenceTypeIds.HasModellingRule);

/**
 * remove unwanted reference such as HasTypeDefinition and HasModellingRule
 * from the list
 */
function _remove_unwanted_ref(references: UAReference[]): UAReference[] {
    // filter out HasTypeDefinition (i=40) , HasModellingRule (i=37);
    references = references.filter(
        (reference: UAReference) =>
            !sameNodeId(reference.referenceType, hasTypeDefinitionNodeId) &&
            !sameNodeId(reference.referenceType, hasModellingRuleNodeId)
    );
    return references;
}

/**
 *
 */
function findNonHierarchicalReferences(originalObject: BaseNode): UAReference[] {
    // todo: MEMOIZE this method
    const addressSpace: IAddressSpace = originalObject.addressSpace;
    const referenceId = addressSpace.findReferenceType("NonHierarchicalReferences");
    if (!referenceId) {
        return [];
    }
    assert(referenceId);

    // we need to explore the non hierarchical references backwards
    let references = originalObject.findReferencesEx("NonHierarchicalReferences", BrowseDirection.Inverse);

    references = ([] as UAReference[]).concat(
        references,
        originalObject.findReferencesEx("HasEventSource", BrowseDirection.Inverse)
    );

    const parent = _get_parent_as_VariableOrObjectType(originalObject);

    if (parent && parent.subtypeOfObj) {
        // parent is a ObjectType or VariableType and is not a root type
        assert(parent.nodeClass === NodeClass.VariableType || parent.nodeClass === NodeClass.ObjectType);

        // let investigate the same child base child
        const child = parent.subtypeOfObj!.getChildByName(originalObject.browseName);

        if (child) {
            const baseRef = findNonHierarchicalReferences(child);
            references = ([] as UAReference[]).concat(references, baseRef);
        }
    }
    // perform some cleanup
    references = _remove_unwanted_ref(references);

    return references;
}

function reconstructNonHierarchicalReferences(extraInfo: any): void {
    const findImplementedObject = (ref: UAReference): CloneInfo | null =>
        extraInfo.mapOrgToClone.get(ref.nodeId.toString()) || null;

    // navigate through original objects to find those that are being references by node that
    // have been cloned .
    // this could be node organized by some FunctionalGroup
    //
    for (const { original, cloned } of extraInfo.mapOrgToClone.values()) {
        // find NonHierarchical References on original object
        const originalNonHierarchical = findNonHierarchicalReferences(original);

        if (originalNonHierarchical.length === 0) {
            continue;
        }

        // istanbul ignore next
        if (doDebug) {
            debugLog(
                " investigation ",
                original.browseName.toString(),
                cloned.nodeClass.toString(),
                original.nodeClass.toString(),
                original.nodeId.toString(),
                cloned.nodeId.toString()
            );
        }

        for (const ref of originalNonHierarchical) {
            const info = findImplementedObject(ref);

            // if the object pointed by this reference is also cloned ...
            if (info) {
                const originalDest = info.original;
                const cloneDest = info.cloned;

                // istanbul ignore next
                if (doDebug) {
                    debugLog(
                        chalk.cyan("   adding reference "),
                        ref.referenceType,
                        " from cloned ",
                        cloned.nodeId.toString(),
                        cloned.browseName.toString(),
                        " to cloned ",
                        cloneDest.nodeId.toString(),
                        cloneDest.browseName.toString()
                    );
                }

                // restore reference
                cloned.addReference({
                    isForward: false,
                    nodeId: cloneDest.nodeId,
                    referenceType: ref.referenceType
                });
            }
        }
    }
}

/**
 * recreate functional group types according to type definition
 *
 * @method reconstructFunctionalGroupType
 * @param baseType
 */

/* @example:
 *
 *    MyDeviceType
 *        |
 *        +----------|- ParameterSet(BaseObjectType)
 *        |                   |
 *        |                   +-----------------|- Parameter1
 *        |                                             ^
 *        +----------|- Config(FunctionalGroupType)     |
 *                                |                     |
 *                                +-------- Organizes---+
 */
function reconstructFunctionalGroupType(extraInfo: any) {
    // navigate through original objects to find those that are being organized by some FunctionalGroup
    for (const { original, cloned } of extraInfo.mapOrgToClone.values()) {
        const organizedByArray = original.findReferencesEx("Organizes", BrowseDirection.Inverse);

        for (const ref of organizedByArray) {
            const info = extraInfo.mapOrgToClone.get(ref.nodeId.toString());
            if (!info) continue;

            const folder = info.original;

            assert(folder.typeDefinitionObj.browseName.name.toString() === "FunctionalGroupType");

            // now create the same reference with the instantiated function group
            const destFolder = info.cloned;

            assert(ref.referenceType);

            destFolder.addReference({
                isForward: !ref.isForward,
                nodeId: cloned.nodeId,
                referenceType: ref.referenceType
            });
        }
    }
}

export function initialize_properties_and_components<
    B extends UAObject | UAVariable | UAMethod,
    T extends UAVariableType | UAObjectType
>(instance: B, topMostType: T, nodeType: T, copyAlsoModellingRules: boolean, optionals?: string[]): void {
    const extraInfo = new CloneHelper();

    extraInfo.registerClonedObject(nodeType, instance);

    const optionalsMap = makeOptionalsMap(optionals);

    _initialize_properties_and_components(instance, topMostType, nodeType, copyAlsoModellingRules, optionalsMap, extraInfo);

    reconstructFunctionalGroupType(extraInfo);

    reconstructNonHierarchicalReferences(extraInfo);
}
