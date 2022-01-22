import {
    BaseNode,
    UAReference,
    UAObject,
    UAVariable,
    UAReferenceType,
    UADataType,
    UAObjectType,
    UAVariableType,
    UAMethod
} from "node-opcua-address-space";
import { ReferenceTypeIds } from "node-opcua-constants";
import { BrowseDirection, NodeClass } from "node-opcua-data-model";

function innerText(node: UAObject | UAVariable) {
    const browseName = node.browseName.name;
    const typeDefinition = node.typeDefinitionObj?.browseName?.name;

    if (typeDefinition) {
        return `[ label =< <FONT point-size="8" ><I>${typeDefinition}</I></FONT><BR/>${browseName} >]`;
    } else {
        return `[label =< ${browseName} >]`;
    }
}
function arrowHeadAttribute(reference: UAReference): string {
    switch (reference.referenceType.value) {
        case ReferenceTypeIds.HasTypeDefinition:
            return "normalnormal";
        case ReferenceTypeIds.HasComponent:
            return "noneteetree";
        case ReferenceTypeIds.HasProperty:
            return "nonetee";
        case ReferenceTypeIds.HasSubtype:
            return "onormalonormal";
        case ReferenceTypeIds.HasModellingRule:
            return "none";
        default:
            return "normal";
    }
}
function arrowHead(reference: UAReference): string {
    return `[arrowhead = ${arrowHeadAttribute(reference)}]`;
}

const regularShapes: Record<string, string> = {
    ObjectType: '[shape=rectangle, style="filled" fillcolor="#e8edf7;0.75:#d2def0" gradientangle=275]',
    VariableType: '[shape=rectangle, style="rounded,filled" fillcolor="#e8edf7;0.75:#d2def0" gradientangle=275]',
    Object: ' [shape=rectangle, style="rounded,filled" fillcolor="#e8edf7"]',
    Variable: '[shape=rectangle, style="filled,rounded" fillcolor="#e8edf7"]',
    Method: '[shape=circle, style="filled" fillcolor="#e8edf7"]'
};
const regularShapesOptionals: Record<string, string> = {
    ObjectType: '[shape=rectangle, style="filled,dashed" fillcolor="#e8edf7;0.75:#d2def0" gradientangle=275]',
    VariableType: '[shape=rectangle, style="rounded,filled,dashed" fillcolor="#e8edf7;0.75:#d2def0" gradientangle=275]',
    Object: ' [shape=rectangle, style="rounded,filled,dashed" fillcolor="#e8edf7"]',
    Variable: '[shape=rectangle, style="filled,rounded,dashed" fillcolor="#e8edf7"]',
    Method: '[shape=circle, style="filled,dashed" fillcolor="#e8edf7"]'
};

interface Options {
    naked: boolean;
}

