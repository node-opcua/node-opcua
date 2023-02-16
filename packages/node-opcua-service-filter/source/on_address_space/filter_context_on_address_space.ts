import {
    BaseNode,
    IAddressSpace,
    IEventData,
    ISessionContext,
    UADataType,
    UAObject,
    UAObjectType,
    UAReferenceType,
    UAVariable,
    UAVariableType
} from "node-opcua-address-space-base";
import { AttributeIds, NodeClass } from "node-opcua-data-model";
import { make_warningLog } from "node-opcua-debug";
import { NodeId, sameNodeId, NodeIdLike, coerceNodeId } from "node-opcua-nodeid";
import { StatusCodes } from "node-opcua-status-code";
import { BrowsePath } from "node-opcua-types";
import { Variant, DataType } from "node-opcua-variant";
import { DataValue } from "node-opcua-data-value";
//
import { FilterContext } from "../filter_context";

const warningLog = make_warningLog("Filter");

export class FilterContextOnAddressSpace implements FilterContext {
    public eventSource: NodeId;

    constructor(private sessionContext: ISessionContext, private eventData: IEventData) {
        this.eventSource = this.eventData.$eventDataSource?.nodeId || NodeId.nullNodeId;
    }

    getNodeClass(nodeId: NodeId): NodeClass {
        const addressSpace = this.getAddressSpace();
        const node = addressSpace.findNode(nodeId);
        return node ? node.nodeClass : NodeClass.Unspecified;
    }

    isSubtypeOf(nodeId: NodeId, baseType: NodeId): boolean {
        const addressSpace = this.getAddressSpace();
        const node = addressSpace.findNode(nodeId);
        const baseTypeNode = addressSpace.findNode(baseType);
        if (!node || !baseTypeNode) {
            warningLog("invalid node - must be specifed ");
            return false;
        }
        if (node.nodeClass === NodeClass.ObjectType && baseTypeNode.nodeClass === NodeClass.ObjectType) {
            return (node as UAObjectType).isSubtypeOf(baseTypeNode as UAObjectType);
        }
        if (node.nodeClass === NodeClass.VariableType && baseTypeNode.nodeClass === NodeClass.VariableType) {
            return (node as UAVariableType).isSubtypeOf(baseTypeNode as UAVariableType);
        }
        if (node.nodeClass === NodeClass.ReferenceType && baseTypeNode.nodeClass === NodeClass.ReferenceType) {
            return (node as UAReferenceType).isSubtypeOf(baseTypeNode as UAReferenceType);
        }
        if (node.nodeClass === NodeClass.DataType && baseTypeNode.nodeClass === NodeClass.DataType) {
            return (node as UADataType).isSubtypeOf(baseTypeNode as UADataType);
        }
        if (node.nodeClass === NodeClass.Object && baseTypeNode.nodeClass === NodeClass.ObjectType) {
            const obj = node as UAObject;
            return obj.typeDefinitionObj.isSubtypeOf(baseTypeNode as UAObjectType);
        }
        if (node.nodeClass === NodeClass.Variable && baseTypeNode.nodeClass !== NodeClass.VariableType) {
            const obj = node as UAVariable;
            return obj.typeDefinitionObj.isSubtypeOf(baseTypeNode as UAVariableType);
        }
        return false;
    }

    getTypeDefinition(nodeId: NodeId): NodeId | null {
        const addressSpace = this.getAddressSpace();
        const node = addressSpace.findNode(nodeId);
        if (!node) return null;
        if (node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable) {
            return (node as UAObject | UAVariable).typeDefinition;
        }
        return null;
    }

    readNodeValue(nodeId: NodeIdLike): Variant {
        nodeId = coerceNodeId(nodeId);

        // use  cache/snapshot if available
        const value = this.eventData._readValue(nodeId);
        if (value) {
            return value;
        }

        const addressSpace = this.getAddressSpace();
        const node = addressSpace.findNode(nodeId);
        if (!node || node.nodeClass !== NodeClass.Variable) {
            return new Variant();
        }
        return prepare((node as UAVariable).readValue(this.sessionContext));
    }

    private getAddressSpace(): IAddressSpace {
        return this.eventData.$eventDataSource!.addressSpace;
    }

    public browsePath(browsePath: BrowsePath): NodeId | null {

        // delegate to eventData if appropriate
        if (sameNodeId(browsePath.startingNode, this.eventSource)) {
            const browseResult = this.eventData._browse(browsePath);
            if (
                browseResult &&
                browseResult.statusCode.isGood() &&
                browseResult.targets &&
                browseResult.targets.length === 1
            ) {
                return browseResult.targets![0].targetId;
            }
        }

        // fallback to addressSpace otherwise
        const addressSpace = this.getAddressSpace();
        const browseResult = addressSpace.browsePath(browsePath);
        if (browseResult.statusCode.isNotGood() || !browseResult.targets || browseResult.targets.length !== 1) {
            return null;
        }
        return browseResult.targets[0].targetId;
    }

    setEventSource(eventSource: BaseNode | null) {
        this.eventSource = eventSource ? eventSource.nodeId : NodeId.nullNodeId;
    }
}

function prepare(dataValue: DataValue): Variant {
    if (dataValue.statusCode.isGood()) {
        return dataValue.value;
    }
    return new Variant({ dataType: DataType.StatusCode, value: dataValue.statusCode });
}
