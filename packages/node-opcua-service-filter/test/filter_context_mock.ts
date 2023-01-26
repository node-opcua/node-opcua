import { NodeId, NodeIdLike, sameNodeId } from "node-opcua-nodeid";
import { BrowsePath } from "node-opcua-types";
import { Variant, DataType, VariantOptions } from "node-opcua-variant";
import { NodeClass } from "node-opcua-data-model";
import { resolveNodeId, coerceNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { assert } from "node-opcua-assert";
import { make_warningLog } from "node-opcua-debug";

import { FilterContext } from "..";

const warningLog = make_warningLog("TEST");

let counter = 100;

function makeNodeId(): NodeId {
    return coerceNodeId(counter++, 3);
}

interface _Base {
    browseName: string;
    nodeId: NodeId;
    nodeClass: NodeClass;
}
interface _Type<T extends ErsatzNode> {
    subtype: T | null;
}
interface _TypeDefinition<T extends ErsatzNode> {
    typeDefinition?: T | null;
}
interface _WithChildren extends _Base {
    children?: (ErsatzNodeObject | ErsatzNodeVariable | ErsatzNodeMethod)[];
    parent?: _WithChildren;
}

interface ErsatzNodeVariable extends _Base, _WithChildren, _TypeDefinition<ErsatzNodeVariableType> {
    nodeClass: NodeClass.Variable;
    dataType?: DataType;
    value?: Variant;
}

interface ErsatzNodeObject extends _Base, _WithChildren, _TypeDefinition<ErsatzNodeObjectType> {
    nodeClass: NodeClass.Object;
}

interface ErsatzNodeMethod extends _Base {
    nodeClass: NodeClass.Method;
}
interface ErsatzNodeDataType extends _Base, _Type<ErsatzNodeDataType> {
    nodeClass: NodeClass.DataType;
    dataType?: DataType;
}
interface ErsatzNodeObjectType extends _Base, _WithChildren, _Type<ErsatzNodeObjectType> {
    nodeClass: NodeClass.ObjectType;
}
interface ErsatzNodeVariableType extends _Base, _WithChildren, _Type<ErsatzNodeVariableType> {
    nodeClass: NodeClass.VariableType;
}
interface ErsatzNodeReferenceType extends _Base, _Type<ErsatzNodeReferenceType> {
    nodeClass: NodeClass.ReferenceType;
}

type ErsatzNode =
    | ErsatzNodeVariable
    | ErsatzNodeObject
    | ErsatzNodeMethod
    | ErsatzNodeDataType
    | ErsatzNodeObjectType
    | ErsatzNodeVariableType
    | ErsatzNodeReferenceType;
type ErsatzType = ErsatzNodeDataType | ErsatzNodeObjectType | ErsatzNodeVariableType | ErsatzNodeReferenceType;
type ErsatzConcrete = ErsatzNodeObject | ErsatzNodeVariable | ErsatzNodeMethod;

const g_nodes: Record<string, ErsatzNode> = {};

function fullNode(node?: _WithChildren): string {
    if (
        node &&
        (node.nodeClass === NodeClass.VariableType ||
            node.nodeClass === NodeClass.ObjectType ||
            node.nodeClass === NodeClass.ReferenceType ||
            node.nodeClass === NodeClass.DataType)
    ) {
        return node?.browseName;
    }
    const s: string[] = [];
    while (node) {
        s.unshift(node.browseName);
        node = node.parent;
    }
    return s.join(".");
}

function setParent(nodes: Record<string, ErsatzNode>, node: _WithChildren, parent?: string | null): void {
    if (parent) {
        const p = nodes[parent];
        if (
            !p ||
            (p.nodeClass !== NodeClass.Object &&
                p.nodeClass !== NodeClass.Variable &&
                p.nodeClass !== NodeClass.ObjectType &&
                p.nodeClass !== NodeClass.VariableType)
        ) {
            throw new Error("parent doesn't exist or has invalid type ( parent= " + parent + ")" + NodeClass[p?.nodeClass]);
        }
        p.children = p.children || [];
        p.children.push(node as ErsatzNodeObject | ErsatzNodeVariable);
        node.parent = p;
    }
}
function register(nodes: Record<string, ErsatzNode>, node: ErsatzNode) {
    const browseName = fullNode(node);
    assert(nodes[browseName] === undefined);
    nodes[browseName] = node;
    nodes[node.nodeId.toString()] = node;
}

function makeVariable(
    nodes: Record<string, ErsatzNode>,
    {
        browseName,
        dataType,
        typeDefinition,
        parent,
        value
    }: {
        browseName: string;
        dataType: DataType;
        typeDefinition?: string | null;
        parent?: string | null;
        value: VariantOptions;
    }
) {
    typeDefinition = typeDefinition || "BaseVariableType";

    const typeDefinitionNode = typeDefinition ? (nodes[typeDefinition] as ErsatzNodeVariableType) : undefined;
    if (typeDefinitionNode && typeDefinitionNode.nodeClass !== NodeClass.VariableType) {
        throw new Error("typeDefinition is not a VariableType");
    }

    const node: ErsatzNodeVariable = {
        nodeClass: NodeClass.Variable,
        browseName,
        dataType,
        value: new Variant(value),
        nodeId: makeNodeId(),
        typeDefinition: typeDefinitionNode
    };
    setParent(nodes, node, parent);
    register(nodes, node);
    return node;
}

function makeObject(
    nodes: Record<string, ErsatzNode>,
    {
        nodeId,
        browseName,
        typeDefinition,
        parent
    }: { nodeId?: NodeIdLike; browseName: string; typeDefinition?: string | null; parent?: string | null }
) {
    typeDefinition = typeDefinition || "BaseObjectType";

    nodeId = nodeId ? resolveNodeId(nodeId) : makeNodeId();

    const typeDefinitionNode = typeDefinition ? (nodes[typeDefinition] as ErsatzNodeObjectType) : undefined;
    if (typeDefinitionNode && typeDefinitionNode.nodeClass !== NodeClass.ObjectType) {
        throw new Error("typeDefinition is not a ObjectType");
    }

    const node: ErsatzNodeObject = {
        nodeClass: NodeClass.Object,
        browseName,
        nodeId,
        typeDefinition: typeDefinitionNode
    };
    setParent(nodes, node, parent);
    register(nodes, node);
    return node;
}

function makeMethod(
    nodes: Record<string, ErsatzNode>,
    { nodeId, browseName, parent }: { nodeId?: NodeIdLike; browseName: string; parent: string }
) {
    nodeId = nodeId ? resolveNodeId(nodeId) : makeNodeId();
    const node: ErsatzNodeMethod = {
        nodeClass: NodeClass.Method,
        browseName,
        nodeId
    };
    register(nodes, node);
    return node;
}

function makeDataType(
    nodes: Record<string, ErsatzNode>,
    { browseName, dataType, subtypeOf }: { browseName: string; dataType: DataType; subtypeOf: string | null }
) {
    const node: ErsatzNodeDataType = {
        nodeClass: NodeClass.DataType,
        browseName,
        dataType,
        nodeId: resolveNodeId(browseName),
        subtype: subtypeOf ? (nodes[subtypeOf] as ErsatzNodeDataType) : null
    };
    register(nodes, node);
}
function makeObjectType(
    nodes: Record<string, ErsatzNode>,
    { browseName, subtypeOf }: { browseName: string; subtypeOf: string | null }
) {
    const node: ErsatzNodeObjectType = {
        nodeClass: NodeClass.ObjectType,
        browseName,
        nodeId: resolveNodeId(browseName),
        subtype: subtypeOf ? (nodes[subtypeOf] as ErsatzNodeObjectType) : null
    };
    register(nodes, node);
}
function makeVariableType(
    nodes: Record<string, ErsatzNode>,
    { browseName, subtypeOf }: { browseName: string; subtypeOf: string | null }
) {
    const node: ErsatzNodeVariableType = {
        nodeClass: NodeClass.VariableType,
        browseName,
        nodeId: resolveNodeId(browseName),
        subtype: subtypeOf ? (nodes[subtypeOf] as ErsatzNodeVariableType) : null
    };
    register(nodes, node);
}
function makeReferenceType(
    nodes: Record<string, ErsatzNode>,
    { browseName, subtypeOf }: { browseName: string; subtypeOf: string | null }
) {
    const node: ErsatzNodeReferenceType = {
        nodeClass: NodeClass.ReferenceType,
        browseName,
        nodeId: resolveNodeId(browseName),
        subtype: subtypeOf ? (nodes[subtypeOf] as ErsatzNodeReferenceType) : null
    };
    register(nodes, node);
}

function makeEvent(
    nodes: Record<string, ErsatzNode>,
    { browseName, parent, typeDefinition }: { browseName: string; parent: string; typeDefinition: string }
) {
    const o = makeObject(nodes, { browseName, typeDefinition, parent });

    const typeDefinitionNode = nodes[typeDefinition];

    makeVariable(nodes, {
        browseName: "EventType",
        dataType: DataType.NodeId,
        value: { dataType: DataType.NodeId, value: typeDefinitionNode.nodeId },
        parent: o.nodeId.toString()
    });
}
makeDataType(g_nodes, { browseName: "BaseDataType", dataType: DataType.Variant, subtypeOf: null });
makeDataType(g_nodes, { browseName: "Number", dataType: DataType.Variant, subtypeOf: "BaseDataType" });
makeDataType(g_nodes, { browseName: "UInteger", dataType: DataType.Variant, subtypeOf: "Number" });
makeDataType(g_nodes, { browseName: "UInt16", dataType: DataType.UInt16, subtypeOf: "UInteger" });
makeDataType(g_nodes, { browseName: "String", dataType: DataType.Variant, subtypeOf: "BaseDataType" });

makeObjectType(g_nodes, { browseName: "BaseObjectType", subtypeOf: null });
makeObjectType(g_nodes, { browseName: "FolderType", subtypeOf: "BaseObjectType" });
makeObjectType(g_nodes, { browseName: "OrderedListType", subtypeOf: "BaseObjectType" });
makeObjectType(g_nodes, { browseName: "NetworkAddressType", subtypeOf: "BaseObjectType" });

// events
makeObjectType(g_nodes, { browseName: "BaseEventType", subtypeOf: "BaseObjectType" });

makeObjectType(g_nodes, { browseName: "SystemEventType", subtypeOf: "BaseEventType" });
makeObjectType(g_nodes, { browseName: "DeviceFailureEventType", subtypeOf: "SystemEventType" });

makeObjectType(g_nodes, { browseName: "BaseModelChangeEventType", subtypeOf: "BaseEventType" });
makeObjectType(g_nodes, { browseName: "GeneralModelChangeEventType", subtypeOf: "BaseModelChangeEventType" });

makeObjectType(g_nodes, { browseName: "EventQueueOverflowEventType", subtypeOf: "BaseEventType" });

makeObjectType(g_nodes, { browseName: "AuditEventType", subtypeOf: "BaseEventType" });
makeObjectType(g_nodes, { browseName: "AuditSecurityEventType", subtypeOf: "AuditEventType" });
makeObjectType(g_nodes, { browseName: "AuditCertificateExpiredEventType", subtypeOf: "AuditSecurityEventType" });

makeObjectType(g_nodes, { browseName: "AuditNodeManagementEventType", subtypeOf: "AuditEventType" });
makeObjectType(g_nodes, { browseName: "AuditHistoryDeleteEventType", subtypeOf: "AuditNodeManagementEventType" });

makeVariable(g_nodes, {
    browseName: "Changes",
    dataType: DataType.Null,
    value: { dataType: DataType.Null },
    parent: "EventQueueOverflowEventType"
});
makeVariable(g_nodes, {
    browseName: "EventType",
    dataType: DataType.NodeId,
    parent: "EventQueueOverflowEventType",
    value: {
        dataType: DataType.NodeId,
        value: resolveNodeId("EventQueueOverflowEventType")
    }
});

makeVariable(g_nodes, {
    browseName: "SourceNode",
    dataType: DataType.NodeId,
    parent: "EventQueueOverflowEventType",
    value: { dataType: DataType.NodeId, value: NodeId.nullNodeId }
});

// references
makeReferenceType(g_nodes, { browseName: "References", subtypeOf: null });
makeReferenceType(g_nodes, { browseName: /* */ "NonHierarchicalReferences", subtypeOf: "References" });
makeReferenceType(g_nodes, { browseName: /* */ "HierarchicalReferences", subtypeOf: "References" });
makeReferenceType(g_nodes, { browseName: /*   */ "HasChild", subtypeOf: "HierarchicalReferences" });
makeReferenceType(g_nodes, { browseName: /*       */ "HasSubtype", subtypeOf: "HasChild" });
makeReferenceType(g_nodes, { browseName: /*       */ "Aggregates", subtypeOf: "HasChild" });
makeReferenceType(g_nodes, { browseName: /*          */ "HasComponent", subtypeOf: "Aggregates" });

// variable types
makeVariableType(g_nodes, { browseName: "BaseVariableType", subtypeOf: null });
makeVariableType(g_nodes, { browseName: "PropertyType", subtypeOf: "BaseVariableType" });
makeVariableType(g_nodes, { browseName: "DataItemType", subtypeOf: "BaseVariableType" });
makeVariableType(g_nodes, { browseName: "CubeItemType", subtypeOf: "DataItemType" });

// objects
makeObject(g_nodes, { browseName: "RootFolder", typeDefinition: "FolderType" });
makeObject(g_nodes, { browseName: "Objects", typeDefinition: "FolderType", parent: "RootFolder" });

makeObject(g_nodes, { nodeId: "Server", browseName: "Server", typeDefinition: "BaseObjectType", parent: "RootFolder.Objects" });
// makeVariable(g_nodes, { browseName: "G", typeDefinition: "ServerStatusType", parent: "Server" });
makeMethod(g_nodes, { browseName: "GetMonitoredItems", parent: "RootFolder.Objects.Server" });

export const variableWithAlarm = makeVariable(g_nodes, {
    browseName: "VariableWithAlarm",
    dataType: DataType.Double,
    parent: "RootFolder.Objects.Server",
    value: { dataType: DataType.Double, value: 0 }
}).nodeId;
export const highLimit = makeVariable(g_nodes, {
    browseName: "HighLimit",
    dataType: DataType.Double,
    parent: "RootFolder.Objects.Server.VariableWithAlarm",
    value: { dataType: DataType.Double, value: 90 }
}).nodeId;
export const lowLimit = makeVariable(g_nodes, {
    browseName: "LowLimit",
    dataType: DataType.Double,
    parent: "RootFolder.Objects.Server.VariableWithAlarm",
    value: { dataType: DataType.Double, value: 10 }
}).nodeId;

export const alarmNode = makeObject(g_nodes, {
    browseName: "AlarmNode",
    typeDefinition: "BaseEventType",
    parent: "RootFolder.Objects.Server.VariableWithAlarm"
}).nodeId;
makeVariable(g_nodes, {
    browseName: "Severity",
    dataType: DataType.UInt16,
    parent: "RootFolder.Objects.Server.VariableWithAlarm.AlarmNode",
    value: { dataType: DataType.UInt16, value: 100 }
});
makeVariable(g_nodes, {
    browseName: "EnabledState",
    dataType: DataType.String,
    parent: "RootFolder.Objects.Server.VariableWithAlarm.AlarmNode",
    value: { dataType: DataType.String, value: "" }
});
makeVariable(g_nodes, {
    browseName: "Id",
    dataType: DataType.Boolean,
    parent: "RootFolder.Objects.Server.VariableWithAlarm.AlarmNode.EnabledState",
    value: { dataType: DataType.Boolean, value:false }
});
makeVariable(g_nodes, {
    browseName: "AckedState",
    dataType: DataType.String,
    parent: "RootFolder.Objects.Server.VariableWithAlarm.AlarmNode",
    value: { dataType: DataType.String, value: "" }
});
makeVariable(g_nodes, {
    browseName: "Id",
    dataType: DataType.Boolean,
    parent: "RootFolder.Objects.Server.VariableWithAlarm.AlarmNode.AckedState",
    value: { dataType: DataType.Boolean, value:false }
});


makeEvent(g_nodes, {
    browseName: "AuditCertificateExpiredEvent",
    parent: "RootFolder.Objects.Server",
    typeDefinition: "AuditCertificateExpiredEventType"
});
makeEvent(g_nodes, {
    browseName: "AuditHistoryDeleteEvent",
    parent: "RootFolder.Objects.Server",
    typeDefinition: "AuditHistoryDeleteEventType"
});
makeEvent(g_nodes, {
    browseName: "DeviceFailureEvent",
    parent: "RootFolder.Objects.Server",
    typeDefinition: "DeviceFailureEventType"
});

type NodeIdString = string;
export class FilterContextMock implements FilterContext {
    private _nodeIds: Record<NodeIdString, ErsatzNode> = {};

    public eventSource: NodeId;

    constructor(private nodes: Record<string, ErsatzNode> = g_nodes) {
        for (const [k, v] of Object.entries(nodes)) {
            this._nodeIds[v.nodeId.toString()] = v;
        }
        this.eventSource = NodeId.nullNodeId;
    }

    public isSubtypeOf(nodeId: NodeId, baseType: NodeId): boolean {
        let node = this._nodeIds[nodeId.toString()];
        if (!node) {
            warningLog("cannot find node  with id ", nodeId);
            return false;
        }
        if (
            node.nodeClass !== NodeClass.ObjectType &&
            node.nodeClass !== NodeClass.ReferenceType &&
            node.nodeClass !== NodeClass.DataType &&
            node.nodeClass !== NodeClass.VariableType
        ) {
            return false;
        }

        while (node) {
            if (sameNodeId(node.nodeId, baseType)) {
                return true;
            }
            node = node.subtype as ErsatzType;
        }

        return false;
    }

    public getTypeDefinition(nodeId: NodeId): NodeId | null {
        const node = this._nodeIds[nodeId.toString()];
        if (!node) {
            warningLog("cannot find node  with id ", nodeId.toString());
            return null;
        }
        if (node.nodeClass !== NodeClass.ObjectType && node.nodeClass !== NodeClass.VariableType) {
            const t = (node as ErsatzNodeObject | ErsatzNodeVariable).typeDefinition;
            return t ? t.nodeId : null;
        }
        return null;
    }

    public readNodeValue(nodeId: NodeId): Variant {
        const node = this._nodeIds[nodeId.toString()];
        if (!node) {
            return new Variant({ dataType: DataType.StatusCode, value: StatusCodes.BadNodeIdUnknown });
        }
        if (node.nodeClass !== NodeClass.Variable) {
            return new Variant({ dataType: DataType.StatusCode, value: StatusCodes.BadNodeIdUnknown });
        }
        return node.value || new Variant({ dataType: DataType.Null });
    }

    public getNodeClass(nodeId: NodeId): NodeClass {
        const node = this._nodeIds[nodeId.toString()];
        if (!node) return NodeClass.Unspecified;
        return node.nodeClass;
    }
    public browsePath(browsePath: BrowsePath): NodeId | null {
        let node = this._nodeIds[browsePath.startingNode.toString()];
        if (!node) {
            return null;
        }

        for (const element of browsePath.relativePath.elements || []) {
            if (
                node.nodeClass !== NodeClass.ObjectType &&
                node.nodeClass !== NodeClass.VariableType &&
                node.nodeClass !== NodeClass.Object &&
                node.nodeClass !== NodeClass.Variable
            ) {
                return null;
            }
            if (!node.children) {
                console.log("cannot find element", element.targetName.name, "in", node.browseName);
                return null;
            }
            const index = node.children.findIndex((c) => c.browseName === element.targetName.name);
            if (index === -1) {
                return null;
            }
            const child = node.children[index];
            node = child;
        }
        return node.nodeId;
    }

    //
    public setValue(name: string, variant: VariantOptions) {
        const node = this.nodes[name];
        if (!node || node.nodeClass !== NodeClass.Variable) {
            throw new Error("cannot find node " + name);
        }
        node.value = new Variant(variant);
    }

    public findNodeByName(name: string): NodeId {
        const node = this.nodes[name];
        if (!node) throw new Error("cannot find node " + name);
        return node.nodeId;
    }
}
