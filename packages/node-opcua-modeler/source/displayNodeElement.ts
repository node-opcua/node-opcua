
import {
    BaseNode,
    Reference,
    UAVariable,
    UAObjectType,
} from "node-opcua-address-space";
import { DataType } from "node-opcua-variant";
import { NodeClass } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
const Table = require("cli-table3");


const a = 'ⓂⓄⓋⓥⓇ❗⟵	⟶⟷'
function symbol(nodeClass: NodeClass) {
    switch (nodeClass) {
        case NodeClass.DataType: return "Ⓓ";
        case NodeClass.ObjectType: return "ⓄT";
        case NodeClass.VariableType: return "ⓋT";
        case NodeClass.Method: return "Ⓜ";
        case NodeClass.Object: return "Ⓞ";
        case NodeClass.Variable: return "Ⓥ";
        case NodeClass.View: return "⦖";
        default: return "?"
    }
}
const hasSubtypeNodeId = resolveNodeId("HasSubtype");

export function displayNodeElement(node: BaseNode): string {

    // instantiate
    var table = new Table({
        head: [
            'ReferenceType', 'NodeId', 'BrowseName', 'ModellingRule', "TypeDefinition", "DataType", "Value"
        ],
        //colWidths: [100, 200, 50, 50,]
    });

    table.push(
        [
            "BrowseName: ",
            { colSpan: 6, content: node.browseName.toString() },
        ],
    );
    if (node.description) {
        table.push(
            [
                "Description: ",
                node.description.toString(),
            ],
        );
    }

    const alreadyDumped: any = {};

    function dumpRefe(ref: Reference) {
        if (!ref.isForward) {
            return;
        }

        // ignore subtype references
        if (!ref.node) {
            console.log(" Halt ", ref.toString());
            return;
        }
        const dir = ref.isForward ? "⟶" : "⟵";
        const refNode = ref.node!;

        const refType = ref._referenceType!;
        if (refType.browseName.toString() === "HasSubtype") {
            return;
        }
        // xx const r = refNode.findReferencesAsObject("HasModellingRule", true);
        const modelingRule = refNode.modellingRule || ""; //  r[0] ? r[0].browseName.toString() : "/";

        let value = "";
        let dataType = "";
        if (refNode.nodeClass === NodeClass.Variable) {
            const v = refNode as UAVariable;

            const val = v.readValue().value.value;
            if (v.isEnumeration() && val !== null) {
                const a = v.readEnumValue();
                value = a.value + " (" + a.name + ")";
            } else {
                value = val ? val.toString() : "null";
            }
            const actualDataType = DataType[v.readValue().value.dataType];
            const basicDataType = DataType[v.dataTypeObj.basicDataType];
            dataType = v.dataTypeObj.browseName.toString();
            if (basicDataType != dataType) {
                dataType = dataType + "(" + basicDataType + ")";
            }
            //findBasicDataType(v.dataTypeObj);
        }
        table.push(
            [
                refType.browseName.toString() + dir + symbol(refNode.nodeClass),
                refNode.nodeId.toString(),
                refNode.browseName.toString(),
                modelingRule,
                (refNode as any).typeDefinitionObj ? (refNode as any).typeDefinitionObj.browseName.toString() : ""
                , dataType, value
            ],

        );
        alreadyDumped[refNode.browseName.toString()] = 1;

    }
    const references = node.allReferences();
    for (const ref of references) {
        dumpRefe(ref);

    }

    // add property from derived type
    if (node.nodeClass === NodeClass.ObjectType || node.nodeClass === NodeClass.VariableType) {

        const curNode = node;

        let superType = (curNode as UAObjectType).subtypeOfObj;
        while (superType) {
            table.push([superType.browseName.toString() + ":", "--", "--", "--"]);
            const references = superType.allReferences();
            for (const ref of references) {
                dumpRefe(ref);
            }
            superType = (superType as UAObjectType).subtypeOfObj;
        }
    }
    return table.toString();
}
