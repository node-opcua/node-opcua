/**
 * @module node-opcua-address-space
 */
// tslint:disable:max-classes-per-file
// tslint:disable:no-console
import * as chalk from "chalk";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import { UInt32 } from "node-opcua-basic-types";
import { NodeClass } from "node-opcua-data-model";
import { BrowseDirection } from "node-opcua-data-model";
import { AttributeIds } from "node-opcua-data-model";
import { DataValue, DataValueLike } from "node-opcua-data-value";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { coerceNodeId, makeNodeId, NodeId, NodeIdLike, sameNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { isNullOrUndefined } from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import { Variant } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";

import {
    AddressSpace,
    AddVariableOptions,
    BaseNode as BaseNodePublic,
    InstantiateVariableOptions,
    makeOptionalsMap,
    Namespace,
    UAMethod as UAMethodPublic,
    UAObject as UAObjectPublic,
    UAObjectType as UAObjectTypePublic,
    UAReference,
    UAVariable as UAVariablePublic,
    UAVariableType as UAVariableTypePublic
} from "../source";

import { AddressSpacePrivate } from "./address_space_private";
import { BaseNode } from "./base_node";
import { _clone_children_references, ToStringBuilder, UAVariable_toString, UAVariableType_toString } from "./base_node_private";
import { Reference } from "./reference";
import { SessionContext } from "./session_context";
import * as tools from "./tool_isSupertypeOf";
import { get_subtypeOfObj } from "./tool_isSupertypeOf";
import { get_subtypeOf } from "./tool_isSupertypeOf";
import { UAObjectType } from "./ua_object_type";
import { UAVariable, adjust_accessLevel, adjust_userAccessLevel, verifyRankAndDimensions } from "./ua_variable";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

export class UAVariableType extends BaseNode implements UAVariableTypePublic {
    public readonly nodeClass = NodeClass.VariableType;

    public get subtypeOf(): NodeId | null {
        return get_subtypeOf.call(this);
    }

    public get subtypeOfObj(): UAVariableType | null {
        return get_subtypeOfObj.call(this) as UAVariableType;
    }

    public isSupertypeOf = tools.construct_isSupertypeOf<UAVariableTypePublic>(UAVariableType);

    public readonly isAbstract: boolean;
    public dataType: NodeId;
    public valueRank: number;
    public arrayDimensions: UInt32[] | null;
    public readonly minimumSamplingInterval: number;
    public readonly value: any;
    public historizing: boolean;

    constructor(options: any) {
        super(options);

        verifyRankAndDimensions(options);
        this.valueRank = options.valueRank;
        this.arrayDimensions = options.arrayDimensions;

        this.minimumSamplingInterval = 0;

        this.historizing = isNullOrUndefined(options.historizing) ? false : options.historizing;
        this.isAbstract = isNullOrUndefined(options.isAbstract) ? false : options.isAbstract;

        this.value = options.value; // optional default value for instances of this UAVariableType

        this.dataType = coerceNodeId(options.dataType); // DataType (NodeId)

        if (options.value) {
            this.value = new Variant(options.value);
            // xx console.log("setting ",this.value.toString());
        }
    }

    public readAttribute(context: SessionContext | null, attributeId: AttributeIds) {
        assert(!context || context instanceof SessionContext);

        const options: DataValueLike = {};
        switch (attributeId) {
            case AttributeIds.IsAbstract:
                options.value = { dataType: DataType.Boolean, value: this.isAbstract ? true : false };
                options.statusCode = StatusCodes.Good;
                break;
            case AttributeIds.Value:
                if (this.hasOwnProperty("value") && this.value !== undefined) {
                    assert(this.value.schema.name === "Variant");
                    options.value = this.value;
                    options.statusCode = StatusCodes.Good;
                } else {
                    debugLog(" warning Value not implemented");
                    options.value = { dataType: DataType.UInt32, value: 0 };
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
     * @method instantiate
     * @param options
     * @param options.browseName
     * @param [options.description]
     * @param [options.organizedBy]   the parent Folder holding this object
     * @param [options.componentOf]   the parent Object holding this object
     * @param [options.notifierOf]
     * @param [options.eventSourceOf]
     * @param [options.optionals]     array of browseName of optional component/property to instantiate.
     * @param [options.modellingRule]
     * @param [options.minimumSamplingInterval =0]
     * @param [options.extensionObject =null]
     * Note : HasComponent usage scope
     *
     *    Source          |     Destination
     * -------------------+---------------------------
     *  Object            | Object, Variable,Method
     *  ObjectType        |
     * -------------------+---------------------------
     *  DataVariable      | Variable
     *  DataVariableType  |
     *
     *
     *  see : OPCUA 1.03 page 44 $6.4 Instances of ObjectTypes and VariableTypes
     */
    public instantiate(options: InstantiateVariableOptions): UAVariablePublic {
        const addressSpace = this.addressSpace;
        // xx assert(!this.isAbstract, "cannot instantiate abstract UAVariableType");

        assert(options, "missing option object");
        assert(
            typeof options.browseName === "string" || (options.browseName !== null && typeof options.browseName === "object"),
            "expecting a browse name"
        );
        assert(!options.hasOwnProperty("propertyOf"), "Use addressSpace#addVariable({ propertyOf: xxx}); to add a property");

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
            console.warn(" options.dataType", options.dataType ? options.dataType.toString() : "<null>");
            console.warn(" this.dataType", this.dataType ? this.dataType.toString() : "<null>");
            throw new Error(" A valid dataType must be specified");
        }

        const opts: AddVariableOptions = {
            arrayDimensions,
            browseName: options.browseName,
            componentOf: options.componentOf,
            dataType,
            description: options.description || this.description,
            eventSourceOf: options.eventSourceOf,
            minimumSamplingInterval: options.minimumSamplingInterval,
            modellingRule: options.modellingRule,
            nodeId: options.nodeId,
            notifierOf: options.notifierOf,
            organizedBy: options.organizedBy,
            typeDefinition: this.nodeId,
            value: options.value,
            valueRank
        };

        const namespace: Namespace = addressSpace.getOwnNamespace();
        const instance = namespace.addVariable(opts);

        // xx assert(instance.minimumSamplingInterval === options.minimumSamplingInterval);

        initialize_properties_and_components(instance, baseVariableType, this, options.optionals);

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
class MandatoryChildOrRequestedOptionalFilter {
    private readonly instance: BaseNodePublic;
    private readonly optionalsMap: any;
    private readonly references: Reference[];

    constructor(instance: BaseNodePublic, optionalsMap: any) {
        // should we clone the node to be a component or propertyOf of a instance
        assert(optionalsMap !== null && typeof optionalsMap === "object");
        assert(null !== instance);
        this.optionalsMap = optionalsMap;
        this.instance = instance;
        this.references = instance.allReferences();
    }

    public shouldKeep(node: BaseNode): boolean {
        const addressSpace = node.addressSpace;

        const alreadyIn = this.references.filter((r: Reference) => {
            const n = addressSpace.findNode(r.nodeId)!;
            // istanbul ignore next
            if (!n) {
                console.log(" cannot find node ", r.nodeId.toString());
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

        const modellingRule = (node as any).modellingRule;

        switch (modellingRule) {
            case null:
            case undefined:
                return false; // skip
            case "Mandatory":
                return true; // keep;
            case "Optional":
                // only if in requested optionals
                return node.browseName!.name! in this.optionalsMap;
            case "OptionalPlaceHolder":
                return false; // ignored
            default:
                return false; // ignored
        }
    }

    public filterFor(childInstance: UAVariableType) {
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
function _get_parent_as_VariableOrObjectType(originalObject: BaseNodePublic): UAVariableType | UAObjectType | null {
    if (originalObject.nodeClass === NodeClass.Method) {
        return null;
    }

    const addressSpace = originalObject.addressSpace;

    const parents = originalObject.findReferencesEx("HasChild", BrowseDirection.Inverse);

    // istanbul ignore next
    if (parents.length > 1) {
        console.warn(" object ", originalObject.browseName.toString(), " has more than one parent !");
        console.warn(originalObject.toString());
        console.warn(" parents : ");
        for (const parent of parents) {
            console.log("     ", parent.toString(), addressSpace.findNode(parent.nodeId)!.browseName.toString());
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

class CloneHelper {
    private readonly mapOrgToClone: any;

    constructor() {
        this.mapOrgToClone = {};
    }

    public registerClonedObject<
        TT extends UAVariableTypePublic | UAObjectTypePublic,
        T extends UAObjectPublic | UAVariablePublic | UAMethodPublic
    >(objInType: TT, clonedObj: T) {
        this.mapOrgToClone[objInType.nodeId.toString()] = {
            cloned: clonedObj,
            original: objInType
        };

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
                const shadowChild = base.getChildByName(objInType.browseName);
                if (shadowChild) {
                    this.mapOrgToClone[shadowChild.nodeId.toString()] = {
                        cloned: clonedObj,
                        original: shadowChild
                    };
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

function _initialize_properties_and_components<
    B extends UAObjectPublic | UAVariablePublic | UAMethodPublic,
    T extends UAObjectTypePublic | UAVariableTypePublic
>(instance: B, topMostType: T, typeNode: T, optionalsMap: any, extraInfo: any) {
    if (doDebug) {
        console.log("instance browseName =", instance.browseName.toString());
        console.log("typeNode         =", typeNode.browseName.toString());
        console.log("optionalsMap     =", Object.keys(optionalsMap).join(" "));

        const c = typeNode.findReferencesEx("Aggregates");
        console.log("type possibilities      =", c.map((x) => x.node!.browseName.toString()).join(" "));
    }
    optionalsMap = optionalsMap || {};

    if (sameNodeId(topMostType.nodeId, typeNode.nodeId)) {
        return; // nothing to do
    }

    const baseTypeNodeId = typeNode.subtypeOf;
    const baseType = typeNode.subtypeOfObj;

    // istanbul ignore next
    if (!baseType) {
        throw new Error(chalk.red("Cannot find object with nodeId ") + baseTypeNodeId);
    }

    const filter = new MandatoryChildOrRequestedOptionalFilter(instance, optionalsMap);

    _clone_children_references.call(typeNode, instance as BaseNodePublic, filter, extraInfo);

    // get properties and components from base class
    _initialize_properties_and_components(instance, topMostType, baseType, optionalsMap, extraInfo);
}

/**
 * @method hasChildWithBrowseName
 * returns true if the parent object has a child  with the provided browseName
 * @param parent
 * @param childBrowseName
 */
function hasChildWithBrowseName(parent: BaseNode, childBrowseName: string): boolean {
    if (!parent) {
        throw Error("Internal error");
    }
    // extract children
    const children = parent.findReferencesAsObject("HasChild", true);

    return (
        children.filter((child: BaseNodePublic) => {
            return child.browseName.name!.toString() === childBrowseName;
        }).length > 0
    );
}

function getParent(addressSpace: AddressSpace, options: any) {
    const parent = options.componentOf || options.organizedBy;
    if (parent instanceof NodeId) {
        return addressSpace.findNode(parent as NodeId);
    }
    return parent;
}

export function assertUnusedChildBrowseName(addressSpace: AddressSpacePrivate, options: any) {
    function resolveOptionalObject(node: BaseNodePublic): BaseNodePublic | null {
        return node! ? addressSpace._coerceNode(node) : null;
    }

    options.componentOf = resolveOptionalObject(options.componentOf);
    options.organizedBy = resolveOptionalObject(options.organizedBy);

    assert(!(options.componentOf && options.organizedBy));

    const parent = getParent(addressSpace, options);
    if (!parent) {
        return;
    }
    assert(parent !== null && typeof parent === "object");
    if (!(parent instanceof BaseNode)) {
        throw new Error("Invalid parent  parent is " + parent.constructor.name);
    }
    // istanbul ignore next
    // verify that no components already exists in parent
    if (parent && hasChildWithBrowseName(parent, options.browseName)) {
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

const hasTypeDefinitionNodeId = makeNodeId(40);
const hasModellingRuleNodeId = makeNodeId(37);

function _remove_unwanted_ref(references: UAReference[]): UAReference[] {
    // filter out HasTypeDefinition (i=40) , HasModellingRule (i=37);
    references = _.filter(references, (reference: UAReference) => {
        return (
            !sameNodeId(reference.referenceType, hasTypeDefinitionNodeId) &&
            !sameNodeId(reference.referenceType, hasModellingRuleNodeId)
        );
    });
    return references;
}

// todo: MEMOIZE this method
function findNonHierarchicalReferences(originalObject: BaseNodePublic): UAReference[] {
    const addressSpace: AddressSpace = originalObject.addressSpace;
    const referenceId = addressSpace.findReferenceType("NonHierarchicalReferences");
    if (!referenceId) {
        return [];
    }
    assert(referenceId);

    // we need to explore
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
            // xx console.log("  ... ",originalObject.browseName.toString(),
            // parent.browseName.toString(), references.length, baseRef.length);
            references = ([] as UAReference[]).concat(references, baseRef);
        }
    }
    // perform some cleanup
    references = _remove_unwanted_ref(references);

    return references;
}

function reconstructNonHierarchicalReferences(extraInfo: any): any {
    function findImplementedObject(ref: UAReference): any {
        const info = extraInfo.mapOrgToClone[ref.nodeId.toString()];
        if (info) {
            return info;
        }
        return null;
    }

    // navigate through original objects to find those that are being references by node that
    // have been cloned .
    // this could be node organized by some FunctionalGroup
    //
    _.forEach(extraInfo.mapOrgToClone, (value: any, key: any) => {
        const originalObject = value.original;
        const clonedObject = value.cloned;

        // find NonHierarchical References on original object
        const originalNonHierarchical = findNonHierarchicalReferences(originalObject);

        if (originalNonHierarchical.length === 0) {
            return;
        }

        // istanbul ignore next
        if (doDebug) {
            debugLog(
                " investigation ",
                value.original.browseName.toString(),
                value.cloned.nodeClass.toString(),
                value.original.nodeClass.toString(),
                value.original.nodeId.toString(),
                value.cloned.nodeId.toString()
            );
        }

        originalNonHierarchical.forEach((ref: UAReference) => {
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
                        clonedObject.nodeId.toString(),
                        clonedObject.browseName.toString(),
                        " to cloned ",
                        cloneDest.nodeId.toString(),
                        cloneDest.browseName.toString()
                    );
                }

                // restore reference
                clonedObject.addReference({
                    isForward: false,
                    nodeId: cloneDest.nodeId,
                    referenceType: ref.referenceType
                });
            }
        });
    });
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
    _.forEach(extraInfo.mapOrgToClone, (value: any, key: any) => {
        const originalObject = value.original;
        const instantiatedObject = value.cloned;
        const organizedByArray = originalObject.findReferencesEx("Organizes", BrowseDirection.Inverse);

        // function dumpRef(r) {
        //    var referenceTd = addressSpace.findNode(r.referenceTypeId);
        //    var obj = addressSpace.findNode(r.nodeId);
        //    return "<-- " + referenceTd.browseName.toString() + " -- " + obj.browseName.toString();
        // }
        //
        // console.log("xxxxx ========================================================",
        //    originalObject.browseName.toString(),
        //    organizedByArray.map(dumpRef).join("\n"));
        organizedByArray.forEach((ref: Reference) => {
            if (extraInfo.mapOrgToClone.hasOwnProperty(ref.nodeId.toString())) {
                const info = extraInfo.mapOrgToClone[ref.nodeId.toString()];
                const folder = info.original;

                assert(folder.typeDefinitionObj.browseName.name.toString() === "FunctionalGroupType");

                // now create the same reference with the instantiated function group
                const destFolder = info.cloned;

                assert(ref.referenceType);

                destFolder.addReference({
                    isForward: !ref.isForward,
                    nodeId: instantiatedObject.nodeId,
                    referenceType: ref.referenceType
                });
                // xx console.log("xxx ============> adding reference ",ref.browse )
            }
        });
    });
}

export function initialize_properties_and_components<
    B extends UAObjectPublic | UAVariablePublic | UAMethodPublic,
    T extends UAVariableTypePublic | UAObjectTypePublic
>(instance: B, topMostType: T, nodeType: T, optionals?: string[]): void {
    const extraInfo = new CloneHelper();

    extraInfo.registerClonedObject(nodeType, instance);

    const optionalsMap = makeOptionalsMap(optionals);

    _initialize_properties_and_components(instance, topMostType, nodeType, optionalsMap, extraInfo);

    reconstructFunctionalGroupType(extraInfo);

    reconstructNonHierarchicalReferences(extraInfo);
}
