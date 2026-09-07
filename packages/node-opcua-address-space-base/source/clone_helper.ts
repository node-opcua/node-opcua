import { assert } from "node-opcua-assert";
import { ReferenceTypeIds } from "node-opcua-constants";
import { BrowseDirection, NodeClass, type QualifiedName } from "node-opcua-data-model";
import { checkDebugFlag, make_errorLog } from "node-opcua-debug";
import { makeNodeId, type NodeIdLike, sameNodeId } from "node-opcua-nodeid";
import type { IAddressSpace } from "./address_space.js";
import type { BaseNode } from "./base_node.js";
import type { UAMethod } from "./ua_method.js";
import type { UAObject } from "./ua_object.js";
import type { UAObjectType } from "./ua_object_type.js";
import type { UAReference } from "./ua_reference.js";
import type { UAVariable } from "./ua_variable.js";
import type { UAVariableType } from "./ua_variable_type.js";

const errorLog = make_errorLog("INSTANTIATE");
const doTrace = checkDebugFlag("INSTANTIATE");
const traceLog = errorLog;

type UAConcrete = UAVariable | UAObject | UAMethod;

/* c8 ignore start */
/**
 * @private
 */
export function fullPath(node: BaseNode): string {
    const browseName = node.browseName.toString();

    const parent = node.findReferencesExAsObject("Aggregates", BrowseDirection.Inverse)[0];
    if (parent) {
        return `${fullPath(parent)}/${browseName}`;
    }
    const containingFolder = node.findReferencesExAsObject("Organizes", BrowseDirection.Inverse)[0];
    if (containingFolder) {
        return `${fullPath(containingFolder)}@${browseName}`;
    }
    return browseName;
}
/** @private */
export function fullPath2(node: BaseNode | null | undefined): string {
    if (!node) return "(unknown)";
    return `${fullPath(node)} (${node.nodeId.toString()})`;
}
/** @private */
export function exploreNode(node: BaseNode) {
    const f = (n: BaseNode) => {
        return `${n.browseName.toString()} (${n.nodeId.toString()})${n.modellingRule ? ` - ${n.modellingRule}` : ""}`;
    };
    const r = (r: NodeIdLike) => {
        const ref = node.addressSpace.findNode(r);
        if (!ref) return `(unknown)`;
        return `${ref?.browseName.toString()} ${ref?.nodeId.toString()}`;
    };
    const map = new Set();
    const _explore = (node: BaseNode, pad: string) => {
        const a = node.findReferencesEx("Aggregates", BrowseDirection.Forward);
        const b = node.findReferencesEx("Organizes", BrowseDirection.Forward);

        for (const ref of [...a, ...b]) {
            if (!ref.node) continue;
            const alreadyVisited = map.has(ref.nodeId.toString());
            traceLog(
                pad,
                "  +-- ",
                r(ref.referenceType).padEnd(20),
                "-->",
                f(ref.node).padEnd(10),
                alreadyVisited ? " (already visited)" : ""
            );
            if (alreadyVisited) {
                continue;
            }
            map.add(ref.nodeId.toString());
            _explore(ref.node, `${pad}   `);
        }
    };
    traceLog("exploring ", f(node));
    _explore(node, "   ");
}
//
//  case 1:
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
// find also child object with the same browse name that is overridden in the SuperType
//
// case 2:
//
//   /-----------------------------\
//   | MyDeviceType               |
//   \-----------------------------/
//              ^        |
//              |        |       +----------+
//              |        +-------| Folder1  |
//              |                +----------+
//              |                     |
//              |                     +--------------|- (EnabledState)   (shadow element)
//              |
//   /-----------------------------\
//   | MyDeriveDeviceType   |
//   \-----------------------------/
//              |
//              |        |       +----------+
//              |        +-------| Folder1  |
//              |                +----------+
//              |                     |
//              |                     +--------------|- (EnabledState)
//
// find also child object with the same browse name that is overridden in the same child of the SuperType

interface ParentTypeAndPath {
    parentType: UAVariableType | UAObjectType;
    path: QualifiedName[];
}

/**
 * every (type, path) pair through which `originalObject` is declared: one per chain of
 * hierarchical parents that ends on an ObjectType or VariableType. A node that a companion
 * specification shares between two parents (OPC 40700 reaches MachineryOperationMode by HasAddIn
 * from MachineryBuildingBlocks and by HasComponent from Monitoring.Status) has one entry per
 * parent; a node declared by no type has none.
 */
