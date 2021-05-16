import *  as wrap from "wordwrap";
import {
    AttributeIds,
    LocalizedText,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { NodeId, NodeIdLike } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import {
    EnumDefinition,
    ReferenceDescription,
    StructureDefinition,
    _enumerationDataChangeTrigger
} from "node-opcua-types";
import { ModellingRuleType, NodeIdManager } from "node-opcua-address-space";
import { LineFile, lowerFirstLetter } from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import {
    convertNodeIdToDataTypeAsync,
    getBrowseName,
    getIsAbstract,
    getDefinition,
    getDescription,
    getModellingRule,
    getNodeClass,
    getSubtypeNodeId,
    getSubtypeNodeIdIfAny,
    getTypeDefOrBaseType,
    getChildrenOrFolderElements
} from "./utils";

import {
    Cache,
    constructCache,
    Import,
    makeTypeNameNew,
    referenceExtensionObject,
    RequestedSubSymbol
} from "./cache";
import assert from "node-opcua-assert";

const wrapText = wrap(0,50);

export async function convertDataTypeToTypescript(session: IBasicSession, dataTypeId: NodeId) {
    const definition = await getDefinition(session, dataTypeId);
    const browseName = await getBrowseName(session, dataTypeId);

    const dataTypeTypescriptName = `UA${browseName.name!.toString()}`;
    const f = new LineFile();
    if (definition && definition instanceof StructureDefinition) {
        f.write(`interface ${dataTypeTypescriptName} {`);
        for (const field of definition.fields || []) {
        }
        f.write(`}`);
    }
}

// to avoid clashes 
function toJavascritPropertyName(childName: string): string {
    childName = lowerFirstLetter(childName);
    if (childName === "namespaceUri") {
        childName = "$namespaceUri";
    }
    if (childName === "rolePermissions") {
        childName = "$rolePermissions";
    }
    if (childName === "displayName") {
        childName = "$displayName";
    }

    return childName
        .replace(/\</g, "$")
        .replace(/>/g, "$")
        .replace(/ |\./g, "_")
        .replace(/#/g, "_");;
}

function quotifyIfNecessary(s: string): string {
    if (s.match(/(^[^a-zA-Z])|([^a-zA-Z_0-9])/)) {
        return `"${s}"`;
    }
    if (s === "nodeClass") {
        return `["$nodeClass"]`;
    }
    return s;
}
async function getCorrepondingJavascriptType(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    cache: Cache,
    referenceBasicType1: (t: Import) => void
): Promise<{ dataType: DataType; jtype: string }> {
    const dataType = await convertNodeIdToDataTypeAsync(session, dataTypeNodeId);

    const referenceBasicType = (name: string): string => {
        const t = { name, namespace: -1, module: "BasicType" };
        referenceBasicType1(t);
        cache.ensureImported(t);
        return t.name;
    }
    if (dataType === DataType.ExtensionObject) {
        const jtypeImport = await referenceExtensionObject(session, dataTypeNodeId);
        const jtype = jtypeImport.name;
        referenceBasicType1(jtypeImport);
        return { dataType, jtype: jtype }
    }
    switch (dataType) {
        case DataType.Null:
            return { dataType, jtype: "undefined" };
        case DataType.Boolean:
            return { dataType, jtype: "boolean" };
        case DataType.Byte:
            return { dataType, jtype: referenceBasicType("Byte") };
        case DataType.ByteString:
            return { dataType, jtype: "Buffer" };
        case DataType.DataValue:
            return { dataType, jtype: referenceBasicType("DataValue") };
        case DataType.DateTime:
            return { dataType, jtype: "Date" };
        case DataType.DiagnosticInfo:
            return { dataType, jtype: referenceBasicType("DiagnosticInfo") };
        case DataType.Double:
            return { dataType, jtype: "number" };
        case DataType.Float:
            return { dataType, jtype: "number" };
        case DataType.Guid:
            return { dataType, jtype: referenceBasicType("Guid") };
        case DataType.Int16:
            return { dataType, jtype: referenceBasicType("Int16") };
        case DataType.Int32:
            return { dataType, jtype: referenceBasicType("Int32") };
        case DataType.UInt16:
            return { dataType, jtype: referenceBasicType("UInt16") };
        case DataType.UInt32:
            return { dataType, jtype: referenceBasicType("UInt32") };
        case DataType.UInt64:
            return { dataType, jtype: referenceBasicType("UInt64") };
        case DataType.Int64:
            return { dataType, jtype: referenceBasicType("Int64") };
        case DataType.LocalizedText:
            return { dataType, jtype: referenceBasicType("LocalizedText") };
        case DataType.NodeId:
            return { dataType, jtype: referenceBasicType("NodeId") };
        case DataType.ExpandedNodeId:
            return { dataType, jtype: referenceBasicType("ExpandedNodeId") };
        case DataType.QualifiedName:
            return { dataType, jtype: referenceBasicType("QualifiedName") };
        case DataType.SByte:
            return { dataType, jtype: referenceBasicType("SByte") };
        case DataType.StatusCode:
            return { dataType, jtype: referenceBasicType("StatusCode") };
        case DataType.String:
            return { dataType, jtype: referenceBasicType("UAString") };
        case DataType.UInt16:
            return { dataType, jtype: referenceBasicType("UInt16") };
        case DataType.UInt32:
            return { dataType, jtype: referenceBasicType("UInt32") };
        case DataType.UInt64:
            return { dataType, jtype: referenceBasicType("UInt64") };
        case DataType.Variant:
            return { dataType, jtype: referenceBasicType("Variant") };
        case DataType.XmlElement:
            return { dataType, jtype: referenceBasicType("UAString") };
        default:
            throw new Error("Unsupported " + dataType + " " + DataType[dataType]);
    }
}


interface ClassDefinition {
    nodeClass: NodeClass.ObjectType | NodeClass.VariableType;
    browseName: QualifiedName,
    isAbstract: boolean,
    description: LocalizedText;
    //
    superType?: ReferenceDescription,
    baseClassDef?: ClassDefinition | null,
    //
    children: ReferenceDescription[];
    members: ClassMember[];
    //
    interfaceName: Import;
    baseInterfaceName: Import | null;
}

export function makeTypeName2(nodeClass: NodeClass, browseName: QualifiedName): Import {

    if (nodeClass === NodeClass.Method) {
        return { name: "UAMethod", namespace: 0, module: "UAMethod" };
    }
    return makeTypeNameNew(nodeClass, null, browseName);
}

export async function extractClassDefinition(session: IBasicSession, nodeId: NodeId, cache: Cache): Promise<ClassDefinition> {

    const _c = (cache as any).classDefCache || {};
    (cache as any).classDefCache = _c;

    let classDef: ClassDefinition | null = _c[nodeId.toString()];
    if (classDef) {
        return classDef;
    }
    const nodeClass = await getNodeClass(session, nodeId);
    if (nodeClass !== NodeClass.VariableType && nodeClass !== NodeClass.ObjectType) {
        throw new Error("Invalid nodeClass " + NodeClass[nodeClass] + " nodeId " + nodeId.toString());
    }

    const browseName = await getBrowseName(session, nodeId);
    const isAbstract = await getIsAbstract(session, nodeId);
    const superType = await getSubtypeNodeIdIfAny(session, nodeId) || undefined;

    const baseClassDef = !superType ? null : await extractClassDefinition(session, superType.nodeId, cache);

    const description = await getDescription(session, nodeId);
    // const definition = await getDefinition(session, nodeId);

    const interfaceName: Import = makeTypeName2(nodeClass, browseName);

    const baseInterfaceName: Import | null = !superType ? null : makeTypeName2(nodeClass, superType.browseName);

    // extract member
    const children = await getChildrenOrFolderElements(session, nodeId);

    const members: ClassMember[] = [];
    classDef = {
        nodeClass,
        browseName,
        isAbstract,

        superType,
        baseClassDef,

        description,
        // definition,
        children,
        members,

        interfaceName,
        baseInterfaceName,
    };
    _c[nodeId.toString()] = classDef;

    for (const child of children) {
        const c = await extractClassMemberDef(session, child.nodeId, classDef, cache);
        classDef.members.push(c);
    }
    return classDef;
}



interface ClassMemberBasic {
    name: string;
    childType: Import;
    isOptional: boolean;
    modellingRule: ModellingRuleType | null;
    description: LocalizedText;
    suffix?: string;

    typeToReference: Import[];
}


interface ClassMember extends ClassMemberBasic {
    /**
     * the OPCUA name of the class member
     */
    browseName: QualifiedName;
    nodeClass: NodeClass.Object | NodeClass.Method | NodeClass.Variable;
    /**
     * the Typescript name of the class Member
     */
    name: string;

    modellingRule: ModellingRuleType | null;
    isOptional: boolean;

    /**
     * class Def
     */
    classDef: ClassDefinition | null;

    description: LocalizedText;
    //
    typeDefinition: ReferenceDescription;

    childType: Import;

    children: ReferenceDescription[];
    children2: ClassMemberBasic[];

    // for variables:
    dataTypeNodeId?: NodeId;
    dataType?: DataType,
    jtype?: string;
    suffix?: string;
    suffix2?: string;
    suffix3?: string;

    innerClass?: Import | null;
    childBase?: Import | null;


}


interface Classified {
    "Mandatory": ReferenceDescription[];
    "Optional": ReferenceDescription[];
    "MandatoryPlaceholder": ReferenceDescription[];
    OptionalPlaceholder: ReferenceDescription[];
    ExposesItsArray: ReferenceDescription[];
}
async function classify(session: IBasicSession, refs: ReferenceDescription[]): Promise<Classified> {

    const r: Classified = {
        Mandatory: [],
        Optional: [],
        MandatoryPlaceholder: [],
        OptionalPlaceholder: [],
        ExposesItsArray: []
    };

    for (const mm of refs) {
        const modellingRule = await getModellingRule(session, mm.nodeId);
        if (modellingRule) {
            r[modellingRule] = r[modellingRule] || [];
            r[modellingRule].push(mm);
        }
    }
    return r;
}


async function extractAllMembers(session: IBasicSession, classDef: ClassDefinition, cache: Cache) {

    let m = [...classDef.children];
    let s = classDef;
    while (s.baseClassDef) {
        s = s.baseClassDef;
        // start from top most class
        // do not overwrite most top member definition, so we get mandatory stuff 
        for (const mm of s.children) {
            const found = m.findIndex((r) => r.browseName.toString() === mm.browseName.toString());
            if (found < 0) {
                m.push(mm);
            }
        }
    }
    // now separate mandatory and optionals
    const members = await classify(session, m);
    return members;
}
export async function findClassMember(
    session: IBasicSession,
    browseName: QualifiedName,
    baseParentDef: ClassDefinition,
    cache: Cache
): Promise<ClassMember | null> {
    const str = browseName.toString();
    const r = baseParentDef.children.find((a) => a.browseName.toString() === str);
    if (r) {
        const d = await extractClassMemberDef(session, r!.nodeId, baseParentDef, cache);
        return d;
    }
    const baseBaseParentDef = baseParentDef.superType && await extractClassDefinition(session, baseParentDef.superType!.nodeId, cache);
    if (!baseBaseParentDef) {
        return null;
    };
    return await findClassMember(session, browseName, baseBaseParentDef, cache);
}
function hasNewMaterial(referenceMembers: ReferenceDescription[], instanceMembers: ReferenceDescription[]) {
    const ref = referenceMembers.map((x) => x.browseName.toString()).sort();
    const instance = instanceMembers.map((x) => x.browseName.toString()).sort();
    for (const n of instance) {
        if (ref.findIndex((x) => x === n) < 0) {
            return true;
        }
    }
    return false;
}

// we should expose an inner definition if 
//  - at least one mandatory in instnace doesn't exist in main.Mandatory
//  - at least one optional in instnace doesn't exist in main.Mandatory
export function checkIfShouldExposeInnerDefinition(main: Classified, instance: Classified): boolean {

    const hasNewStuff = hasNewMaterial(main.Mandatory, instance.Mandatory) ||
        hasNewMaterial(main.Optional, instance.Optional);
    return hasNewStuff;

}

function dump1(a: Classified) {
    console.log("Mandatory = ", a.Mandatory.map(x => x.browseName.toString()).sort().join(" "));
    console.log("Optional  = ", a.Optional.map(x => x.browseName.toString()).sort().join(" "));
}

async function _extractLocalMembers(session: IBasicSession, classMember: ClassMember, cache: Cache): Promise<ClassMemberBasic[]> {

    const children2: ClassMemberBasic[] = [];
    for (const child of classMember.children) {

        const nodeId = child.nodeId;
        const browseName = await getBrowseName(session, nodeId);
        const name = toJavascritPropertyName(browseName.name!);

        const description = await getDescription(session, nodeId);
        const modellingRule = await getModellingRule(session, nodeId);
        const isOptional = modellingRule === "Optional";

        const typeDefinition = await getTypeDefOrBaseType(session, nodeId);

        //
        const childInBase = classMember.classDef?.members.find((a) => a.browseName.toString() === browseName.toString());

        let childType: Import;
        if (childInBase) {
            childType = childInBase.childType; 
        } else {
           const d = typeDefinition.nodeId.isEmpty() ? null : await extractClassDefinition(session, typeDefinition.nodeId, cache);
           childType = d?.interfaceName || { name: 'UAMethod', module: "BasicType", namespace: -1 };
        }
  
        // may be childType is already 
        
        const { suffix, typeToReference } = await extractVariableExtra(session, child.nodeId, cache);

        const c: ClassMemberBasic = {
            childType,
            description,
            isOptional,
            modellingRule,
            name,
            suffix,
            typeToReference
        };
        children2.push(c);
    }
    return children2;
}

async function extractVariableExtra(session: IBasicSession, nodeId: NodeId, cache: Cache) {

    const typeToReference: Import[] = [];
    const importCollector = (i: Import) => {
        typeToReference.push(i);
    }
    const nodeClass = await getNodeClass(session, nodeId);
    if (nodeClass === NodeClass.Variable) {
        const dataTypeNodeIdDatValue = await session.read({ nodeId, attributeId: AttributeIds.DataType });
        const dataTypeNodeId = dataTypeNodeIdDatValue.value.value as NodeId;
        const { dataType, jtype } = await getCorrepondingJavascriptType(session, dataTypeNodeId, cache, importCollector);

        cache && cache.referenceBasicType("DataType");
        importCollector({ name: "DataType", namespace: -1, module: "BasicType" });

        const suffix =
            (jtype === "undefined" || dataType === DataType.Null)
                ? `<any, any>` : `<${jtype}, DataType.${DataType[dataType]}>`;
        const suffix2 = `<T, DT extends DataType>`;
        const suffix3 = `<T,DT>`;
        return { suffix, suffix2, suffix3, dataTypeNodeId, dataType, jtype, typeToReference };

    }
    return { suffix: "", typeToReference };
}

interface ClassDefinitionB {
    superType?: {
        nodeId: NodeId
    };
    interfaceName: Import
}
export async function extractClassMemberDef(
    session: IBasicSession,
    nodeId: NodeId,
    parentDef: ClassDefinitionB,
    cache: Cache
): Promise<ClassMember> {

    const nodeClass = await getNodeClass(session, nodeId);
    const browseName = await getBrowseName(session, nodeId);
    const name = toJavascritPropertyName(browseName.name!);

    if (nodeClass !== NodeClass.Method && nodeClass !== NodeClass.Object && nodeClass !== NodeClass.Variable) {
        throw new Error("Invalid property " + NodeClass[nodeClass] + " " + browseName?.toString() + " " + nodeId.toString());
    }

    const description = await getDescription(session, nodeId);
    const children = await getChildrenOrFolderElements(session, nodeId);

    const modellingRule = await getModellingRule(session, nodeId);
    const isOptional = modellingRule === "Optional";

    const typeDefinition = await getTypeDefOrBaseType(session, nodeId);
    let childType = makeTypeName2(nodeClass, typeDefinition.browseName);

    const classDef = typeDefinition.nodeId.isEmpty() ? null : await extractClassDefinition(session, typeDefinition.nodeId, cache);

    let innerClass: Import | null = null;
    let childBase: Import | null = null;

    let shouldExposeInnerDefinition = false;
    // find member exposed by type definition
    const baseParentDef = parentDef.superType && await extractClassDefinition(session, parentDef.superType!.nodeId, cache);
    if (classDef && baseParentDef) {
        assert(!innerClass);

        // let's extract the member that are theorically defined in the member
        let membersReference = await extractAllMembers(session, classDef, cache);
        // find member exposed by this member
        let membersInstance: Classified = await classify(session, children);
  
        // if (name==="powerup") {
        //     dump1(membersReference);
        //     dump1(membersInstance);
        //     await extractAllMembers(session, classDef, cache);
        // }
 
        shouldExposeInnerDefinition = checkIfShouldExposeInnerDefinition(membersReference, membersInstance);

        const sameMemberInBaseClass = baseParentDef && await findClassMember(session, browseName, baseParentDef, cache);

        if (shouldExposeInnerDefinition) {
            if (sameMemberInBaseClass) {
                innerClass = {
                    module: parentDef.interfaceName.module,
                    name: parentDef.interfaceName.name + '_' + name,
                    namespace: nodeId.namespace
                }
                childBase = sameMemberInBaseClass.childType;
                childType = innerClass;
            } else {
                innerClass = {
                    module: parentDef.interfaceName.module,
                    name: parentDef.interfaceName.name + '_' + name,
                    namespace: nodeId.namespace
                }
                childBase = childType;
                childType = innerClass;
            }
            assert(innerClass);
            assert(childBase);
        } else {
            // may not expose definition  but we may want to used the augment typescript class defined in the definition
            // we don't need to create an inner class ... 
            childType = sameMemberInBaseClass ? sameMemberInBaseClass?.childType : childType;
            assert(!innerClass);
            assert(!childBase)
        }
    } else {
        // the lass member has no HasTypeDefinition reference 
        // may be is a method
        assert(!innerClass);
        assert(!childBase)
    }

    let classMember: ClassMember = {
        name,
        nodeClass,
        browseName,
        modellingRule,
        isOptional,
        classDef,
        description,
        typeDefinition,
        childType,
        suffix2: "",
        suffix: "",
        suffix3: "",
        children,
        children2: [],

        typeToReference: [],
        //
        innerClass,
        childBase
    };
    classMember.children2 = await _extractLocalMembers(session, classMember, cache);
    if (nodeClass === NodeClass.Variable) {

        const extra = await extractVariableExtra(session, nodeId, cache);
        classMember = {
            ...classMember,
            ...extra
        };
    }

    return classMember;
}


async function preDumpChildren(
    session: IBasicSession,
    padding: string,
    classDef: ClassDefinition,
    f: LineFile,
    cache: Cache
) {
    f = f || new LineFile();

    for (const memberDef of classDef.members) {
        const { innerClass, suffix2, suffix3, nodeClass, childBase } = memberDef;
        if (!innerClass || !childBase) {
            continue; // no need to expose inner class
        }
        cache.ensureImported(childBase);
        // if (innerClass.name === "UAAccessorySlotStateMachine_powerup") {
        //     debugger;
        // }
        f.write(`export interface ${innerClass.name}${suffix2} extends ${childBase.name}${suffix3} { // ${NodeClass[nodeClass]}`);
        await dumpChildren(session, padding + "  ", memberDef.children2, f, cache);
        f.write("}");
    }
}

async function dumpChildren(
    session: IBasicSession,
    padding:
        string,
    children: ClassMemberBasic[],
    f: LineFile,
    cache: Cache
) {

    f = f || new LineFile();

    for (const def of children) {
        const {
            name,
            childType,
            modellingRule,
            isOptional,
            description,
            suffix
        } = def;

        def.typeToReference.forEach(t => cache.ensureImported(t));

        if (modellingRule === "MandatoryPlaceholder" || modellingRule === "OptionalPlaceholder")
            continue;
        cache.ensureImported(childType);

        f.write(`${padding}/**`);
        f.write(`${padding} * ${name || ""}`);
        f.write(toComment(`${padding} * `, description.text || ""));
        f.write(`${padding} */`);
        f.write(`${padding}${quotifyIfNecessary(name)}${isOptional ? "?" : ""}: ${childType.name}${suffix};`);
    }
}

function dumpUsedExport(currentType: string, namespaceIndex: number, cache: Cache, f?: LineFile): string {
    f = f || new LineFile();

    for (let imp of Object.keys(cache.imports)) {
        const symbolToImport = Object.keys(cache.imports[imp]).filter(
            (f) => f !== currentType && cache.requestedBasicTypes.hasOwnProperty(f)
        );
        if (symbolToImport.length) {
            f.write(`import { ${symbolToImport.join(", ")} } from "${imp}"`);
        }
    }

    const getSubSymbolList = (s: RequestedSubSymbol) => {
        const subSymbolList: string[] = [];
        for (const [subSymbol, count] of Object.entries(s.subSymbols)) {
            subSymbolList.push(subSymbol);
        }
        return subSymbolList;
    }
    for (let ns = 0; ns < cache.requestedSymbols.namespace.length; ns++) {
        const n = cache.namespace[ns];
        const file = n.filename;
        if (ns === namespaceIndex) {
            // include individuals stuff
            for (const [symbol, s] of Object.entries(cache.requestedSymbols.namespace[ns].symbols).filter((a) => a[0] !== currentType)) {
                const subSymbolList = getSubSymbolList(s);
                f.write(`import { ${subSymbolList.join(", ")} } from "./${symbol}"`);
            }
        } else {
            if (cache.requestedSymbols.namespace[ns]) {
                for (const [symbol, s] of Object.entries(cache.requestedSymbols.namespace[ns].symbols)) {
                    const subSymbolList = getSubSymbolList(s);
                    f.write(`import { ${subSymbolList.join(", ")} } from "../${file}/${symbol}"`);
                }
            }
        }
    }
    return f.toString();
}

function toComment(prefix: string, description: string) {
    var d = wrapText(description);
    return d
        .split("\n")
        .map((x) => prefix + x)
        .join("\n");
}
export async function _exportDataTypeToTypescript(
    session: IBasicSession,
    nodeId: NodeId,
    cache: Cache,
    f?: LineFile
): Promise<{ content: string; typeName: string }> {
    f = f || new LineFile();

    const importCollector = (i: Import) => {
        cache.ensureImported(i);
    }
    const nodeClass = NodeClass.DataType;
    const description = await getDescription(session, nodeId);
    const definition = await getDefinition(session, nodeId);
    const browseName = await getBrowseName(session, nodeId);
    const isAbstract = await getIsAbstract(session, nodeId);

    const interfaceImport: Import = makeTypeNameNew(nodeClass, definition, browseName);
    const interfaceName = interfaceImport.name;

    const superType = await getSubtypeNodeId(session, nodeId);
    const baseInterfaceImport: Import = makeTypeNameNew(nodeClass, definition, superType.browseName);

    cache.ensureImported(baseInterfaceImport);

    const baseInterfaceName = baseInterfaceImport.name;
    //  f.write(superType.toString());
    f.write(`/**`);
    if (description.text) {
        f.write(toComment(" * ", description.text || ""));
        f.write(` *`);
    }
    f.write(` * defined in namespace ${cache.namespace[nodeId.namespace].namespaceUri}`);
    f.write(` *`);
    f.write(` * nodeClass:       ${NodeClass[nodeClass]}`);
    f.write(` *`);
    f.write(` * typedDefinition: ${browseName.toString()}`);
    f.write(` *`);
    f.write(` * isAbstract:      ${isAbstract}`);
    f.write(` */`);


    if (definition instanceof EnumDefinition) {
        f.write(`export enum ${interfaceName}  {`);
        for (const field of definition.fields!) {
            if (field.description.text) {
                f.write(`  /**`);
                f.write(toComment("   * ", field.description.text || ""));
                f.write(`   */`);
            }
            f.write(`  ${quotifyIfNecessary(field.name!)} = ${field.value[1]},`);
        }
        f.write(`}`);
    } else if (definition instanceof StructureDefinition) {


        f.write(`export interface ${interfaceName} extends ${baseInterfaceName}  {`);
        for (const field of definition.fields!) {
            let fieldName = toJavascritPropertyName(field.name!);
            // special case ! fieldName=

            f.write(`/** ${field.description.text}*/`);
            const { dataType, jtype } = await getCorrepondingJavascriptType(session, field.dataType, cache, importCollector);
            f.write(`  ${quotifyIfNecessary(fieldName)}: ${jtype}; // ${DataType[dataType]} ${field.dataType.toString()}`);
        }
        f.write(`}`);
    } else {
        f.write(`// NO DEFINITION`);
        f.write(`export interface ${interfaceName} extends ${baseInterfaceName}  {`);
        f.write(`}`);
        // throw new Error("Invalid " + definition?.constructor.name);
    }
    return { content: f.toString(), typeName: interfaceName };
}
/**
 *  nodeId : a DataType, ReferenceType,AObjectType, VariableType node
 */
export async function _convertTypeToTypescript(
    session: IBasicSession,
    nodeId: NodeId,
    cache: Cache,
    f?: LineFile
): Promise<{ content: string; typeName: string }> {

    f = f || new LineFile();

    const nodeClass = await getNodeClass(session, nodeId);
    if (nodeClass === NodeClass.DataType) {
        return await _exportDataTypeToTypescript(session, nodeId, cache, f);
    }

    const classDef = await extractClassDefinition(session, nodeId, cache);
    // if (classDef.browseName.toString().match(/PubSubDiagnosticsWriterGroupType/)) {
    //     debugger;
    // }
    const {
        interfaceName,
        baseInterfaceName,
        browseName,
        description,
        isAbstract,
        members
    } = classDef;

    await preDumpChildren(session, "    ", classDef, f, cache);

    //  f.write(superType.toString());
    f.write(`/**`);
    if (description.text) {
        f.write(toComment(" * ", description.text || ""));
        f.write(` *`);
    }
    f.write(` * defined in namespace ${cache.namespace[nodeId.namespace].namespaceUri}`);
    f.write(` *`);
    f.write(` * nodeClass:       ${NodeClass[nodeClass]}`);
    f.write(` *`);
    f.write(` * typedDefinition: ${browseName.toString()}`);
    f.write(` *`);
    f.write(` * isAbstract:      ${isAbstract}`);
    f.write(` */`);

    // if (interfaceName.name === "UAOperationLimits") {
    //     debugger;
    // }
    cache.ensureImported(baseInterfaceName!);

    if (nodeClass === NodeClass.VariableType) {
        cache.referenceBasicType("DataType");
        f.write(`export interface ${interfaceName.name}<T,DT extends DataType> extends ${baseInterfaceName?.name}<T,DT> {`);
    } else {
        f.write(`export interface ${interfaceName.name} extends ${baseInterfaceName?.name} {`);
    }
    await dumpChildren(session, "    ", members, f, cache);
    f.write(`}`);
    return { content: f.toString(), typeName: interfaceName.name };
}

export async function convertTypeToTypescript(
    session: IBasicSession,
    nodeId: NodeId,
    cache?: Cache,
    f?: LineFile
): Promise<{ content: string; folder: string; filename: string }> {
    f = new LineFile();

    cache = cache || (await constructCache(session));

    const { content, typeName } = await _convertTypeToTypescript(session, nodeId, cache);

    f.write(dumpUsedExport(typeName, nodeId.namespace, cache));
    f.write(content);

    const folder = cache.namespace[nodeId.namespace].filename;
    const filename = typeName;
    return { content: f.toString(), folder, filename };
}
