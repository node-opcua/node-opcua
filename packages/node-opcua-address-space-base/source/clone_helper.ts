import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog, make_errorLog, make_warningLog } from "node-opcua-debug";
import { BrowseDirection, NodeClass, QualifiedName } from "node-opcua-data-model";
import { makeNodeId, sameNodeId } from "node-opcua-nodeid";
import { ReferenceTypeIds } from "node-opcua-constants";
import { UAObject } from "./ua_object";
import { UAVariable } from "./ua_variable";
import { UAMethod } from "./ua_method";
import { UAObjectType } from "./ua_object_type";
import { UAVariableType } from "./ua_variable_type";
import { BaseNode } from "./base_node";
import { UAReference } from "./ua_reference";
import { IAddressSpace } from "./address_space";

const warningLog = make_warningLog("CLONE");

const errorLog = make_errorLog(__filename);
const doTrace = checkDebugFlag("INSTANTIATE");
const traceLog = errorLog;

type UAConcrete = UAVariable | UAObject | UAMethod;

// istanbul ignore next
/** @private */
export function fullPath(node: BaseNode): string {
    const browseName = node.browseName.toString();

    const parent = node.findReferencesExAsObject("Aggregates", BrowseDirection.Inverse)[0];
    if (parent) {
        return fullPath(parent) + "/" + browseName;
    }
    const containingFolder = node.findReferencesExAsObject("Organizes", BrowseDirection.Inverse)[0];
    if (containingFolder) {
        return fullPath(containingFolder) + "@" + browseName;
    }
    return browseName;
}
// istanbul ignore next
/** @private */
export function fullPath2(node: BaseNode): string {
    return fullPath(node) + " (" + node.nodeId.toString() + ")";
}

// istanbul ignore next
/** @private */
export function exploreNode(node: BaseNode) {
    const f = (n: BaseNode) => {
        return `${n.browseName.toString()} (${n.nodeId.toString()})${n.modellingRule ? " - " + n.modellingRule : ""}`;
    };
    const r = (r: any) => {
        const ref = node.addressSpace.findNode(r);
        if (!ref) return `${r.nodeId.toString()} (unknown)`;
        return ref?.browseName.toString() + " " + ref!.nodeId.toString();
    };
    const map = new Set();
    const _explore = (node: BaseNode, pad: string) => {
        const a = node.findReferencesEx("Aggregates", BrowseDirection.Forward);
        const b = node.findReferencesEx("Organizes", BrowseDirection.Forward);

        for (const ref of [...a, ...b]) {
            const alreadyVisited = map.has(ref.nodeId.toString());
            traceLog(
                pad,
                "  +-- ",
                r(ref.referenceType).padEnd(20),
                "-->",
                f(ref.node!).padEnd(10),
                alreadyVisited ? " (already visited)" : ""
            );
            if (alreadyVisited) {
                continue;
            }
            map.add(ref.nodeId.toString());
            _explore(ref.node!, pad + "   ");
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
// find also child object with the same browse name that are
// overridden in the SuperType

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
// find also child object with the same browse name that are

function _get_parent_type_and_path(originalObject: BaseNode): {
    parentType: null | UAVariableType | UAObjectType;
    path: QualifiedName[];
} {
    if (originalObject.nodeClass === NodeClass.Method) {
        return { parentType: null, path: [] };
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
        return { parentType: null, path: [] };
    }

    assert(parents.length === 0 || parents.length === 1);
    if (parents.length === 0) {
        return { parentType: null, path: [] };
    }
    const theParent = addressSpace.findNode(parents[0]!.nodeId)!;
    if (theParent && (theParent.nodeClass === NodeClass.VariableType || theParent.nodeClass === NodeClass.ObjectType)) {
        return { parentType: theParent as UAVariableType | UAObjectType, path: [originalObject.browseName] };
    }
    // walk up
    const { parentType, path } = _get_parent_type_and_path(theParent!);
    return { parentType, path: [...path, originalObject.browseName] };
}

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
        // istanbul ignore next
        doTrace &&
            traceLog("push context: ", "original parent = ", fullPath2(originalParent), "cloned parent =", fullPath2(clonedParent));

        const typeInstance = originalParent.nodeId.toString() + clonedParent.nodeId.toString();

        // istanbul ignore next
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
        this._context = this._contextStack.pop()!;
    }
    public registerClonedObject<
        TO extends UAObject | UAVariable | UAMethod | UAObjectType | UAVariableType,
        TC extends UAObject | UAVariable | UAMethod
    >({ clonedNode, originalNode }: { clonedNode: TC; originalNode: TO }): void {
        if (!this._context) {
            this.pushContext({ clonedParent: clonedNode, originalParent: originalNode });
        }
        // istanbul ignore next
        doTrace &&
            traceLog("registerClonedObject", "originalNode = ", fullPath2(originalNode), "clonedNode =", fullPath2(clonedNode));

        const insertShadow = (map: Map<string, CloneInfo>) => {
            const { parentType, path } = _get_parent_type_and_path(originalNode);

            if (parentType) {
                let base = parentType.subtypeOfObj;
                while (base) {
                    const shadowChild = followPath(base, path);
                    if (shadowChild) {
                        // istanbul ignore next
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

        // istanbul ignore next
        doTrace &&
            traceLog(
                "typeInstance (3) = originalParent",
                fullPath2(originalParent),
                "originalNode=",
                fullPath2(originalNode),
                "clonedParent",
                fullPath2(clonedParent)
            );

        const info = this._context!.get(originalNode.nodeId.toString());
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
    const addressSpace: IAddressSpace = originalObject.addressSpace;

    // we need to explore the non hierarchical references backwards
    let references = originalObject.findReferencesEx("NonHierarchicalReferences", BrowseDirection.Inverse);

    references = ([] as UAReference[]).concat(
        references,
        originalObject.findReferencesEx("HasEventSource", BrowseDirection.Inverse)
    );

    const { parentType, path } = _get_parent_type_and_path(originalObject);

    if (parentType && parentType.subtypeOfObj) {
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

    // istanbul ignore next
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

        // istanbul ignore next
        doTrace && traceLog(" investigation ", "original", fullPath2(original), NodeClass[cloned.nodeClass], fullPath2(cloned));

        for (const ref of originalNonHierarchical) {
            const info = findImplementedObject(cloneInfoArray, ref);
            if (!info) continue;

            // if the object pointed by this reference is also cloned ...

            const originalDest = info.original;
            const cloneDest = info.cloned;

            // istanbul ignore next
            doTrace &&
                traceLog(
                    "   adding reference ",
                    fullPath2(addressSpace.findNode(ref.referenceType)!),
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

            if (folder.typeDefinitionObj.browseName.name!.toString() !== "FunctionalGroupType") {
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
