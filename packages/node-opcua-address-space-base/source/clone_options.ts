import type { LocalizedText, NodeClass, QualifiedName } from "node-opcua-data-model";
import type { NodeId, NodeIdLike } from "node-opcua-nodeid";
import type { BaseNode } from "./base_node.js";
import { CloneHelper } from "./clone_helper.js";
import type { ModellingRuleType } from "./modelling_rule_type.js";
import type { INamespace } from "./namespace.js";
import type { UAMethod } from "./ua_method.js";
import type { UAObject } from "./ua_object.js";
import type { UAObjectType } from "./ua_object_type.js";
import type { UAReference } from "./ua_reference.js";
import type { UAVariable } from "./ua_variable.js";

export interface CloneFilter {
    shouldKeep(node: BaseNode): boolean;
    filterFor(childInstance: UAVariable | UAObject | UAMethod): CloneFilter;
}
export const defaultCloneFilter: CloneFilter = {
    shouldKeep: (node: BaseNode) => {
        if (node.modellingRule === "OptionalPlaceholder" || node.modellingRule === "MandatoryPlaceholder") {
            return false;
        }
        return true;
    },
    filterFor(_childInstance: UAVariable | UAObject | UAMethod): CloneFilter {
        return defaultCloneFilter;
    }
};

export interface CloneExtraInfo {
    /* */
    level: number;
    pad(): string;

    pushContext(params: { clonedParent: BaseNode; originalParent: BaseNode }): void;
    popContext(): void;

    registerClonedObject(params: { clonedNode: BaseNode; originalNode: BaseNode }): void;
    getCloned(params: {
        originalParent: BaseNode;
        clonedParent: BaseNode;
        originalNode: UAVariable | UAObject | UAMethod;
    }): BaseNode | null;
}

export const makeDefaultCloneExtraInfo = (node: UAVariable | UAMethod | UAObject): CloneExtraInfo => {
    const extraInfo = new CloneHelper();
    extraInfo.pushContext({ originalParent: node, clonedParent: node });
    return extraInfo as CloneExtraInfo;
};

export interface CloneOptions /* extends ConstructNodeIdOptions */ {
    namespace: INamespace;
    references?: UAReference[];

    nodeId?: string | NodeIdLike | null;
    nodeClass?: NodeClass;

    browseName?: QualifiedName;
    descriptions?: LocalizedText;
    modellingRule?: ModellingRuleType;

    // for variables
    accessLevel?: number;
    arrayDimensions?: number[] | null;
    dataType?: NodeId;
    historizing?: boolean;
    minimumSamplingInterval?: number;
    userAccessLevel?: number;
    valueRank?: number;
    // for objects
    eventNotifier?: number;
    symbolicName?: string;
    // for methods
    executable?: boolean;
    methodDeclarationId?: NodeId;

    // ------------
    componentOf?: UAObjectType | UAObject;

    copyAlsoModellingRules?: boolean;
    ignoreChildren?: boolean;

    /**
     * the declarations of this same child on the supertypes of the type being instantiated,
     * nearest supertype first. Their children are merged into the clone before its own type
     * definition is explored, so that what a subtype re-declares (OPC 40702 re-declares
     * Monitoring to add Health and Process) keeps what the base declaration carries (Status).
     * @private set by the instantiation walk
     */
    baseDeclarations?: BaseNode[];
}
