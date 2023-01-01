import {
    BaseNode,
    UAReference,
    UAObjectType,
    UAVariable,
    resolveReferenceNode,
    resolveReferenceType,
    UAVariableType,
    UAObject
} from "node-opcua-address-space";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";
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
    format?: "cli" | "markdown";
    recursive?: boolean; // default true
}
function encodeXML(s: string) {
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
}
interface Data {
    table: TableHelper;
    node: BaseNode;
    alreadyDumped: Record<string, any>;
    descriptions: Description[];
    subElements?: any[];
}
interface Description {
    description: string;
    name: string;
    type: string;
}

interface DumpReferenceOptions {
    recursive?: boolean;
    filter?: string;
    prefix?: string;
}

function _dumpReferenceVariable(v: UAVariable, value: any, dataType: string): { value: any; dataType: string } {
    const val = v.readValue().value.value;
    if (v.dataType.isEmpty()) {
        return { value, dataType };
    }

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
    return { value, dataType };
}

function getTypeDefinitionAsText(node: BaseNode): string {
    if (node.nodeClass === NodeClass.Object || node.nodeClass === NodeClass.Variable)
        return (node as UAVariable | UAObject).typeDefinitionObj.browseName.toString() || "";
    return "";
}
// eslint-disable-next-line complexity
function dumpReference(data: Data, ref: UAReference, options: DumpReferenceOptions) {
    resolveReferenceNode(data.node.addressSpace, ref);
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
        console.log(" Halt ", ref.toString({ addressSpace: data.node.addressSpace }));
        return;
    }
    const dir = ref.isForward ? " " : " ";
    const refNode = ref.node!;

    const refType = resolveReferenceType(data.node.addressSpace, ref);
    if (options && options.filter && refType.browseName.name !== options.filter) {
        return;
    }
    const key = ref.nodeId.toString() + ref.referenceType.toString();
    if (data.alreadyDumped[key]) {
        return;
    }
    // xx const r = refNode.findReferencesAsObject("HasModellingRule", true);
    const modelingRule = refNode.modellingRule || ""; //  r[0] ? r[0].browseName.toString() : "/";

    let value = "";
    let dataType = "";
    if (refNode.nodeClass === NodeClass.Variable) {
        const v = refNode as UAVariable;
        const t = _dumpReferenceVariable(v, value, dataType);
        value = t.value;
        dataType = t.dataType;
        // findBasicDataType(v.dataTypeObj);
    }
 
    const prefix = options.prefix ? options.prefix + "." : "";
    const row = [
        "".padEnd(prefix.length) + refType.browseName.toString() + dir + symbol(refNode.nodeClass),
        refNode.nodeId.toString(),
        encodeXML(prefix + refNode.browseName.toString()),
        modelingRule,
        getTypeDefinitionAsText(refNode),
        dataType,
        value
    ];

    data.table.push(row);

    data.descriptions.push({
        description: refNode.description ? refNode.description.text || "" : "",
        name: refNode.browseName.name!,
        type: dataType
    });

    // now push all children if there are any
    if (options.recursive) {
        const subReferences = refNode.findReferencesEx("HasChild", BrowseDirection.Forward);
        if (subReferences.length) {
            // xx console.log("refNode ", refNode.nodeId.toString(), refNode.toString());

            const rowMidHeader = [encodeXML(prefix + refNode.browseName.toString()), "", "", "", "", "", ""];
            data.table.push(rowMidHeader);
            for (const subReference of subReferences) {
                dumpReference(data, subReference, {
                    ...options,
                    prefix: prefix + refNode.browseName.toString(),
                    recursive: false,
                    filter: undefined
                });
            }
        }
    }
    data.alreadyDumped[key] = 1;
}

function dumpReferences(data: Data, _references: UAReference[], options: DumpReferenceOptions) {
    // xx for (const ref of references) {
    // xx  dumpReference(ref, "HasSubtype");
    // xx }
    for (const ref of _references) {
        dumpReference(data, ref, { filter: "HasTypeDefinition" });
    }
    for (const ref of _references) {
        dumpReference(data, ref, { filter: "HasEncoding" });
    }
    for (const ref of _references) {
        dumpReference(data, ref, { ...options, filter: "HasComponent" });
    }
    for (const ref of _references) {
        dumpReference(data, ref, { ...options, filter: "HasProperty" });
    }
    for (const ref of _references) {
        dumpReference(data, ref, { ...options, filter: "Organizes" });
    }
    for (const ref of _references) {
        dumpReference(data, ref, { filter: "HasInterface" });
    }
    for (const ref of _references) {
        dumpReference(data, ref, {});
    }
    /// subElements = [];
}

function shortDescription(d: string) {
    return d.split(/\.|\n/)[0];
}
export function displayNodeElement(node: BaseNode, options?: DisplayNodeOptions): string {
    const recursive = options && options.recursive !== undefined ? !!options.recursive : true;

    const head: string[] = ["ReferenceType", "NodeId", "BrowseName", "ModellingRule", "TypeDefinition", "DataType", "Value"];

    function createTable() {
        const table = new TableHelper(head);
        table.push(["BrowseName: ", { colSpan: 6, content: node.browseName.toString() }]);

        const superType = (node as UAObjectType).subtypeOfObj;
        if (superType) {
            table.push(["Base", superType.browseName.toString(), { colSpan: 6, content: node.browseName.toString() }]);
        }

        if (node.description) {
            table.push(["Description", { colspan: 6, content: shortDescription(node.description.text! || "") }]);
        }
        return table;
    }

    const table = createTable();

    const alreadyDumped: Record<string, any> = {};

    const descriptions: Description[] = [];

    const references = node.allReferences();

    const data = { table, node, alreadyDumped, descriptions };

    dumpReferences(data, references, { recursive });

    function toText(table: TableHelper) {
        if (options && options.format === "markdown") {
            return table.toMarkdownTable();
        } else {
            return table.toString();
        }
    }

    const str: string[] = [];
    const tables: TableHelper[] = [];
    tables.push(table);

    if (node.description) {
        str.push(node.description.text! || "");
        str.push("");
    }
    str.push(toText(table));

    const str2: string[] = [];

    // add property from base object/variable type
    if (node.nodeClass === NodeClass.ObjectType || node.nodeClass === NodeClass.VariableType) {
        const curNode = node;

        let subtypeOf = (curNode as UAObjectType | UAVariableType).subtypeOfObj;
        while (subtypeOf) {
            data.table = createTable();
            data.table.push([subtypeOf.browseName.toString() + ":", "--", "--", "--"]);
            const references2 = subtypeOf.allReferences();

            dumpReferences(data, references2, { recursive: false });

            str.push("<details>");
            str.push("<summary>Base type: " + subtypeOf.browseName.toString() + "</summary>");
            str.push("");
            str.push(toText(data.table));
            str.push("");
            str2.push("</details>");

            subtypeOf = (subtypeOf as UAObjectType).subtypeOfObj;
        }
    }
    return str.join("\n") + str2.join("\n");
}
