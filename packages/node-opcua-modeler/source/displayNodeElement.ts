import {
    BaseNode,
    UAReference,
    UAObjectType,
    UAVariable,
    resolveReferenceNode,
    resolveReferenceType
} from "node-opcua-address-space";
import { NodeClass } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { DataType } from "node-opcua-variant";
import { TableHelper } from "./tableHelper";

const a = "ⓂⓄⓋⓥⓇ❗⟵	⟶⟷";
function symbol(nodeClass: NodeClass) {
    switch (nodeClass) {
        case NodeClass.DataType:
            return "Ⓓ";
        case NodeClass.ObjectType:
            return "ⓄT";
        case NodeClass.VariableType:
            return "ⓋT";
        case NodeClass.Method:
            return "Ⓜ";
        case NodeClass.Object:
            return "Ⓞ";
        case NodeClass.Variable:
            return "Ⓥ";
        case NodeClass.View:
            return "⦖";
        default:
            return "?";
    }
}
const hasSubtypeNodeId = resolveNodeId("HasSubtype");

export interface DisplayNodeOptions {
    format: "cli" | "markdown";
}

export function displayNodeElement(node: BaseNode, options?: DisplayNodeOptions): string {
    const head: string[] = ["ReferenceType", "NodeId", "BrowseName", "ModellingRule", "TypeDefinition", "DataType", "Value"];
    const table = new TableHelper(head);

    table.push(["BrowseName: ", { colSpan: 6, content: node.browseName.toString() }]);

    const superType = (node as UAObjectType).subtypeOfObj;
    if (superType) {
        table.push(["Base", superType.browseName.toString(), { colSpan: 6, content: node.browseName.toString() }]);
    }

    if (node.description) {
        table.push(["Description", node.description.toString(), { colSpan: 6, content: node.browseName.toString() }]);
    }

    const alreadyDumped: any = {};

    const descriptions: any = [];

    function dumpReference(ref: UAReference, filter?: string) {
        resolveReferenceNode(node.addressSpace, ref);
        if (!ref.isForward) {
            return;
        }
        if (NodeId.sameNodeId(ref.referenceType, hasSubtypeNodeId)) {
            return; // ignore forward HasSubtype
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

        const refType = resolveReferenceType(node.addressSpace, ref);
        if (filter) {
            if (refType.browseName.toString() !== filter) {
                return;
            }
        }
        if (alreadyDumped[refNode.nodeId.toString()]) {
            return;
        }
        // xx const r = refNode.findReferencesAsObject("HasModellingRule", true);
        const modelingRule = refNode.modellingRule || ""; //  r[0] ? r[0].browseName.toString() : "/";

        let value = "";
        let dataType = "";
        if (refNode.nodeClass === NodeClass.Variable) {
            const v = refNode as UAVariable;

            const val = v.readValue().value.value;
            if (v.isExtensionObject()) {
                // don't do anything
            } else if (v.isEnumeration() && val !== null) {
                const enumValue = v.readEnumValue();
                value = enumValue.value + " (" + enumValue.name + ")";
            } else if (val instanceof Date) {
                value = val ? val.toUTCString() : "";
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

        const row = [
            refType.browseName.toString() + dir + symbol(refNode.nodeClass),
            refNode.nodeId.toString(),
            refNode.browseName.toString(),
            modelingRule,
            (refNode as any).typeDefinitionObj ? (refNode as any).typeDefinitionObj.browseName.toString() : "",
            dataType,
            value
        ];

        table.push(row);

        descriptions.push({
            description: refNode.description ? refNode.description.toString() : "",
            name: refNode.browseName.name!,
            type: dataType
        });
        alreadyDumped[refNode.nodeId.toString()] = 1;
    }
    const references = node.allReferences();

    const m = {};

    function dumpReferences(_references: UAReference[]) {
        // xx for (const ref of references) {
        // xx  dumpReference(ref, "HasSubtype");
        // xx }
        for (const ref of _references) {
            dumpReference(ref, "HasTypeDefinition");
        }
        for (const ref of _references) {
            dumpReference(ref, "HasEncoding");
        }
        for (const ref of _references) {
            dumpReference(ref, "HasComponent");
        }
        for (const ref of _references) {
            dumpReference(ref, "HasProperty");
        }
        for (const ref of _references) {
            dumpReference(ref, "Organizes");
        }
    }
    dumpReferences(references);

    // add property from base object/variable type
    if (node.nodeClass === NodeClass.ObjectType || node.nodeClass === NodeClass.VariableType) {
        const curNode = node;

        let subtypeOf = (curNode as UAObjectType).subtypeOfObj;
        while (subtypeOf) {
            table.push([subtypeOf.browseName.toString() + ":", "--", "--", "--"]);
            const references2 = subtypeOf.allReferences();
            dumpReferences(references2);
            subtypeOf = (subtypeOf as UAObjectType).subtypeOfObj;
        }
    }

    if (options && options.format === "markdown") {
        return table.toMarkdownTable();
    } else {
        return table.toString();
    }
}
