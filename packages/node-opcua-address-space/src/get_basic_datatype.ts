import { IAddressSpace } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";

export interface IBaseNodeVariableOrVariableType {
    addressSpace: IAddressSpace;
    dataType: NodeId;
}
interface IBaseNodeVariableOrVariableTypeEx extends IBaseNodeVariableOrVariableType {
    _basicDataType: DataType;
}

export function _getBasicDataTypeFromDataTypeNodeId(
    addressSpace: IAddressSpace,
    dataTypeNodeId: { nodeId: NodeIdLike } | NodeIdLike
): DataType {
    const dataTypeNodeId_  =  (dataTypeNodeId as any).nodeId ? (dataTypeNodeId as any).nodeId : dataTypeNodeId;
    const dataTypeNode = addressSpace.findDataType(dataTypeNodeId_);
    if (!dataTypeNode) {
        return DataType.Null;
    }
    return dataTypeNode.getBasicDataType();
}

export function _getBasicDataType(uaNode: IBaseNodeVariableOrVariableType): DataType {
    const _uaNode = uaNode as IBaseNodeVariableOrVariableTypeEx;
    if (_uaNode._basicDataType) {
        return _uaNode._basicDataType;
    }
    if (_uaNode.dataType.namespace === 0 && _uaNode.dataType.value === 0) {
        return DataType.Null;
    }
    const addressSpace = _uaNode.addressSpace;
    if (!addressSpace) {
        // may be node has been deleted already
        return DataType.Null;
    }
    _uaNode._basicDataType =  _getBasicDataTypeFromDataTypeNodeId(addressSpace, _uaNode.dataType);
    return _uaNode._basicDataType;
}
