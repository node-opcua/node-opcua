import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { LocalizedText, NodeClass, QualifiedName } from "node-opcua-data-model";

import { BaseNode } from "./base_node";
import { ModellingRuleType } from "./modelling_rule_type";
import { INamespace } from "./namespace";
import { UAMethod } from "./ua_method";
import { UAObject } from "./ua_object";
import { UAObjectType } from "./ua_object_type";
import { UAReference } from "./ua_reference";
import { UAVariable } from "./ua_variable";
import { CloneHelper } from "./clone_helper";

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
    filterFor(node: BaseNode) {
        return this;
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
    return extraInfo;
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
}