class NodeRegistry {
    m: Record<string, BaseNode[]> = {};
    invisibleNodes: string[] = [];
    add(node: BaseNode) {
        const nodeClass = NodeClass[node.nodeClass];
        this.m[nodeClass] = this.m[nodeClass] || [];
        this.m[nodeClass].push(node);
    }
    addInvisibleNode(name: string) {
        this.invisibleNodes.push(name);
    }
}
function dumpNodeByNodeClass(str: string[], nodeRegistry: NodeRegistry) {
    for (const [className, listNode] of Object.entries(nodeRegistry.m)) {
        if (listNode.length === 0) {
            continue;
        }
        str.push(`  ## -> ${className}`);

        const mandatoryNodes = listNode.filter((node) => !node.modellingRule || node.modellingRule.match(/Mandatory/));
        const optionalNodes = listNode.filter((node) => node.modellingRule && node.modellingRule.match(/Optional/));
        if (mandatoryNodes.length > 0) {
            str.push(`  node [];`);
            const decoration = regularShapes[className] as string;
            str.push(`  node ${decoration};`);
            for (const node of mandatoryNodes) {
                str.push(`  ${node.browseName.name} ${innerText(node as UAVariable | UAObject)}`);
            }
        }
        if (optionalNodes.length > 0) {
            const decoration2 = regularShapesOptionals[className] as string;
            str.push(`  node [];`);
            str.push(`  node ${decoration2};`);
            for (const node of listNode) {
                str.push(`  ${node.browseName.name} ${innerText(node as UAVariable | UAObject)}`);
            }
        }
    }
    if (nodeRegistry.invisibleNodes.length) {
        str.push("  #  invisible nodes");
        str.push("  node []");
        str.push("  node [width=0,height=0,shape=point,style=invis];");
        str.push(`  ${nodeRegistry.invisibleNodes.join("\n  ")};`);
    }
}
export function opcuaToDot(node: UAObjectType | UAVariableType, options?: Options): string {
    options = options || { naked: false };
    const nodeRegistry = new NodeRegistry();
    nodeRegistry.add(node);

    const str: string[] = [];
    const str2: string[] = [];
    str.push("digraph G {");
    if (!options.naked) {
        str.push("  rankdir=TB;");
        str.push("  nodesep=0.5;");
        str.push("  node [];");
    }

    // eslint-disable-next-line max-statements
    function typeMemberAndSubTypeMember(
        str: string[],
        node: UAObjectType | UAVariableType | UAMethod | UAVariable | UAObject,
        parent: UAObjectType | UAVariableType | UAMethod | UAVariable | UAObject | null,
        offset: number,
        prefix: string,
        joinWithCaller: boolean
    ): [number, string[]] {
        let innerDepth = 0;
        const browseName = (parent || node).browseName.name!.toString();
        const r: string[] = [];
        const r2: string[] = [];
        const references = node.findReferencesEx("Aggregates", BrowseDirection.Forward);
        const folderElements = node.findReferencesEx("Organizes", BrowseDirection.Forward);
        const childReferences = [...references, ...folderElements];
        for (let i = 0; i < childReferences.length; i++) {
            const isLast = i === childReferences.length - 1;
            innerDepth++;
            const reference = childReferences[i];

            const childNode = reference.node! as UAVariable | UAObject | UAMethod;
            const childName = childNode.browseName.name!.toString();
            nodeRegistry.add(childNode);
            const edgeAttributes = arrowHead(reference);

            const breakNode = `${prefix}${i + offset}`;
            r2.push(breakNode);
            nodeRegistry.addInvisibleNode(breakNode);
            const horizontalPart = `{ rank=same ${breakNode} -> ${childName} ${edgeAttributes} }`;
            r.push(horizontalPart);

            // push children  on same level
            const [depth] = typeMemberAndSubTypeMember(str, childNode, null, 0, `${prefix}${i + offset}_`, false);
            for (let d = 0; d < depth; d++) {
                offset++;
                if (!isLast) {
                    const breakNode = `${prefix}${i + offset}`;
                    r2.push(breakNode);
                    nodeRegistry.addInvisibleNode(breakNode);
                }
            }
            innerDepth += depth;
        }

        if (node.nodeClass == NodeClass.ObjectType || node.nodeClass === NodeClass.VariableType) {
            if (node.subtypeOfObj && node.subtypeOfObj.nodeId.namespace === node.nodeId.namespace) {
                const [depth, rr2] = typeMemberAndSubTypeMember(str, node.subtypeOfObj, node, r.length, prefix, true);
                innerDepth += depth;
                r2.push(...rr2);
            }
        }
        if (r.length) {
            str.push(...r.map((x) => "  " + x));
        }
        if (!joinWithCaller) {
            if (r2.length) {
                str.push(`  ${browseName} -> ${r2.join(" -> ")} [arrowhead=none];`);
            }
        }

        return [innerDepth, r2];
    }

    typeMemberAndSubTypeMember(str2, node, null, 0, "r", false);

    if (!options.naked) {
        dumpNodeByNodeClass(str, nodeRegistry);
    }
    str.push(...str2);
    str.push("}");

    //
    const dot = str.join("\n");
    return dot;
}

export function dumpClassHierachry(
    typeNode: UAObjectType | UAVariableType | UADataType | UAReferenceType,
    options?: { naked?: boolean; depth?: number; showBaseType?: boolean; showSubType?: boolean }
) {
    options = options || { naked: false, showBaseType: true, showSubType: true };
    const level = options.depth || 50;

    const str: string[] = [];
    const nodeRegistry = new NodeRegistry();
    nodeRegistry.add(typeNode);
    str.push("digraph G {");
    if (!options.naked) {
        // str.push("  splines=ortho;");
        str.push("  rankdir=BT;");
        str.push("  nodesep=0.5;");
        str.push("  node [];");
    }
    function dumpSubtypes(str: string[], typeNode: BaseNode, level: number) {
        const parentName = typeNode.browseName.name!.toString();
        const references = typeNode.findReferencesEx("HasSubtype", BrowseDirection.Forward);
        for (let i = 0; i < references.length; i++) {
            const reference = references[i];
            const childNode = reference.node! as UAVariable | UAObject | UAMethod;
            const nodeClass = NodeClass[childNode.nodeClass];
            const childName = childNode.browseName.name!.toString();
            nodeRegistry.add(typeNode);
            const edgeAttributes = arrowHead(reference);
            str.push(`  ${childName}  -> ${parentName} ${edgeAttributes};`);

            if (level > 0) {
                dumpSubtypes(str, childNode, level - 1);
            }
        }
    }
    /** */
    const str2: string[] = [];
    if (options.showSubType) {
        dumpSubtypes(str2, typeNode, level);
    }
    if (!options.naked) {
        dumpNodeByNodeClass(str, nodeRegistry);
    }
    str.push(...str2);
    str.push("}");
    return str.join("\n");
}
function graphVizToPlantUml(str: string[]): string {
    const ttt = "```";
    return `${ttt}plantuml\n@startuml\n${str.join("\n")}\n@enduml\n${ttt}`;
}
export function dumpTypeDiagram(namespace: any) {
    const objectTypes = [...namespace._objectTypeIterator()];
    const variableTypes = [...namespace._variableTypeIterator()];
    const dataTypes = [...namespace._dataTypeIterator()];
    const referenceTypes = [...namespace._referenceTypeIterator()];
    const addressSpace = namespace.addressSpace;

    const str: string[] = [];
    for (const type of [...objectTypes, ...variableTypes]) {
        const d = opcuaToDot(type);
        str.push(graphVizToPlantUml([d]));

        const d2 = dumpClassHierachry(type);
        str.push(graphVizToPlantUml([d2]));
    }
    for (const dataType of dataTypes) {
        const d = opcuaToDot(dataType);
        str.push(graphVizToPlantUml([d]));
    }
    return str.join("\n");
}