function _get_parent_types_and_paths(originalObject: BaseNode, visited: ReadonlySet<string> = new Set()): ParentTypeAndPath[] {
    if (originalObject.nodeClass === NodeClass.Method) {
        return [];
    }
    const key = originalObject.nodeId.toString();
    if (visited.has(key)) {
        return []; // a cycle in the hierarchy: this branch leads nowhere
    }
    const branchVisited = new Set(visited).add(key);
    const addressSpace = originalObject.addressSpace;
    const result: ParentTypeAndPath[] = [];
    for (const parentRef of originalObject.findReferencesEx("HasChild", BrowseDirection.Inverse)) {
        const theParent = addressSpace.findNode(parentRef.nodeId);
        if (!theParent) continue;
        if (theParent.nodeClass === NodeClass.VariableType || theParent.nodeClass === NodeClass.ObjectType) {
            result.push({ parentType: theParent as UAVariableType | UAObjectType, path: [originalObject.browseName] });
            continue;
        }
        for (const { parentType, path } of _get_parent_types_and_paths(theParent, branchVisited)) {
            result.push({ parentType, path: [...path, originalObject.browseName] });
        }
    }
    return result;
}

/**
 * the declaration of `originalObject` nearest to a type: the shortest of its (type, path) pairs,
 * so a child declared directly on a type wins over the same node reached through a folder
 */
function _get_parent_type_and_path(originalObject: BaseNode): {
    parentType: null | UAVariableType | UAObjectType;
    path: QualifiedName[];
} {
    const all = _get_parent_types_and_paths(originalObject);
    if (all.length === 0) {
        return { parentType: null, path: [] };
    }
    return all.reduce((best, candidate) => (candidate.path.length < best.path.length ? candidate : best));
}
/* c8 ignore stop */

interface CloneInfo {
    cloned: UAObject | UAVariable | UAMethod;
    original: UAObject | UAVariable | UAMethod | UAVariableType | UAObjectType;
}

function followPath(node: BaseNode, path: QualifiedName[]): UAConcrete | null {
    let current = node;
    for (const qn of path) {
        const ref = current
            .findReferencesExAsObject("HierarchicalReferences", BrowseDirection.Forward)
            .find((r) => r.browseName.toString() === qn.toString());
        if (!ref) {
            return null;
        }
        current = ref;
    }
    return current as UAConcrete;
}

type Context = Map<string, CloneInfo>;

export class CloneHelper {
    public level = 0;
    private _context: Context | null = null;
    private _contextStack: Context[] = [];
    private readonly mapTypeInstanceChildren: Map<string, Map<string, CloneInfo>> = new Map();
    public pad(): string {
        return " ".padEnd(this.level * 2, " ");
    }

    /** each context in turn: the (original -> cloned) map of one type/instance pair */
    public forEachContext(callback: (context: ReadonlyMap<string, CloneInfo>) => void): void {
        for (const map of this.mapTypeInstanceChildren.values()) {
            callback(map);
        }
    }

    public getClonedArray() {
        const result: CloneInfo[] = [];
        for (const map of this.mapTypeInstanceChildren.values()) {
            for (const cloneInfo of map.values()) {
                result.push(cloneInfo);
            }
        }
        return result;
    }

