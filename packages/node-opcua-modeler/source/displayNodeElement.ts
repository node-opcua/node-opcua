
import {
    BaseNode,
    Reference,
    UAObjectType,
    UAVariable,
} from "node-opcua-address-space";
import { resolveReferenceNode } from "node-opcua-address-space/src/reference";
import { NodeClass } from "node-opcua-data-model";
import { resolveNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";

// tslint:disable-next-line: no-var-requires
const Table = require("cli-table3");

const chars1 = {
    // tslint:disable-next-line: object-literal-sort-keys
    "top": "-", "top-mid": "+", "top-left": "+", "top-right": "+"
    , "bottom": "-", "bottom-mid": "+", "bottom-left": "+", "bottom-right": "+"
    , "left": "|", "left-mid": "+", "mid": "-", "mid-mid": "+"
    , "right": "|", "right-mid": "+", "middle": "|"
};
const chars2 = {
    // tslint:disable-next-line: object-literal-sort-keys
    "top": " ", "top-mid": "   ", "top-left": "  ", "top-right": "  "
    , "bottom": " ", "bottom-mid": "   ", "bottom-left": "  ", "bottom-right": " "
    , "left": "| ", "left-mid": "| ", "mid": "-", "mid-mid": " | "
    , "right": " |", "right-mid": "| ", "middle": " | "
};
const chars3 = {
    // tslint:disable-next-line: object-literal-sort-keys
    "top": "", "top-mid": "", "top-left": "", "top-right": ""
    , "bottom": "", "bottom-mid": "", "bottom-left": "", "bottom-right": ""
    , "left": "| ", "left-mid": "", "mid": "-", "mid-mid": " | "
    , "right": " |", "right-mid": "", "middle": " | "
};

function toMarkdownTable(table: { head: string[], rows: string[][] }): string {

    const t = [];

    t.push("| " + table.head.join(" | ") + " |");
    t.push("| " + table.head.map(() => "---").join(" | ") + " |");
    for (const r of table.rows) {
        t.push("| " + r.join(" | ") + " |");
    }
    return t.join("\n");
}
const a = "ⓂⓄⓋⓥⓇ❗⟵	⟶⟷";
function symbol(nodeClass: NodeClass) {
    switch (nodeClass) {
        case NodeClass.DataType: return "Ⓓ";
        case NodeClass.ObjectType: return "ⓄT";
        case NodeClass.VariableType: return "ⓋT";
        case NodeClass.Method: return "Ⓜ";
        case NodeClass.Object: return "Ⓞ";
        case NodeClass.Variable: return "Ⓥ";
        case NodeClass.View: return "⦖";
        default: return "?";
    }
}
const hasSubtypeNodeId = resolveNodeId("HasSubtype");

export interface DisplayNodeOptions {
    format: "cli" | "markdown";
}

export function displayNodeElement(node: BaseNode, options?: DisplayNodeOptions): string {

    const rows: string[][] = [];
    const head: string[] = [
        "ReferenceType", "NodeId", "BrowseName", "ModellingRule", "TypeDefinition", "DataType", "Value"
    ];
    // instantiate
    const table = new Table({
        // chars,
        head,
        // colWidths: [100, 200, 50, 50,]
    });

    table.push(
        [
            "BrowseName: ",
            { colSpan: 6, content: node.browseName.toString() },
        ],
    );
    rows.push(["BrowseName:", node.browseName.toString()]);

    if (node.description) {
        table.push(
            [
                "Description: ",
                node.description.toString(),
            ],
        );
        rows.push(["Description:", node.description.toString()]);
    }

    const alreadyDumped: any = {};

    function dumpRefe(ref: Reference, filter?: string) {
        resolveReferenceNode(node.addressSpace, ref);
        if (!ref.isForward) {
            return;
        }
        // ignore subtype references
        /* istanbul ignore next */
        if (!ref.node) {
            // tslint:disable-next-line: no-console
            console.log(" Halt ", ref.toString({ addressSpace: node.addressSpace }));
            return;
        }
        const dir = ref.isForward ? " " : " ";
        const refNode = ref.node!;

        const refType = ref._referenceType!;
        if (filter) {
            if (refType.browseName.toString() !== filter) {
                return;
            }
        }
        if (alreadyDumped[refNode.browseName.toString()]) {
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
                const enumValue = v.readEnumValue();
                value = enumValue.value + " (" + enumValue.name + ")";
            } else {
                value = val ? val.toString() : "null";
            }
            const actualDataType = DataType[v.readValue().value.dataType];
            const basicDataType = DataType[v.dataTypeObj.basicDataType];
            dataType = v.dataTypeObj.browseName.toString();
            if (basicDataType !== dataType) {
                dataType = dataType + "(" + basicDataType + ")";
            }
            // findBasicDataType(v.dataTypeObj);
        }

        const row =
            [
                refType.browseName.toString() + dir + symbol(refNode.nodeClass),
                refNode.nodeId.toString(),
                refNode.browseName.toString(),
                modelingRule,
                (refNode as any).typeDefinitionObj ? (refNode as any).typeDefinitionObj.browseName.toString() : ""
                , dataType, value
            ];

        table.push(row);
        rows.push(row);

        alreadyDumped[refNode.browseName.toString()] = 1;

    }
    const references = node.allReferences();

    const m = {};
    for (const ref of references) {
        dumpRefe(ref, "HasSubtype");
    }
    for (const ref of references) {
        dumpRefe(ref, "HasTypeDefinition");
    }
    for (const ref of references) {
        dumpRefe(ref, "HasEncoding");
    }

    for (const ref of references) {
        dumpRefe(ref);
    }

    // add property from derived type
    if (node.nodeClass === NodeClass.ObjectType || node.nodeClass === NodeClass.VariableType) {

        const curNode = node;

        let subtypeOf = (curNode as UAObjectType).subtypeOfObj;
        while (subtypeOf) {
            table.push([subtypeOf.browseName.toString() + ":", "--", "--", "--"]);
            rows.push([subtypeOf.browseName.toString() + ":", "--", "--", "--"]);
            const references2 = subtypeOf.allReferences();
            for (const ref of references2) {
                dumpRefe(ref);
            }
            subtypeOf = (subtypeOf as UAObjectType).subtypeOfObj;
        }
    }

    if (options && options.format === "markdown") {
        return toMarkdownTable({ head, rows });
    } else {
        return table.toString();
    }
}
