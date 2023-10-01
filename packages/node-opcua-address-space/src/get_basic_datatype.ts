import { IAddressSpace } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { NodeClass } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";

export interface IBaseNodeVariableOrVariableType {
    addressSpace: IAddressSpace;
    dataType: NodeId;
}
interface IBaseNodeVariableOrVariableTypeEx extends IBaseNodeVariableOrVariableType {
    _basicDataType: DataType;
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
    const dataTypeNode = addressSpace.findDataType(_uaNode.dataType)!;
    const basicDataType =
        dataTypeNode && dataTypeNode.nodeClass === NodeClass.DataType ? dataTypeNode.getBasicDataType() : DataType.Null;
    // const basicDataType = addressSpace.findCorrespondingBasicDataType(uaNode.dataType);
    _uaNode._basicDataType = basicDataType;
    return basicDataType;
}