    public pushContext<
        TO extends UAObject | UAVariable | UAMethod | UAObjectType | UAVariableType,
        TC extends UAObject | UAVariable | UAMethod
    >({ clonedParent, originalParent }: { clonedParent: TC; originalParent: TO }): void {
        // c8 ignore next
        doTrace &&
            traceLog("push context: ", "original parent = ", fullPath2(originalParent), "cloned parent =", fullPath2(clonedParent));

        const typeInstance = originalParent.nodeId.toString() + clonedParent.nodeId.toString();

        // c8 ignore next
        doTrace && traceLog("typeInstance (1) = ", typeInstance, fullPath2(originalParent), fullPath2(clonedParent));

        let a = this.mapTypeInstanceChildren.get(typeInstance);
        if (a) {
            throw new Error("Internal Error");
        }
        a = new Map<string, CloneInfo>();
        this.mapTypeInstanceChildren.set(typeInstance, a);

        if (this._context) {
            this._contextStack.push(this._context);
        }
        this._context = a;
    }
    public popContext() {
        assert(this._contextStack.length > 0);
        this._context = this._contextStack.pop() || null;
    }
    public registerClonedObject<
        TO extends UAObject | UAVariable | UAMethod | UAObjectType | UAVariableType,
        TC extends UAObject | UAVariable | UAMethod
    >({ clonedNode, originalNode }: { clonedNode: TC; originalNode: TO }): void {
        if (!this._context) {
            this.pushContext({ clonedParent: clonedNode, originalParent: originalNode });
        }
        // c8 ignore next
        doTrace &&
            traceLog("registerClonedObject", "originalNode = ", fullPath2(originalNode), "clonedNode =", fullPath2(clonedNode));

        const insertShadow = (map: Map<string, CloneInfo>) => {
            // the same path on every supertype of every type that declares this node: what a
            // subtype re-declares shadows what its base declared
            for (const { parentType, path } of _get_parent_types_and_paths(originalNode)) {
                let base = parentType.subtypeOfObj;
                while (base) {
                    const shadowChild = followPath(base, path);
                    if (shadowChild) {
                        // c8 ignore next
                        doTrace && traceLog("shadowChild = ", fullPath2(shadowChild));
                        map.set(shadowChild.nodeId.toString(), {
                            cloned: clonedNode,
                            original: shadowChild
                        });
                    }
                    base = base.subtypeOfObj;
                }
            }
        };
        // find subTypeOf

        if (!this._context) {
            throw new Error("internal error: Cannot find context");
        }
        // also create  [Type+Instance] map
        // to do so we need to find the TypeDefinition of the originalNode
        this._context.set(originalNode.nodeId.toString(), {
            cloned: clonedNode,
            original: originalNode
        });
        insertShadow(this._context);
    }
    public getCloned({
        originalParent,
        clonedParent,
        originalNode
    }: {
        originalParent: BaseNode;
        clonedParent: BaseNode;
        originalNode: UAVariable | UAObject;
    }): UAObject | UAVariable | UAMethod | null {
        //
        //  Type                                                 Instance
        //    +-> Folder (A)                                         +-> Folder (A')
        //    |      |                                               |     |
        //    |      +- Component (B)                                |     +- Component (B')
        //    °-> Folder (C)       [parentNode]                      +-> Folder (C')          <= [clonedParent]
        //          |                                                      |
        //          +- Component (B again !)  [originalNode]               +- Component (B again !)

        // c8 ignore next
        doTrace &&
            traceLog(
                "typeInstance (3) = originalParent",
                fullPath2(originalParent),
                "originalNode=",
                fullPath2(originalNode),
                "clonedParent",
                fullPath2(clonedParent)
            );

        const info = this._context?.get(originalNode.nodeId.toString());
        if (info) {
            return info.cloned;
        }
        return null;
    }
}

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
    const _addressSpace: IAddressSpace = originalObject.addressSpace;

    // we need to explore the non hierarchical references backwards
    let references = originalObject.findReferencesEx("NonHierarchicalReferences", BrowseDirection.Inverse);

    references = ([] as UAReference[]).concat(
        references,
        originalObject.findReferencesEx("HasEventSource", BrowseDirection.Inverse)
    );

    const { parentType, path } = _get_parent_type_and_path(originalObject);

    if (parentType?.subtypeOfObj) {
        // parent is a ObjectType or VariableType and is not a root type
        assert(parentType.nodeClass === NodeClass.VariableType || parentType.nodeClass === NodeClass.ObjectType);

        // let investigate the same child base child
        const child = followPath(parentType.subtypeOfObj, path);
        if (child) {
            const baseRef = findNonHierarchicalReferences(child);
            references = ([] as UAReference[]).concat(references, baseRef);
        }
    }
    // perform some cleanup
    references = _remove_unwanted_ref(references);

    return references;
}

const findImplementedObject = (cloneInfoArray: CloneInfo[], ref: UAReference): CloneInfo | null => {
    const a = cloneInfoArray.filter((x) => x.original.nodeId.toString() === ref.nodeId.toString());
    if (a.length === 0) return null;
    const info = a[0];
    return info;
};

