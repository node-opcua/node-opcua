import { NodeId } from "node-opcua-nodeid";
import { getStandardDataTypeFactory } from "./get_standard_data_type_factory";
import { ConstructorFuncWithSchema } from "./types";

export function registerClassDefinition(
    dataTypeNodeId: NodeId,
    className: string,
    classConstructor: ConstructorFuncWithSchema
): void {
    return getStandardDataTypeFactory().registerClassDefinition(dataTypeNodeId, className, classConstructor);
}
