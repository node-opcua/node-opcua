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

export interface CloneFilter {
    shouldKeep(node: BaseNode): boolean;
    filterFor(childInstance: UAVariable | UAObject | UAMethod): CloneFilter;
}
export const defaultCloneFilter: CloneFilter = {
    shouldKeep: () => true,
    filterFor(node: BaseNode) {
        return this;
    }
};

export interface CloneExtraInfo {
    /* */
    level: number;
    pad(): string;
    registerClonedObject(clonedObject: BaseNode, originalObject: BaseNode): void;
    getCloned(node: BaseNode): BaseNode | null;
}
interface CloneExtraInfoEx extends CloneExtraInfo {
    _cloned: Map<BaseNode, BaseNode>;
}
export const defaultCloneExtraInfo: CloneExtraInfoEx = {
    level: 0,
    _cloned: new Map<BaseNode, BaseNode>(),
    pad(this: CloneExtraInfo) {
        return " ".padEnd(this.level * 2);
    },
    registerClonedObject(_clonedObject: BaseNode, _originalObject: BaseNode): void {
        if(this.getCloned(_originalObject)) throw new Error("cloned object is already registered.");
        this._cloned.set(_originalObject, _clonedObject);
    },
    getCloned(node: BaseNode): BaseNode | null {
        return this._cloned.get(node) || null;
    }
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
