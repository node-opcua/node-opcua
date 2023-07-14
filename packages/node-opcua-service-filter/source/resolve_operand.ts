import { NodeClass } from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_warningLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { constructBrowsePathFromQualifiedName, makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { SimpleAttributeOperand, AttributeOperand, VariableAttributes } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";
import { FilterContext } from "./filter_context";

const warningLog = make_warningLog("FILTER");
const debugLog = make_debugLog("FILTER");
const doDebug = checkDebugFlag("FILTER");

// export function readOperand(context: FilterContext, operand: SimpleAttributeOperand): Variant {
//     // navigate to the innerNode specified by the browsePath [ QualifiedName]
//     const browsePath = constructBrowsePathFromQualifiedName({ nodeId: context.eventSource }, operand.browsePath);
//     const targetNode = context.browsePath(browsePath);
//     if (!targetNode) {
//         return new Variant({ dataType: DataType.Null });
//     }
//     return context.readNodeValue(targetNode);
// }

export function resolveOperand(context: FilterContext, operand: SimpleAttributeOperand | AttributeOperand): Variant {
    if (operand instanceof SimpleAttributeOperand) {
        const browsePath = constructBrowsePathFromQualifiedName({ nodeId: context.eventSource }, operand.browsePath);

        const target: NodeId | null = context.browsePath(browsePath);
        if (!target) {
            return new Variant({ dataType: DataType.Null });
            // return new Variant({ dataType: DataType.StatusCode, value: StatusCodes.BadNodeIdUnknown });
        }
        const nodeClass = context.getNodeClass(target);
        if (nodeClass !== NodeClass.Variable) {
            doDebug && debugLog("resolveOperand: cannot find variable here but got nodeClass", NodeClass[nodeClass], browsePath.toString());
            return new Variant({ dataType: DataType.StatusCode, value: StatusCodes.BadNodeClassInvalid });
        }
        const value = context.readNodeValue(target);
        return value;
    } else {
        if (!(operand instanceof AttributeOperand)) {
            throw new Error("expecting an AttributeOperand");
        }
        warningLog("AttributeOperand is not yet implemented");
        return new Variant({ dataType: DataType.Null });
    }
}
