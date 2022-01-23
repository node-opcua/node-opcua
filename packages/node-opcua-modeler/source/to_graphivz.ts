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

function e(str: string): string {
    return str.replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
function innerText(node: UAObject | UAVariable) {
    const browseName = node.browseName.name;
    const typeDefinition = node.typeDefinitionObj?.browseName?.name;

    if (typeDefinition) {
        return `[ label =< <FONT point-size="8" ><I>${typeDefinition}</I></FONT><BR/>${e(browseName!)} >]`;
    } else {
        return `[label =< ${e(browseName!)} >]`;
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
    m: Record<string, { name: string; node: BaseNode }[]> = {};
    invisibleNodes: string[] = [];
    duplicated: { [key: string]: string } = {};
    add(name: string, node: BaseNode) {
        
        if (this.duplicated[name]) {
            return;//throw new Error("Already included");
        }
        this.duplicated[name]= name;
        const nodeClass = NodeClass[node.nodeClass];
        this.m[nodeClass] = this.m[nodeClass] || [];
        this.m[nodeClass].push({ name, node });

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

        const mandatoryNodes = listNode.filter(({ name, node }) => !node.modellingRule || node.modellingRule.match(/Mandatory/));
        const optionalNodes = listNode.filter(({ name, node }) => node.modellingRule && node.modellingRule.match(/Optional/));
        if (mandatoryNodes.length > 0) {
            str.push(`  node [];`);
            const decoration = regularShapes[className] as string;
            str.push(`  node ${decoration};`);
            for (const { name, node } of mandatoryNodes) {
                str.push(`  ${name} ${innerText(node as UAVariable | UAObject)}`);
            }
        }
        if (optionalNodes.length > 0) {
            const decoration2 = regularShapesOptionals[className] as string;
            str.push(`  node [];`);
            str.push(`  node ${decoration2};`);
            for (const { name, node } of listNode) {
                str.push(`  ${name} ${innerText(node as UAVariable | UAObject)}`);
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

    const str: string[] = [];
    const str2: string[] = [];
    str.push("digraph G {");
    if (!options.naked) {
        str.push("  rankdir=TB;");
        str.push("  nodesep=0.5;");
        str.push("  node [];");
    }

    function makeId(p: string, c: string) {
        return `${p}_${c}`.replace(" ", "_").replace(/<|>/g, "_");	
    }
    // eslint-disable-next-line max-params
    // eslint-disable-next-line max-statements
    function typeMemberAndSubTypeMember(
        str: string[],
        parentNode: string,
        node: UAObjectType | UAVariableType | UAMethod | UAVariable | UAObject,
        parent: UAObjectType | UAVariableType | UAMethod | UAVariable | UAObject | null,
        offset: number,
        prefix: string,
        joinWithCaller: boolean,
        visitorMap: Record<string, any>
    ): [number, string[]] {
        let innerDepth = 0;
        const browseName = (parent || node).browseName.name!.toString();
        const r: string[] = [];
        const r2: string[] = [];
        const references = node.findReferencesEx("Aggregates", BrowseDirection.Forward);
        const folderElements = node.findReferencesEx("Organizes", BrowseDirection.Forward);
        const childReferences = [...references, ...folderElements];
        const id = makeId(parentNode,browseName);
        nodeRegistry.add(id, node);

        function addInvisibleNode(prefix: string, index: number) {
            const breakNode = `${prefix}${index}`;
            r2.push(breakNode);
            nodeRegistry.addInvisibleNode(breakNode);
            return breakNode;
        }
        for (let i = 0; i < childReferences.length; i++) {
            const isLast = i === childReferences.length - 1;
            const reference = childReferences[i];

            const childNode = reference.node! as UAVariable | UAObject | UAMethod;
            const childName = childNode.browseName.name!.toString();

            const fullChildName = makeId(id,childName);
            // avoid member duplication
            if (visitorMap[fullChildName]) {
                continue;
            } else {
                visitorMap[fullChildName] = 1;
            }

            innerDepth++;

            nodeRegistry.add(fullChildName, childNode);
            const edgeAttributes = arrowHead(reference);

            const breakNode = addInvisibleNode(prefix, i + offset);
            const horizontalPart = `{ rank=same ${breakNode} -> ${fullChildName} ${edgeAttributes} }`;
            r.push(horizontalPart);

            // push children  on same level
            const [depth] = typeMemberAndSubTypeMember(str, id, childNode, null, 0, `${prefix}${i + offset}_`, false, visitorMap);

            // add invisible nodes
            {
                for (let d = 0; d < depth; d++) {
                    offset++;
                    if (!isLast) {
                        addInvisibleNode(prefix, i + offset);
                    }
                }
                innerDepth += depth;
            }
        }

        if (node.nodeClass == NodeClass.ObjectType || node.nodeClass === NodeClass.VariableType) {
            if (node.subtypeOfObj && node.subtypeOfObj.nodeId.namespace === node.nodeId.namespace) {
                const [depth, rr2] = typeMemberAndSubTypeMember(
                    str,
                    parentNode,
                    node.subtypeOfObj,
                    node,
                    r.length,
                    prefix,
                    true,
                    visitorMap
                );
                innerDepth += depth;
                r2.push(...rr2);
            }
        }
        if (r.length) {
            str.push(...r.map((x) => "  " + x));
        }

        if (!joinWithCaller) {
            if (r2.length) {
                str.push(`  ${id} -> ${r2.join(" -> ")} [arrowhead=none];`);
            }
        }

        return [innerDepth, r2];
    }

    const visitorMap = {};
    typeMemberAndSubTypeMember(str2, "", node, null, 0, "r", false, visitorMap);

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
    nodeRegistry.add(typeNode.browseName.name!, typeNode);
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
            const childNode = reference.node! as UAVariableType | UAObjectType;
            const nodeClass = NodeClass[childNode.nodeClass];
            const childName = childNode.browseName.name!.toString();
            nodeRegistry.add(childName, childNode);
            const edgeAttributes = arrowHead(reference);
            str.push(`  ${childName}  -> ${parentName} ${edgeAttributes};`);

            if (level > 0) {
                dumpSubtypes(str, childNode, level - 1);
            }
        }
    }
    function dumpBaseTypes(str: string[], typeNode: BaseNode, level: number) {
        const parentName = typeNode.browseName.name!.toString();
        const references = typeNode.findReferencesEx("HasSubtype", BrowseDirection.Inverse);
        for (let i = 0; i < references.length; i++) {
            const reference = references[i];
            const childNode = reference.node! as UAVariableType | UAObjectType;
            const nodeClass = NodeClass[childNode.nodeClass];
            const childName = childNode.browseName.name!.toString();
            nodeRegistry.add(childName, childNode);
            const edgeAttributes = arrowHead(reference);
            str.push(`  ${parentName}  -> ${childName} ${edgeAttributes};`);
            if (level > 0) {
                dumpBaseTypes(str, childNode, level - 1);
            }
        }
    }
    const str2: string[] = [];
    if (options.showBaseType) {
        dumpBaseTypes(str2, typeNode, level);
    }
    /** */
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

export function graphVizToPlantUml(str: string): string {
    const ttt = "```";
    return `${ttt}plantuml\n@startuml\n${str}\n@enduml\n${ttt}`;
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
        str.push(graphVizToPlantUml(d));

        const d2 = dumpClassHierachry(type);
        str.push(graphVizToPlantUml(d2));
    }
    for (const dataType of dataTypes) {
        const d = opcuaToDot(dataType);
        str.push(graphVizToPlantUml(d));
    }
    return str.join("\n");
}