export function reconstructNonHierarchicalReferences(extraInfo: CloneHelper): void {
    const cloneInfoArray: CloneInfo[] = extraInfo.getClonedArray();

    // navigate through original objects to find those that are being references by node that
    // have been cloned .
    // this could be node organized by some FunctionalGroup

    // c8 ignore next
    doTrace && traceLog("reconstructNonHierarchicalReferences");

    for (const { original, cloned } of cloneInfoArray) {
        apply(original, cloned);
    }

    function apply(original: BaseNode, cloned: BaseNode) {
        const addressSpace = original.addressSpace;
        // find NonHierarchical References on original object
        const originalNonHierarchical = findNonHierarchicalReferences(original);

        if (originalNonHierarchical.length === 0) {
            return;
        }

        // c8 ignore next
        doTrace && traceLog(" investigation ", "original", fullPath2(original), NodeClass[cloned.nodeClass], fullPath2(cloned));

        for (const ref of originalNonHierarchical) {
            const info = findImplementedObject(cloneInfoArray, ref);
            if (!info) continue;

            // if the object pointed by this reference is also cloned ...

            const _originalDest = info.original;
            const cloneDest = info.cloned;

            // c8 ignore next
            doTrace &&
                traceLog(
                    "   adding reference ",
                    fullPath2(addressSpace.findNode(ref.referenceType)),
                    " from cloned ",
                    fullPath2(cloned),
                    " to cloned ",
                    fullPath2(cloneDest)
                );

            // restore reference
            cloned.addReference({
                isForward: false,
                nodeId: cloneDest.nodeId,
                referenceType: ref.referenceType
            });
        }
    }
}

/**
 * recreate functional group types according to type definition
 *

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
export function reconstructFunctionalGroupType(extraInfo: CloneHelper) {
    const cloneInfoArray: CloneInfo[] = extraInfo.getClonedArray();

    // navigate through original objects to find those that are being organized by some FunctionalGroup
    for (const { original, cloned } of cloneInfoArray) {
        const organizedByArray = original.findReferencesEx("Organizes", BrowseDirection.Inverse);
        for (const ref of organizedByArray) {
            const info = findImplementedObject(cloneInfoArray, ref);
            if (!info) continue;

            const folder = info.original;
            if (folder.nodeClass !== NodeClass.Object) continue;

            if (!folder.typeDefinitionObj) continue;

            if (folder.typeDefinitionObj.browseName.name?.toString() !== "FunctionalGroupType") {
                continue;
            }

            // now create the same reference with the instantiated function group
            const destFolder = info.cloned as BaseNode;

            assert(ref.referenceType);

            // may be we should check that the referenceType is a subtype of Organizes
            const alreadyExist = destFolder
                .findReferences(ref.referenceType, !ref.isForward)
                .find((r) => r.nodeId === cloned.nodeId);
            if (alreadyExist) {
                continue;
            }

            destFolder.addReference({
                isForward: !ref.isForward,
                nodeId: cloned.nodeId,
                referenceType: ref.referenceType
            });
        }
    }
}

/**
 * A node that a type declares under two hierarchical parents is instantiated once, under whichever
 * parent the walk reached first: OPC 40700 shares MachineryOperationMode between
 * MachineryBuildingBlocks (HasAddIn) and Monitoring.Status (HasComponent). This pass gives the
 * instance the other parent references: for every cloned node, every hierarchical parent of its
 * original that was cloned in the same context gets the same reference to the clone, unless it
 * has it already. Nothing is instantiated here: a parent that was not requested stays absent.
 */
export function reconstructSharedHierarchicalReferences(extraInfo: CloneHelper): void {
    extraInfo.forEachContext((context) => {
        for (const { original, cloned } of context.values()) {
            if (original.nodeClass === NodeClass.ObjectType || original.nodeClass === NodeClass.VariableType) {
                continue;
            }
            for (const ref of original.findReferencesEx("HasChild", BrowseDirection.Inverse)) {
                const parentInfo = context.get(ref.nodeId.toString());
                if (!parentInfo || parentInfo.cloned === cloned) {
                    continue;
                }
                const clonedParent = parentInfo.cloned;
                const already = clonedParent
                    .findReferences(ref.referenceType, true)
                    .some((r) => sameNodeId(r.nodeId, cloned.nodeId));
                if (already) {
                    continue;
                }
                // c8 ignore next
                doTrace && traceLog("   restoring parent reference ", fullPath2(clonedParent), "->", fullPath2(cloned));
                clonedParent.addReference({
                    isForward: true,
                    nodeId: cloned.nodeId,
                    referenceType: ref.referenceType
                });
            }
        }
    });
}
