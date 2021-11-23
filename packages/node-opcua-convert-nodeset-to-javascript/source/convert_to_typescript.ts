import * as wrap from "wordwrap";
import { LocalizedText, NodeClass, QualifiedName } from "node-opcua-data-model";
import { NodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { EnumDefinition, ReferenceDescription, StructureDefinition, _enumerationDataChangeTrigger } from "node-opcua-types";
import { LineFile, lowerFirstLetter } from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import assert from "node-opcua-assert";
import { ModellingRuleType } from "node-opcua-address-space-base";
import * as chalk from "chalk";
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
    getChildrenOrFolderElements,
    getDataTypeNodeId,
    extractBasicDataType,
    getValueRank
} from "./private/utils";

import { Cache, constructCache, Import, makeTypeNameNew, referenceExtensionObject, RequestedSubSymbol } from "./private/cache";
import { Options } from "./options";
import { toFilename } from "./private/to_filename";

const doDebug = false;
const wrapText = wrap(0, 50);
const f2 = (str: string) => str.padEnd(50, "-");
const f1 = (str: string) => str.padEnd(50, " ");
const baseExtension = "_Base";

export async function convertDataTypeToTypescript(session: IBasicSession, dataTypeId: NodeId): Promise<void> {
    const definition = await getDefinition(session, dataTypeId);
    const browseName = await getBrowseName(session, dataTypeId);

    const dataTypeTypescriptName = `UA${browseName.name!.toString()}`;
    const f = new LineFile();
    if (definition && definition instanceof StructureDefinition) {
        f.write(`interface ${dataTypeTypescriptName} {`);
        for (const field of definition.fields || []) {
            /** */
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
    if (childName === "eventNotifier") {
        childName = "$eventNotifier";
    }
    return childName.replace(/</g, "$").replace(/>/g, "$").replace(/ |\./g, "_").replace(/#/g, "_");
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

async function getCorrepondingJavascriptType2(
    session: IBasicSession,
    nodeId: NodeId,
    dataTypeNodeId: NodeId,
    cache: Cache,
    importCollect?: (t: Import) => void
): Promise<{ dataType: DataType; jtype: string }> {
    const q = await getCorrepondingJavascriptType(session, dataTypeNodeId, cache, importCollect);
    const valueRank = await getValueRank(session, nodeId);
    return { dataType: q.dataType, jtype: q.jtype + (valueRank >= 1 ? "[]" : "") };
}

// eslint-disable-next-line complexity
async function getCorrepondingJavascriptType(
    session: IBasicSession,
    dataTypeNodeId: NodeId,
    cache: Cache,
    importCollect?: (t: Import) => void
): Promise<{ dataType: DataType; jtype: string }> {
    const dataType = await convertNodeIdToDataTypeAsync(session, dataTypeNodeId);

    const referenceBasicType = (name: string): string => {
        const t = { name, namespace: -1, module: "BasicType" };
        importCollect && importCollect(t);
        cache.ensureImported(t);
        return t.name;
    };
    if (dataType === DataType.ExtensionObject) {
        const jtypeImport = await referenceExtensionObject(session, dataTypeNodeId);
        const jtype = jtypeImport.name;
        importCollect && importCollect(jtypeImport);
        return { dataType, jtype: jtype };
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
        case DataType.Variant:
            return { dataType, jtype: referenceBasicType("Variant") };
        case DataType.XmlElement:
            return { dataType, jtype: referenceBasicType("UAString") };
        default:
            throw new Error("Unsupported " + dataType + " " + DataType[dataType]);
    }
}

interface ClassDefinition {
    nodeClass: NodeClass.VariableType | NodeClass.ObjectType;
    browseName: QualifiedName;
    isAbstract: boolean;
    description: LocalizedText;
    //
    superType?: ReferenceDescription;
    baseClassDef?: ClassDefinition | null;
    //
    children: ReferenceDescription[];
    members: ClassMember[];
    //
    interfaceName: Import;
    baseInterfaceName: Import | null;
    // for variables:!
    dataTypeNodeId: NodeId | null;
    dataType: DataType;
    dataTypeName: string;
    dataTypeImport?: Import[];
}

export function makeTypeName2(nodeClass: NodeClass, browseName: QualifiedName, suffix?: string): Import {
    assert(browseName);
    if (nodeClass === NodeClass.Method) {
        return { name: "UAMethod", namespace: 0, module: "UAMethod" };
    }
    return makeTypeNameNew(nodeClass, null, browseName, suffix);
}

export async function extractClassDefinition(session: IBasicSession, nodeId: NodeId, cache: Cache): Promise<ClassDefinition> {
    const extraImports: Import[] = [];
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
    const superType = (await getSubtypeNodeIdIfAny(session, nodeId)) || undefined;

    const dataTypeNodeId = await getDataTypeNodeId(session, nodeId);
    let dataTypeName = "";
    let dataType: DataType = DataType.Null;
    let dataTypeImport: Import[] | undefined = undefined;
    if (nodeClass === NodeClass.VariableType) {
        dataType = await extractBasicDataType(session, dataTypeNodeId!);
        const importCollector = (i: Import) => {
            extraImports.push(i);
            cache.ensureImported(i);
        };
        const { jtype } = await getCorrepondingJavascriptType2(session, nodeId, dataTypeNodeId!, cache, importCollector);
        dataTypeName = jtype; // with decoration
        if (!dataTypeNodeId?.isEmpty()) {
            // "DT" + (await getBrowseName(session, dataTypeNodeId!))?.name! || "";
            // const bn = await getBrowseName(session, dataTypeNodeId!);
            dataTypeImport = extraImports; // makeTypeName2(NodeClass.DataType, bn);
        }
    }

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

        dataType,
        dataTypeNodeId,
        dataTypeName,
        dataTypeImport,

        superType,

        baseClassDef,

        description,
        // definition,
        children,
        members,

        interfaceName,
        baseInterfaceName
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
    suffixInstantiate?: string;
    chevrons: any;
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
    dataTypeNodeId?: NodeId | null;
    dataType?: DataType;
    jtype?: string;
    suffix?: string;
    suffix2?: string;
    suffix3?: string;
    innerClass?: Import | null;
    childBase?: Import | null;
}

interface Classified {
    Mandatory: ReferenceDescription[];
    Optional: ReferenceDescription[];
    MandatoryPlaceholder: ReferenceDescription[];
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
    const m = [...classDef.children];
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
    const baseBaseParentDef =
        baseParentDef.superType && (await extractClassDefinition(session, baseParentDef.superType!.nodeId, cache));
    if (!baseBaseParentDef) {
        return null;
    }
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
    const hasNewStuff = hasNewMaterial(main.Mandatory, instance.Mandatory) || hasNewMaterial(main.Optional, instance.Optional);
    return hasNewStuff;
}

function dump1(a: Classified) {
    console.log(
        "Mandatory = ",
        a.Mandatory.map((x) => x.browseName.toString())
            .sort()
            .join(" ")
    );
    console.log(
        "Optional  = ",
        a.Optional.map((x) => x.browseName.toString())
            .sort()
            .join(" ")
    );
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

        const childInBase: ClassMember | undefined = classMember.classDef?.members.find(
            (a) => a.browseName.toString() === browseName.toString()
        );

        let childType: Import;
        if (childInBase) {
            childType = childInBase.childType;
        } else {
            const d = typeDefinition.nodeId.isEmpty() ? null : await extractClassDefinition(session, typeDefinition.nodeId, cache);
            childType = d?.interfaceName || { name: "UAMethod", module: "BasicType", namespace: -1 };
        }

        // may be childType is already
        const { suffix, suffixInstantiate, typeToReference, chevrons } = await extractVariableExtra(
            session,
            child.nodeId,
            cache,
            classMember
        );

        const c: ClassMemberBasic = {
            childType,
            description,
            isOptional,
            modellingRule,
            name,
            suffix,
            suffixInstantiate,
            typeToReference,
            chevrons
        };
        children2.push(c);
    }
    return children2;
}
function isUnspecifiedDataType(dataType?: DataType): boolean {
    return dataType === DataType.Null || dataType === DataType.Variant;
}
async function extractVariableExtra(session: IBasicSession, nodeId: NodeId, cache: Cache, classMember: ClassMember) {
    const typeToReference: Import[] = [];
    const importCollector = (i: Import) => {
        typeToReference.push(i);
        cache.ensureImported(i);
    };
    const nodeClass = await getNodeClass(session, nodeId);
    if (nodeClass === NodeClass.Variable) {
        const dataTypeNodeId = await getDataTypeNodeId(session, nodeId);

        const { dataType, jtype } = await getCorrepondingJavascriptType2(session, nodeId, dataTypeNodeId!, cache, importCollector);

        cache && cache.referenceBasicType("DataType");
        importCollector({ name: "DataType", namespace: -1, module: "BasicType" });

        const t = isUnspecifiedDataType(classMember.classDef?.dataType);
        const suffix =
            jtype === "undefined" || isUnspecifiedDataType(dataType)
                ? `<any, any>`
                : `<${jtype}${t ? `, /*c*/DataType.${DataType[dataType]}` : ""}>`;

        // const suffix2 = `<T${t ? `, /*a*/DT extends DataType` : ""}>`;
        const suffix3 = `<T${t ? `, /*b*/DT` : ""}>`;

        const typeDef = await getTypeDefOrBaseType(session, nodeId);
        const typeDefCD = await extractClassDefinition(session, typeDef.nodeId!, cache);
        const chevrons = calculateChevrons(typeDefCD, { dataType });
        const suffix2 = chevrons.chevronsDef;

        /** Suffix for instantiation
         *  if typeDef.dataType is not null, then we need to add a type argument
         */
        let suffixInstantiate = "";
        if (isUnspecifiedDataType(dataType)) {
            if (!isUnspecifiedDataType(typeDefCD.dataType)) {
                suffixInstantiate = "<any>";
            } else {
                suffixInstantiate = "<any, any>";
            }
        } else {
            if (!isUnspecifiedDataType(typeDefCD.dataType)) {
                suffixInstantiate = `<${jtype}>`;
            } else {
                suffixInstantiate = `<${jtype}, /*z*/DataType.${DataType[dataType]}>`;
            }
        }

        return { suffixInstantiate, suffix, suffix2, suffix3, dataTypeNodeId, dataType, jtype, typeToReference, chevrons };
    }
    return { suffix: "", typeToReference };
}

interface ClassDefinitionB {
    superType?: {
        nodeId: NodeId;
    };
    interfaceName: Import;
}
// eslint-disable-next-line max-statements
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

    if (!typeDefinition.browseName) {
        console.log("cannot find typeDefinition for ", browseName.toString(), "( is the namespace loaded ?)");
    }
    let childType = makeTypeName2(nodeClass, typeDefinition.browseName);

    const classDef = typeDefinition.nodeId.isEmpty() ? null : await extractClassDefinition(session, typeDefinition.nodeId, cache);

    let innerClass: Import | null = null;
    let childBase: Import | null = null;

    let shouldExposeInnerDefinition = false;
    // find member exposed by type definition
    const baseParentDef = parentDef.superType && (await extractClassDefinition(session, parentDef.superType!.nodeId, cache));
    if (classDef && baseParentDef) {
        const chevrons1 = calculateChevrons(classDef, baseParentDef);
        assert(!innerClass);

        // let's extract the member that are theorically defined in the member
        const membersReference = await extractAllMembers(session, classDef, cache);
        // find member exposed by this member
        const membersInstance: Classified = await classify(session, children);

        // if (name==="powerup") {
        //     dump1(membersReference);
        //     dump1(membersInstance);
        //     await extractAllMembers(session, classDef, cache);
        // }

        shouldExposeInnerDefinition = checkIfShouldExposeInnerDefinition(membersReference, membersInstance);

        const sameMemberInBaseClass = baseParentDef && (await findClassMember(session, browseName, baseParentDef, cache));

        if (shouldExposeInnerDefinition) {
            if (sameMemberInBaseClass) {
                innerClass = {
                    module: parentDef.interfaceName.module,
                    name: parentDef.interfaceName.name + "_" + name,
                    namespace: nodeId.namespace
                };
                childBase = sameMemberInBaseClass.childType;
                childType = innerClass;
            } else {
                innerClass = {
                    module: parentDef.interfaceName.module,
                    name: parentDef.interfaceName.name + "_" + name,
                    namespace: nodeId.namespace
                };
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
            assert(!childBase);
        }
    } else {
        // the lass member has no HasTypeDefinition reference
        // may be is a method
        assert(!innerClass);
        assert(!childBase);
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
        suffixInstantiate: "",
        children,
        children2: [],

        typeToReference: [],
        //
        innerClass,
        childBase,
        chevrons: null
    };
    classMember.children2 = await _extractLocalMembers(session, classMember, cache);
    if (nodeClass === NodeClass.Variable) {
        const extra = await extractVariableExtra(session, nodeId, cache, classMember);
        classMember = {
            ...classMember,
            ...extra
        };
    }

    return classMember;
}

async function preDumpChildren(session: IBasicSession, padding: string, classDef: ClassDefinition, f: LineFile, cache: Cache) {
    f = f || new LineFile();

    for (const memberDef of classDef.members) {
        const { innerClass, suffix2, suffix3, nodeClass, childBase, chevrons } = memberDef;
        if (!innerClass || !childBase) {
            continue; // no need to expose inner class
        }
        cache.ensureImported(childBase);
        if (innerClass.name === "UAPubSubDiagnostics_counters" || innerClass.name === "UAProgramStateMachine_currentState") {
            //      debugger;
        }
        const baseStuff = getBaseClassWithOmit2(memberDef);

        //f.write(`export interface ${innerClass.name}${suffix2} extends ${childBase.name}${suffix3} { // ${NodeClass[nodeClass]}`);
        f.write(`export interface ${innerClass.name}${suffix2} extends ${baseStuff} { // ${NodeClass[nodeClass]}`);
        await dumpChildren(session, padding + "  ", memberDef.children2, f, cache);
        f.write("}");
    }
}

function dumpChildren(session: IBasicSession, padding: string, children: ClassMemberBasic[], f: LineFile, cache: Cache): void {
    f = f || new LineFile();

    for (const def of children) {
        const { suffixInstantiate, name, childType, modellingRule, isOptional, description } = def;
        def.typeToReference.forEach((t) => cache.ensureImported(t));

        if (modellingRule === "MandatoryPlaceholder" || modellingRule === "OptionalPlaceholder") continue;
        cache.ensureImported(childType);
        const adjustedName = toJavascritPropertyName(name);
        if (description.text) {
            f.write(`${padding}/**`);
            f.write(`${padding} * ${name || ""}`);
            f.write(toComment(`${padding} * `, description.text || ""));
            f.write(`${padding} */`);
        }
        f.write(
            `${padding}${quotifyIfNecessary(adjustedName)}${isOptional ? "?" : ""}: ${childType.name}${suffixInstantiate || ""};`
        );
    }
}
// now from other namespace
const getSubSymbolList = (s: RequestedSubSymbol) => {
    const subSymbolList: string[] = [];
    for (const [subSymbol, count] of Object.entries(s.subSymbols)) {
        subSymbolList.push(subSymbol);
    }
    return subSymbolList;
};
export function findUsedImport(namespaceIndex: number, cache: Cache): string[] {
    const usedImport: string[] = [];
    // from standard types
    for (const imp of Object.keys(cache.imports)) {
        const symbolToImport = Object.keys(cache.imports[imp]).filter((f) =>
            Object.prototype.hasOwnProperty.call(cache.requestedBasicTypes, f)
        );
        if (symbolToImport.length == 0) {
            continue;
        }
        usedImport.push(imp);
    }

    // from namespace
    for (let ns = 0; ns < cache.requestedSymbols.namespace.length; ns++) {
        if (ns === namespaceIndex) {
            continue; // avoid self reference
        }
        const module = cache.namespace[ns].module;
        if (cache.requestedSymbols.namespace[ns] && Object.values(cache.requestedSymbols.namespace[ns]).length > 0) {
            usedImport.push(module);
        }
    }

    return usedImport;
}

function dumpUsedExport(currentType: string, namespaceIndex: number, cache: Cache, f?: LineFile): string {
    f = f || new LineFile();

    for (const imp of Object.keys(cache.imports)) {
        const symbolToImport = Object.keys(cache.imports[imp]).filter(
            (f) => f !== currentType && Object.prototype.hasOwnProperty.call(cache.requestedBasicTypes, f)
        );
        if (symbolToImport.length == 0) {
            continue;
        }
        f.write(`import { ${symbolToImport.join(", ")} } from "${imp}"`);
    }
    for (let ns = 0; ns < cache.requestedSymbols.namespace.length; ns++) {
        const n = cache.namespace[ns];
        const sourceFolder = n.sourceFolder;
        const module = n.module;
        if (ns === namespaceIndex) {
            // include individuals stuff
            for (const [symbol, s] of Object.entries(cache.requestedSymbols.namespace[ns].symbols).filter(
                (a) => a[0] !== currentType
            )) {
                const filename = toFilename(symbol);
                const subSymbolList = getSubSymbolList(s);
                f.write(`import { ${subSymbolList.join(", ")} } from "./${filename}"`);
            }
        } else {
            if (cache.requestedSymbols.namespace[ns]) {
                for (const [symbol, s] of Object.entries(cache.requestedSymbols.namespace[ns].symbols)) {
                    const subSymbolList = getSubSymbolList(s);
                    const filename = toFilename(symbol);
                    f.write(`import { ${subSymbolList.join(", ")} } from "${module}/source/${filename}"`);
                }
            }
        }
    }
    return f.toString();
}

function toComment(prefix: string, description: string) {
    const d = wrapText(description);
    return d
        .split("\n")
        .map((x) => prefix + x)
        .join("\n");
}
export type Type = "enum" | "basic" | "structure" | "ua";
// eslint-disable-next-line max-statements
export async function _exportDataTypeToTypescript(
    session: IBasicSession,
    nodeId: NodeId,
    cache: Cache,
    f?: LineFile
): Promise<{ type: Type; content: string; typeName: string }> {
    f = f || new LineFile();

    const importCollector = (i: Import) => {
        cache.ensureImported(i);
    };
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
    f.write(` * |           |${f1(" ")}|`);
    f.write(` * |-----------|${f2("-")}|`);
    f.write(` * | namespace |${f1(cache.namespace[nodeId.namespace].namespaceUri)}|`);
    f.write(` * | nodeClass |${f1(NodeClass[nodeClass])}|`);
    f.write(` * | name      |${f1(browseName.toString())}|`);
    f.write(` * | isAbstract|${f1(isAbstract.toString())}|`);
    f.write(` */`);

    let type: "basic" | "structure" | "enum" | "ua" = "basic";
    if (definition instanceof EnumDefinition) {
        type = "enum";
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
        type = "structure";
        if (interfaceName === "DTStructure") {
            f.write(`export interface ${interfaceName} {`);
        } else {
            f.write(`export interface ${interfaceName} extends ${baseInterfaceName}  {`);
        }
        for (const field of definition.fields!) {
            const fieldName = toJavascritPropertyName(field.name!);
            // special case ! fieldName=
            if (field.description.text) {
                f.write(`/** ${field.description.text}*/`);
            }
            let ar = "";
            if (field.valueRank >= 1) {
                ar = "[]";
            }
            const { dataType, jtype } = await getCorrepondingJavascriptType(session, field.dataType, cache, importCollector);
            f.write(`  ${quotifyIfNecessary(fieldName)}: ${jtype}${ar}; // ${DataType[dataType]} ${field.dataType.toString()}`);
        }
        f.write(`}`);
    } else {
        type = "basic";
        f.write(`// NO DEFINITION`);
        f.write(`export interface ${interfaceName} extends ${baseInterfaceName}  {`);
        f.write(`}`);
        // throw new Error("Invalid " + definition?.constructor.name);
    }
    return { type, content: f.toString(), typeName: interfaceName };
}

function calculateChevrons(classDef: ClassDefinition, classDefDerived?: { dataType: DataType }) {
    const { nodeClass, dataType, dataTypeName } = classDef;
    let chevronsDef = "";
    let chevronsUse = "";
    let chevronsExtend = "";
    if (nodeClass !== NodeClass.VariableType) {
        return { chevronsDef, chevronsUse, chevronsExtend };
    }

    if (!isUnspecifiedDataType(dataType)) {
        chevronsDef = `<T extends ${dataTypeName}/*j*/>`;
        chevronsUse = "<T/*k*/>";
        if (classDefDerived) {
            if (isUnspecifiedDataType(classDefDerived.dataType)) {
                chevronsExtend = `<T, /*i*/DataType.${DataType[dataType]}>`;
            } else {
                chevronsExtend = `<T/*h*/>`;
            }
        }
    } else {
        // classDef.dataType === DataType.Null
        chevronsDef = `<T, DT extends DataType>`;
        if (classDefDerived) {
            if (isUnspecifiedDataType(classDefDerived.dataType)) {
                chevronsUse = "<T, /*m*/DT>";
                chevronsExtend = `<T/*g*/, DT>`;
            } else {
                chevronsUse = `<T, /*n*/DataType.${DataType[classDefDerived.dataType]}>`;
                chevronsExtend = `<T, /*e*/DataType.${DataType[classDefDerived.dataType]}>`;
            }
        }
    }

    return { chevronsDef, chevronsUse, chevronsExtend };
}
// find the structure member that are already in base structure definition and that are replicated here
// we will have to use the Omit<Base,"member1" |"member2"> typescript pattern to avoid issues
function extractMembersRecursively(classDef?: ClassDefinition | null): string[] {
    if (!classDef) {
        return [];
    }
    const m = classDef.members.map((m) => m.name);
    if (classDef.baseClassDef) {
        const m2 = extractMembersRecursively(classDef.baseClassDef);
        return m.concat(m2);
    }
    return m;
}
function getBaseClassWithOmit(classDef: ClassDefinition) {
    const { baseInterfaceName, members } = classDef;

    const allMembers = extractMembersRecursively(classDef.baseClassDef);
    const conflictingMembers = members.filter((m) => allMembers.indexOf(m.name) !== -1);
    //console.log(allMembers.join(" "));
    if (conflictingMembers.length) {
        //  console.log("conflictingMembers = ", conflictingMembers.map((a) => a.name).join(" "));
    }
    const chBase = calculateChevrons(classDef.baseClassDef!, classDef);

    let baseStuff = `${baseInterfaceName?.name}${chBase.chevronsUse}`;
    if (conflictingMembers.length) {
        baseStuff = `Omit<${baseStuff}, ${conflictingMembers.map((a) => `"${a.name}"`).join("|")}>`;
    }
    return baseStuff;
}
function getBaseClassWithOmit2(classMember: ClassMember) {
    const members = classMember.children2;
    const allMembers = extractMembersRecursively(classMember.classDef);
    const conflictingMembers = members.filter((m) => allMembers.indexOf(m.name) !== -1);
    //console.log(allMembers.join(" "));
    if (conflictingMembers.length) {
        doDebug && console.log("conflictingMembers = ", conflictingMembers.map((a) => a.name).join(" "));
    }
    const childBase = classMember.childBase;

    let baseStuff = `${childBase?.name}${classMember.suffix3}`;
    if (conflictingMembers.length) {
        baseStuff = `Omit<${baseStuff}, ${conflictingMembers.map((a) => `"${a.name}"`).join("|")}>`;
    }
    return baseStuff;
}
/**
 *  nodeId : a DataType, ReferenceType,AObjectType, VariableType node
 */
// eslint-disable-next-line max-statements
export async function _convertTypeToTypescript(
    session: IBasicSession,
    nodeId: NodeId,
    cache: Cache,
    f?: LineFile
): Promise<{ type: Type; content: string; typeName: string }> {
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
        dataTypeName,
        dataType,
        dataTypeNodeId,
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
    f.write(` * |                |${f1(" ")}|`);
    f.write(` * |----------------|${f2("-")}|`);
    f.write(` * |namespace       |${f1(cache.namespace[nodeId.namespace].namespaceUri)}|`);
    f.write(` * |nodeClass       |${f1(NodeClass[nodeClass])}|`);
    f.write(` * |typedDefinition |${f1(browseName.toString() + " " + nodeId.toString())}|`);
    if (nodeClass === NodeClass.VariableType) {
        f.write(` * |dataType        |${f1(DataType[dataType])}|`);
        f.write(` * |dataType Name   |${f1(dataTypeName + " " + dataTypeNodeId?.toString())}|`);
    }
    f.write(` * |isAbstract      |${f1(isAbstract.toString())}|`);
    f.write(` */`);

    // if (interfaceName.name === "UAOperationLimits") {
    //     debugger;
    // }
    cache.ensureImported(baseInterfaceName!);
    cache.ensureImported({ ...baseInterfaceName!, name: baseInterfaceName!.name + `${baseExtension}` });

    const ch = calculateChevrons(classDef);

    if (nodeClass === NodeClass.VariableType) {
        if (classDef.dataTypeImport) {
            console.log(chalk.red(" ----------------> ", classDef.browseName));
            classDef.dataTypeImport.forEach((a) => {
                console.log(chalk.red(" ------------------------> ", a.module, a.name, a.namespace));
            });
            classDef.dataTypeImport.forEach(cache.ensureImported.bind(cache));
        }

        cache.referenceBasicType("DataType");
        const chevrons = calculateChevrons(classDef);
        const chevronsBase = calculateChevrons(classDef.baseClassDef!, classDef);
        //  Shall we  cache.ensureImported({ ...baseInterfaceName!, module: dataTypeName, name: dataTypeName });
        const classBaseName = `${interfaceName.name}${baseExtension}${chevrons.chevronsDef}`;

        if (baseInterfaceName?.name === "UAVariableT") {
            f.write(`export interface ${classBaseName}  {`);
        } else {
            const baseName = `${baseInterfaceName?.name}${baseExtension}${chevronsBase.chevronsExtend}`;
            f.write(`export interface ${classBaseName}  extends ${baseName} {`);
        }
    } else {
        const classBaseName = `${interfaceName.name}${baseExtension}`;
        if (baseInterfaceName?.name === "UAObject") {
            f.write(`export interface ${classBaseName} {`);
        } else {
            const baseName = `${baseInterfaceName?.name}${baseExtension}`;
            f.write(`export interface ${classBaseName} extends ${baseName} {`);
        }
    }
    await dumpChildren(session, "    ", members, f, cache);
    f.write(`}`);

    const baseStuff = getBaseClassWithOmit(classDef);

    if (nodeClass === NodeClass.VariableType) {
        cache.referenceBasicType("DataType");
        // if dataType is a extension object we can simpligy by forcing DT
        const className = `${interfaceName.name}${ch.chevronsDef}`;
        const c = isUnspecifiedDataType(dataType) ? "<T, DT /*A*/>" : "<T /*B*/>";
        const classBaseName = `${interfaceName.name}${baseExtension}${c}`;
        f.write(`export interface ${className} extends ${baseStuff}, ${classBaseName} {`);
    } else {
        const className = `${interfaceName.name}`;
        const classBaseName = `${interfaceName.name}${baseExtension}`;
        f.write(`export interface ${className} extends ${baseStuff}, ${classBaseName} {`);
    }
    f.write(`}`);
    return { type: "ua", content: f.toString(), typeName: interfaceName.name };
}

export async function convertTypeToTypescript(
    session: IBasicSession,
    nodeId: NodeId,
    options: Options,
    cache?: Cache,
    f?: LineFile
): Promise<{
    type: Type;
    content: string;
    module: string;
    folder: string;
    filename: string;
    dependencies: string[];
}> {
    f = new LineFile();

    cache = cache || (await constructCache(session, options));

    const { type, content, typeName } = await _convertTypeToTypescript(session, nodeId, cache);

    f.write(`// ----- this file has been automatically generated - do not edit`);
    f.write(dumpUsedExport(typeName, nodeId.namespace, cache));
    f.write(content);

    const folder = cache.namespace[nodeId.namespace].sourceFolder;
    const module = cache.namespace[nodeId.namespace].module;
    const filename = toFilename(typeName);

    const dependencies = findUsedImport(nodeId.namespace, cache);

    return { type, content: f.toString(), folder, module, filename, dependencies };
}
