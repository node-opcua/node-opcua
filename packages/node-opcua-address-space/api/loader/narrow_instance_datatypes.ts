/**
 * @module node-opcua-address-space
 */
import type {
    BaseNode,
    IAddressSpace,
    UADataType,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariable,
    UAVariableType
} from "node-opcua-address-space-base";
import { BrowseDirection, NodeClass, type QualifiedName } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { type NodeId, sameNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import type { NamespacePrivate } from "../../impl/namespace_private.js";

const doDebug = checkDebugFlag("narrow_instance_datatypes");
const debugLog = make_debugLog("narrow_instance_datatypes");

type UAType = UAObjectType | UAVariableType;
type UAInstance = UAObject | UAVariable;

function isType(node: BaseNode): node is UAType {
    return node.nodeClass === NodeClass.ObjectType || node.nodeClass === NodeClass.VariableType;
}
function isInstance(node: BaseNode): node is UAInstance {
    return node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable;
}

/**
 * the type definition of an instance, resolved without the ObjectType/VariableType guards of the
 * typed getters: a companion nodeset with a wrong type definition must not abort the sweep
 */
function typeDefinitionOf(addressSpace: IAddressSpace, node: UAInstance): UAType | null {
    const typeDefinition: NodeId | undefined = node.typeDefinition;
    if (!typeDefinition || typeDefinition.isEmpty()) {
        return null;
    }
    const typeNode = addressSpace.findNode(typeDefinition);
    return typeNode && isType(typeNode) ? typeNode : null;
}

/**
 * the members a type declares, by browse name, looked up along its supertype chain and its
 * interfaces the way `instantiate` collects them (see impl/_instantiate_helpers.ts); the answer
 * is cached per (type, browse name) so a sweep over thousands of instances of the same type
 * walks the chain once per member
 */
class DeclarationIndex {
    private readonly cache = new Map<string, BaseNode | null>();
    /** absent from a standard nodeset older than 1.04: then no type has interfaces to look into */
    private readonly hasInterface: UAReferenceType | null;
    private readonly hasModellingRule: UAReferenceType;

    constructor(
        private readonly addressSpace: IAddressSpace,
        hasModellingRule: UAReferenceType
    ) {
        this.hasInterface = addressSpace.findReferenceType("HasInterface") ?? null;
        this.hasModellingRule = hasModellingRule;
    }

    /**
     * whether `declared` is a member declaration a variable instance must honour: a variable with
     * a modelling rule (Mandatory, Optional, ...). A type child without one is not instantiated by
     * Part 3 and is left alone.
     */
    public isVariableDeclaration(declared: BaseNode): declared is UAVariable {
        return (
            declared.nodeClass === NodeClass.Variable &&
            declared.findReferencesEx(this.hasModellingRule, BrowseDirection.Forward).length > 0
        );
    }

    public find(type: UAType, browseName: QualifiedName): BaseNode | null {
        const key = `${type.nodeId.toString()}|${browseName.toString()}`;
        const cached = this.cache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        const found = this.walk(type, browseName, new Set<string>());
        this.cache.set(key, found);
        return found;
    }

    private walk(type: UAType, browseName: QualifiedName, visited: Set<string>): BaseNode | null {
        const typeKey = type.nodeId.toString();
        if (visited.has(typeKey)) {
            return null;
        }
        visited.add(typeKey);
        const child = type.getChildByName(browseName);
        if (child) {
            return child;
        }
        const interfaces = this.hasInterface ? type.findReferencesEx(this.hasInterface, BrowseDirection.Forward) : [];
        for (const reference of interfaces) {
            const interfaceType = reference.node ?? this.addressSpace.findNode(reference.nodeId);
            if (interfaceType && isType(interfaceType)) {
                const declared = this.walk(interfaceType, browseName, visited);
                if (declared) {
                    return declared;
                }
            }
        }
        const superType = type.subtypeOfObj as UAType | null;
        return superType ? this.walk(superType, browseName, visited) : null;
    }
}

// a parent chain deeper than this is a cycle in a broken nodeset, not a model
const MAX_DEPTH = 64;

/**
 * the node of a type definition that declares this instance member, or null when no type in
 * the instance's ancestry declares one under its browse name.
 *
 * The declaration is looked up in the type definition of the containing instance first; a
 * member nested below a declared member (an object declared by the type with children of its
 * own, whose own type definition says nothing about them) is found through the declaration of
 * its container instead.
 */
function declarationOf(addressSpace: IAddressSpace, index: DeclarationIndex, node: UAInstance, depth: number): BaseNode | null {
    if (depth > MAX_DEPTH) {
        return null;
    }
    const parent = node.parent;
    // a node under a type is a declaration itself, never an instance to narrow
    if (!parent || isType(parent)) {
        return null;
    }
    const parentIsInstance = isInstance(parent);
    if (parentIsInstance) {
        const parentType = typeDefinitionOf(addressSpace, parent);
        if (parentType) {
            const declared = index.find(parentType, node.browseName);
            if (declared) {
                return declared;
            }
        }
    }
    // the container may itself be a declared member (an instance, or a method) whose declaration
    // carries the member; a method has no type definition and is resolved the same way
    if (parentIsInstance || parent.nodeClass === NodeClass.Method) {
        const parentDeclaration = declarationOf(addressSpace, index, parent as UAInstance, depth + 1);
        if (parentDeclaration) {
            return parentDeclaration.getChildByName(node.browseName);
        }
    }
    return null;
}

function findDataTypeNode(addressSpace: IAddressSpace, nodeId: NodeId): UADataType | null {
    if (!nodeId || nodeId.isEmpty()) {
        return null;
    }
    return addressSpace.findDataType(nodeId) ?? null;
}

/** where a variable keeps the built-in type it derived from its DataType (see impl/get_basic_datatype.ts) */
interface VariableWithBasicDataTypeCache {
    _basicDataType?: DataType | null;
}

export interface NarrowedDataType {
    node: UAVariable;
    from: NodeId;
    to: NodeId;
}

/**
 * make every instance variable's DataType at least as narrow as its declaration.
 *
 * OPC 10000-3 lets an instance use the DataType its type definition declares for the member, or
 * a subtype of it; a supertype is not conformant. Companion nodesets that predate a narrowing
 * of the standard types carry the supertype anyway (every NamespaceMetadata object written
 * against UA 1.04 declares `ModelVersion` as String, which UA 1.05 narrowed to
 * SemanticVersionString), so every server loading them fails the type-conformance check of
 * the CTT (Base Info Core Structure) and no server can fix it per nodeset. The declared type is
 * what the model means: an instance whose DataType is a strict supertype of the declared one is
 * moved to the declared one.
 *
 * Nothing else moves: an instance whose DataType is the declared one, a subtype of it, or
 * unrelated is left alone, values are never touched, and the children of types are declarations,
 * not instances. A variable whose current value would not fit the declared built-in type is
 * left alone as well, and reported: narrowing it would make the value lie about its type.
 *
 * @returns the variables that were narrowed
 */
export function narrowInstanceDataTypes(addressSpace: IAddressSpace): NarrowedDataType[] {
    const narrowed: NarrowedDataType[] = [];
    // a nodeset without these cannot declare a member, let alone the DataType of one: a
    // minimal fixture, or a standard nodeset still to come. Nothing to narrow, and the lookups
    // below would throw on the first missing reference type.
    const hasModellingRule = addressSpace.findReferenceType("HasModellingRule");
    if (
        !hasModellingRule ||
        !addressSpace.findReferenceType("HasSubtype") ||
        !addressSpace.findReferenceType("HasChild") ||
        !addressSpace.findReferenceType("HierarchicalReferences")
    ) {
        return narrowed;
    }
    const index = new DeclarationIndex(addressSpace, hasModellingRule);

    for (const namespace of addressSpace.getNamespaceArray()) {
        for (const node of (namespace as NamespacePrivate).nodeIterator()) {
            if (node.nodeClass !== NodeClass.Variable) {
                continue;
            }
            const variable = node as UAVariable;
            const declared = declarationOf(addressSpace, index, variable, 0);
            if (!declared || !index.isVariableDeclaration(declared)) {
                continue;
            }
            if (sameNodeId(variable.dataType, declared.dataType)) {
                continue;
            }
            const instanceDataType = findDataTypeNode(addressSpace, variable.dataType);
            const declaredDataType = findDataTypeNode(addressSpace, declared.dataType);
            if (!instanceDataType || !declaredDataType) {
                continue;
            }
            // a subtype of the declaration, or an unrelated type: not this sweep's business
            if (!declaredDataType.isSubtypeOf(instanceDataType)) {
                continue;
            }
            const value = variable.readValue().value;
            const declaredBuiltInType = declaredDataType.basicDataType;
            const valueFits =
                value.dataType === DataType.Null ||
                declaredBuiltInType === DataType.Variant ||
                value.dataType === declaredBuiltInType;
            if (!valueFits) {
                debugLog(
                    `not narrowing ${variable.nodeId.toString()} ${variable.browseName.toString()}: ` +
                        `its value is a ${DataType[value.dataType]}, the declared ${declaredDataType.browseName.toString()} ` +
                        `is a ${DataType[declaredBuiltInType]}`
                );
                continue;
            }
            const from = variable.dataType;
            variable.dataType = declaredDataType.nodeId;
            (variable as unknown as VariableWithBasicDataTypeCache)._basicDataType = null;
            narrowed.push({ node: variable, from, to: declaredDataType.nodeId });
            // c8 ignore next
            if (doDebug) {
                debugLog(
                    `narrowed the DataType of ${variable.nodeId.toString()} ${variable.browseName.toString()} ` +
                        `from ${instanceDataType.browseName.toString()} (${from.toString()}) ` +
                        `to the declared ${declaredDataType.browseName.toString()} (${declaredDataType.nodeId.toString()})`
                );
            }
        }
    }
    // c8 ignore next
    if (doDebug && narrowed.length > 0) {
        debugLog(`narrowed the DataType of ${narrowed.length} instance variable(s) to the one their type declares`);
    }
    return narrowed;
}
