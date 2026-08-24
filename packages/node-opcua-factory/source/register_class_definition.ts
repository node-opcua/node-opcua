import type { NodeId } from "node-opcua-nodeid";
import { getStandardDataTypeFactory } from "./get_standard_data_type_factory";
import type { ConstructorFuncWithSchema } from "./types";

export function registerClassDefinition(
    dataTypeNodeId: NodeId,
    className: string,
    classConstructor: ConstructorFuncWithSchema
): void {
    getStandardDataTypeFactory().registerClassDefinition(dataTypeNodeId, className, classConstructor);
}
