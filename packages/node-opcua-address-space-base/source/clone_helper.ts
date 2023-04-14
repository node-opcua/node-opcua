import { assert } from "node-opcua-assert";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { BrowseDirection, NodeClass, QualifiedName } from "node-opcua-data-model";
import { UAObject } from "./ua_object";
import { UAVariable } from "./ua_variable";
import { UAMethod } from "./ua_method";
import { UAObjectType } from "./ua_object_type";
import { UAVariableType } from "./ua_variable_type";
import { BaseNode } from "./base_node";
import { makeNodeId, sameNodeId } from "node-opcua-nodeid";
import { ReferenceTypeIds } from "node-opcua-constants";
import { UAReference } from "./ua_reference";
import { IAddressSpace } from "./address_space";

const debugLog = make_debugLog("CLONE");
const doDebug = checkDebugFlag("CLONE");
const warningLog = make_warningLog("CLONE");

type UAConcrete = UAVariable | UAObject | UAMethod;

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
//              |        +-------| Folder1  |
//              |                +----------+
//              |                     |
//              |                     +--------------|- (EnabledState)   (shadow element)
//              |
//   /-----------------------------\
//   | MyDeriveDeviceType   |
//   \-----------------------------/
//              |
//              |        |       +----------+
//              |        +-------| Folder1  |
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

export class CloneHelper {
    public level = 0;
    private readonly mapOrgToClone: Map<string, CloneInfo> = new Map();

    public pad(): string {
        return " ".padEnd(this.level * 2, " ");
    }
    public registerClonedObject<
        TO extends UAObject | UAVariable | UAMethod | UAObjectType | UAVariableType,
        TC extends UAObject | UAVariable | UAMethod
    >(clonedNode: TC, originalNode: TO) {
        this.mapOrgToClone.set(originalNode.nodeId.toString(), {
            cloned: clonedNode,
            original: originalNode
        });

        //
        const { parentType, path } = _get_parent_type_and_path(originalNode);

        if (parentType) {
            let base = parentType.subtypeOfObj;
            while (base) {
                const shadowChild = followPath(base, path);
                if (shadowChild) {
                    this.mapOrgToClone.set(shadowChild.nodeId.toString(), {
                        cloned: clonedNode,
                        original: shadowChild
                    });
                }
                base = base.subtypeOfObj;
            }
        } else {
        }
        // find subTypeOf
    }
    public getCloned(originalNode: UAVariableType | UAObjectType): UAObject | UAVariable | UAMethod | null {
        const info = this.mapOrgToClone.get(originalNode.nodeId.toString());
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

export function reconstructNonHierarchicalReferences(extraInfo: CloneHelper): void {
    const extraInfo_ = extraInfo as unknown as { mapOrgToClone: Map<string, CloneInfo> };

    const findImplementedObject = (ref: UAReference): CloneInfo | null =>
        extraInfo_.mapOrgToClone.get(ref.nodeId.toString()) || null;

    // navigate through original objects to find those that are being references by node that
    // have been cloned .
    // this could be node organized by some FunctionalGroup

    for (const { original, cloned } of extraInfo_.mapOrgToClone.values()) {
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
                        "   adding reference ",
                        ref.referenceType,
                        addressSpace.findNode(ref.referenceType)!.browseName.toString(),
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
            } else {
                //     // restore reference
                //     cloned.addReference({
                //         isForward: false,
                //         nodeId: ref.nodeId,
                //         referenceType: ref.referenceType
                //     });
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
export function reconstructFunctionalGroupType(extraInfo: CloneHelper) {
    const extraInfo_ = extraInfo as unknown as { mapOrgToClone: Map<string, CloneInfo> };

    // navigate through original objects to find those that are being organized by some FunctionalGroup
    for (const { original, cloned } of extraInfo_.mapOrgToClone.values()) {
        const organizedByArray = original.findReferencesEx("Organizes", BrowseDirection.Inverse);

        for (const ref of organizedByArray) {
            const info = extraInfo_.mapOrgToClone.get(ref.nodeId.toString());
            if (!info) continue;

            const folder = info.original;
            if (folder.nodeClass !== NodeClass.Object) continue;

            if (!folder.typeDefinitionObj) continue;

            assert(folder.typeDefinitionObj.browseName.name!.toString() === "FunctionalGroupType");

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
