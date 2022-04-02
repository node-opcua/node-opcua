import {
    ReferenceDescription,
    QualifiedName,
    NodeClass,
    LocalizedText,
    coerceLocalizedText,
    DataValue,
    AccessLevelFlag
} from "node-opcua-client";
import { NodeId } from "node-opcua-nodeid";
import { DataTypeDefinition } from "node-opcua-types";
import { pendingBrowseName } from "./private";

function w(s: string, l: number): string {
    return s.padEnd(l).substring(0, l);
}
export class CacheNode {
    // the reference that links this node to its parent
    public referenceToParent?: ReferenceDescription;
    public parent?: CacheNode;

    public nodeId: NodeId;
    public browseName: QualifiedName;
    public references: ReferenceDescription[];
    public nodeClass: NodeClass;
    public typeDefinition: any;
    public displayName: LocalizedText;
    public description: LocalizedText = coerceLocalizedText("")!;

    constructor(nodeId: NodeId) {
        /**
         */
        this.nodeId = nodeId;
        /**
         */
        this.browseName = pendingBrowseName;
        /**
         */
        this.references = [];

        this.nodeClass = NodeClass.Unspecified;

        this.typeDefinition = "";

        this.displayName = new LocalizedText({});
    }

    public toString(): string {
        let str = w(this.nodeId.toString(), 20);
        str += " " + w(this.browseName.toString(), 30);
        str += " typeDef : " + w(this.typeDefinition ? this.typeDefinition.toString() : "", 30);
        str += " nodeClass : " + w(NodeClass[this.nodeClass], 12);
        return str;
    }
    public dispose(): void {
        this.parent = undefined;
        this.referenceToParent = undefined;
        this.references.length = 0;
        this.typeDefinition = undefined;
    }
}

export interface CacheNodeDataType extends CacheNode {
    nodeClass: NodeClass.DataType;
    dataTypeDefinition: DataTypeDefinition;
}

// tslint:disable: max-classes-per-file
export class CacheNodeVariable extends CacheNode {
    public nodeClass: NodeClass.Variable = NodeClass.Variable;
    public dataValue?: DataValue;

    constructor(nodeId: NodeId) {
        super(nodeId);
    }
    public dispose(): void {
        super.dispose();
        if (this.dataValue) {
            this.dataValue = undefined;
        }
    }
}
export interface CacheNodeVariable extends CacheNode {
    dataType: NodeId;
    dataValue?: DataValue;
    minimumSamplingInterval: number;
    accessLevel: AccessLevelFlag;
    userAccessLevel: AccessLevelFlag;
    arrayDimensions?: number[];
    valueRank?: number;
}

export class CacheNodeVariableType extends CacheNode {
    public nodeClass: NodeClass.VariableType = NodeClass.VariableType;
    public dataValue?: DataValue;

    constructor(nodeId: NodeId) {
        super(nodeId);
    }
    public dispose(): void {
        super.dispose();
        if (this.dataValue) {
            this.dataValue = undefined;
        }
    }
}
export interface CacheNodeVariableType extends CacheNode {
    nodeClass: NodeClass.VariableType;
    isAbstract: boolean;
    dataType: NodeId;
    dataValue?: DataValue;
    accessLevel: AccessLevelFlag;
    arrayDimensions?: number[];
    valueRank?: number;
}

export interface CacheNodeObjectType extends CacheNode {
    nodeClass: NodeClass.ObjectType;
    isAbstract: boolean;
    accessLevel: AccessLevelFlag;
    eventNotifier: number;
}

export interface CacheNodeReferenceType extends CacheNode {
    nodeClass: NodeClass.ReferenceType;
    isAbstract: boolean;
    inverseName: LocalizedText;
}
