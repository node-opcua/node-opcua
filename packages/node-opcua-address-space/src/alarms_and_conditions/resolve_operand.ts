import { BaseNode, IAddressSpace, UAVariable } from "node-opcua-address-space-base";
import { NodeClass } from "node-opcua-data-model";
import { makeBrowsePath } from "node-opcua-service-translate-browse-path";
import { StatusCodes } from "node-opcua-status-code";
import { SimpleAttributeOperand, AttributeOperand } from "node-opcua-types";
import { DataType, Variant } from "node-opcua-variant";




export function resolveOperand(
    addressSpace: IAddressSpace,
    rootNode: BaseNode,
    operand: SimpleAttributeOperand | AttributeOperand
): Variant {
    if (operand instanceof SimpleAttributeOperand) {
        const browsePath = makeBrowsePath(
            rootNode,
            "/" + operand.browsePath!.map((p) => `${p.namespaceIndex}:${p.name!}`).join("/")
        );
        const browseResult = addressSpace.browsePath(browsePath);

        if (browseResult.statusCode !== StatusCodes.Good || !browseResult.targets || browseResult.targets.length !== 1) {
            return new Variant({ dataType: DataType.StatusCode, value: StatusCodes.BadNodeIdUnknown });
        }

        const t = browseResult.targets[0].targetId;
        const node = addressSpace.findNode(t) as UAVariable;
        if (!node || node.nodeClass !== NodeClass.Variable) {
            return new Variant({ dataType: DataType.StatusCode, value: StatusCodes.BadNodeClassInvalid });
        }
        const value = node.readValue().value;
        return value;
    } else {
        if (!(operand instanceof AttributeOperand)) {
            throw new Error("expecting an AttributeOperand");
        }
        return new Variant({ dataType: DataType.Null });
    }
}
