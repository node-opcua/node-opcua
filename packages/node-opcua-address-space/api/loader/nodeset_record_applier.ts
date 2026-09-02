/**
 * @module node-opcua-address-space
 *
 * The consumer that turns {@link NodesetRecord}s into nodes of an address space: it registers
 * the namespaces the header declares, translates every id from the file's namespace table to
 * the address space's, applies the loader options, creates the node and queues the post-load
 * tasks (values, extension objects, data-type registration) that run once every document is in.
 */
import type {
    AddReferenceTypeOptions,
    BaseNode,
    CreateNodeOptions,
    IAddressSpace,
    UADataType,
    UAVariable,
    UAVariableType
} from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { StatusCodes } from "node-opcua-basic-types";
import {
    type AccessLevelFlag,
    type AccessRestrictionsFlag,
    coerceLocalizedText,
    makeAccessLevelFlag,
    makeAccessRestrictionsFlag,
    NodeClass,
    QualifiedName
} from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import type { ExtensionObject } from "node-opcua-extension-object";
import { getBuiltInType } from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { Argument, type RolePermissionTypeOptions } from "node-opcua-types";
import { DataType, VariantArrayType, type VariantOptions } from "node-opcua-variant";
import semver from "semver";
import type { AddressSpacePrivate } from "../../impl/address_space_private.js";
import type { NamespacePrivate } from "../../impl/namespace_private.js";
import type { UAVariableImpl } from "../../impl/ua_variable_impl.js";
import type { NodeSetLoaderOptions } from "../interfaces/nodeset_loader_options.js";
import { makeSemverCompatible } from "./make_semver_compatible.js";
import {
    type NodesetHeaderRecord,
    type NodesetModelRecord,
    type NodesetNodeRecord,
    type NodesetRecord,
    type NodesetRecordConsumer,
    XmlExtensionObjectFragment
} from "./nodeset_record.js";
import { createXMLExtensionObjectDecodingTask } from "./parsers/extension_object_parser.js";

const doDebug = checkDebugFlag("load_nodeset2");
const debugLog = make_debugLog("load_nodeset2");
const errorLog = make_errorLog("load_nodeset2");

export type Task = (addressSpace: IAddressSpace) => Promise<void>;

/** the work deferred until every document is loaded, in the order it runs */
export interface LoaderTaskQueues {
    postTasks: Task[];
    postTasks0_InitializeVariable: Task[];
    postTasks0_DecodePojoString: Task[];
    postTasks1_InitializeVariable: Task[];
    postTasks2_AssignedExtensionObjectToDataValue: Task[];
    pendingSimpleTypeToRegister: { name: string; dataTypeNodeId: NodeId }[];
}
export function makeLoaderTaskQueues(): LoaderTaskQueues {
    return {
        postTasks: [],
        postTasks0_InitializeVariable: [],
        postTasks0_DecodePojoString: [],
        postTasks1_InitializeVariable: [],
        postTasks2_AssignedExtensionObjectToDataValue: [],
        pendingSimpleTypeToRegister: []
    };
}

function convertAccessLevel(accessLevel?: string | null): AccessLevelFlag {
    const accessLevelN: number = parseInt(accessLevel || "1", 10); // CurrentRead if not specified
    return makeAccessLevelFlag(accessLevelN);
}

/**
 * the XSD gives UserAccessLevel a default of 1, but a nodeset that raises AccessLevel and stays
 * silent on UserAccessLevel means "the user may do whatever the node allows", not "read only".
 * Falling back on accessLevel is what every other stack does and what node-opcua has always done;
 * what changes here is that an *explicit* UserAccessLevel is no longer dropped.
 */
function convertUserAccessLevel(userAccessLevel: string | null | undefined, accessLevel: AccessLevelFlag): AccessLevelFlag {
    if (userAccessLevel === undefined || userAccessLevel === null || userAccessLevel === "") {
        return accessLevel;
    }
    return convertAccessLevel(userAccessLevel);
}

function convertAccessRestrictions(accessRestrictions?: string | null): AccessRestrictionsFlag | undefined {
    if (accessRestrictions === undefined || accessRestrictions === null || accessRestrictions === "") {
        // undefined is not None: it means "inherit the namespace default"
        return undefined;
    }
    const value = parseInt(accessRestrictions, 10);
    if (Number.isNaN(value)) {
        errorLog("load_nodeset2: ignoring invalid AccessRestrictions attribute", accessRestrictions);
        return undefined;
    }
    return makeAccessRestrictionsFlag(value);
}

function makeDefaultVariant(
    addressSpace: IAddressSpace,
    dataTypeNode: NodeId,
    valueRank: number,
    arrayDimensions?: number[] | null
): VariantOptions | undefined {
    let variant: VariantOptions = { dataType: DataType.Null };

    const nodeDataType = addressSpace.findNode(dataTypeNode) as UADataType;
    if (nodeDataType?.basicDataType) {
        const basicDataType = nodeDataType.basicDataType;
        if (basicDataType === DataType.Variant) {
            /// we don't now what is the variant
            return undefined;
        }

        if (basicDataType === DataType.ExtensionObject) {
            return { dataType: DataType.ExtensionObject, value: null };
        }
        const builtInType = getBuiltInType(DataType[basicDataType]);
        if (builtInType === undefined || builtInType === null) {
            errorLog("Cannot find builtInType for ", basicDataType);
            return { dataType: DataType.Null };
        }
        const dv = builtInType.defaultValue;
        const value = typeof dv === "function" ? dv() : dv;

        let arrayType: VariantArrayType;
        /*
         *  * n > 1                     : the Value is an array with the specified number of dimensions.
         *  * OneDimension (1):           The value is an array with one dimension.
         *  * OneOrMoreDimensions (0):    The value is an array with one or more dimensions.
         *  * Scalar (-1):                The value is not an array.
         *  * Any (-2):                   The value can be a scalar or an array with any number of dimensions.
         *  * ScalarOrOneDimension (-3):  The value can be a scalar or a one dimensional array.
         */
        switch (valueRank) {
            case -3: //  ScalarOrOneDimension (-3):
            case -2: // any
            case -1:
                arrayType = VariantArrayType.Scalar;
                variant = { dataType: basicDataType, value, arrayType };
                break;
            case 0: // one or more dimension
            case 1: // one dimension
                arrayType = VariantArrayType.Array;
                variant = { dataType: basicDataType, value: [], arrayType };
                break;
            default:
                arrayType = VariantArrayType.Matrix;
                variant = { dataType: basicDataType, value: [], arrayType, dimensions: arrayDimensions };
                break;
        }
    }
    return variant;
}

/**
 * a Matrix variant is "uninitialized" when it carries no element (value=[]) but declares
 * non-zero dimensions (e.g. ArrayDimensions="256,128"). Such a variant is internally inconsistent
 * (value.length !== product(dimensions)) and, if serialized, produces a spec-violating wire form.
 */
function isUninitializedMatrix(value: VariantOptions): boolean {
    if (value.arrayType !== VariantArrayType.Matrix) {
        return false;
    }
    const length = Array.isArray(value.value) ? value.value.length : 0;
    if (length !== 0) {
        return false;
    }
    const dimensions = value.dimensions;
    if (!dimensions || dimensions.length === 0) {
        return false;
    }
    const product = dimensions.reduce((n, p) => n * p, 1);
    return product > 0;
}

const UA_NAMESPACE_URI = "http://opcfoundation.org/UA/";
const reg = /ns=([0-9]+);(.*)/;

interface INodePermissions {
    accessRestrictions?: AccessRestrictionsFlag;
    rolePermissions?: RolePermissionTypeOptions[];
}

export class NodesetRecordApplier implements NodesetRecordConsumer {
    private readonly addressSpace: AddressSpacePrivate;
    private readonly applyRolePermissions: boolean;
    private readonly applyAccessRestrictions: boolean;

    // per document: the file's namespace table to the address space's, and what was translated
    private table: number[] = [];
    private aliasMap = new Map<string, NodeId>();
    private translatedStrings = new Map<string, NodeId>();
    private translatedIds = new Map<number | string, NodeId>();
    private headerSeen = false;

    constructor(
        addressSpace: IAddressSpace,
        private readonly options: NodeSetLoaderOptions,
        private readonly queues: LoaderTaskQueues
    ) {
        this.addressSpace = addressSpace as AddressSpacePrivate;
        // two independent switches: who may do what is a property of the model and applies by
        // default, whereas how the channel must be secured is a property of the deployment and
        // is opt-in. See NodeSetLoaderOptions.
        this.applyRolePermissions = (options.permissions ?? "apply") === "apply";
        this.applyAccessRestrictions = (options.accessRestrictions ?? "ignore") === "apply";
    }

    public apply(record: NodesetRecord): void {
        if (record.kind === "header") {
            this.applyHeader(record);
            return;
        }
        if (!this.headerSeen) {
            throw new Error("NodesetRecordApplier: a node record came before the header record");
        }
        this.applyNode(record);
    }

    // #region header: namespaces, translation table, aliases
    private applyHeader(header: NodesetHeaderRecord): void {
        this.table = [];
        this.aliasMap.clear();
        this.translatedStrings.clear();
        this.translatedIds.clear();
        this.headerSeen = true;

        for (const model of header.models) {
            this.addNamespace(model);
        }
        if (header.models.length === 0) {
            // special case for old nodeset file version 1.02 where no models exists
            for (const namespaceUri of header.namespaceUris) {
                if (this.addressSpace.getNamespace(namespaceUri)) {
                    continue;
                }
                this.addNamespace({ modelUri: namespaceUri, version: "1.0.0", requiredModels: [] });
            }
        }
        // the file's table: the UA namespace, then the declared URIs in order. A URI that repeats
        // (the UA namespace listed again) takes no slot, as it never did.
        const found = new Set<string>();
        for (const namespaceUri of [UA_NAMESPACE_URI, ...header.namespaceUris]) {
            if (found.has(namespaceUri)) {
                continue;
            }
            found.add(namespaceUri);
            const namespace = this.addressSpace.getNamespace(namespaceUri);
            // c8 ignore next
            if (!namespace) {
                throw new Error(
                    `cannot find namespace for ${namespaceUri}\nplease make sure to initialize your address space with the corresponding nodeset files`
                );
            }
            doDebug &&
                debugLog(
                    " _register_namespace_uri = ",
                    namespaceUri,
                    "index in Xml=",
                    this.table.length,
                    " index in addressSpace",
                    namespace.index
                );
            this.table.push(namespace.index);
        }
        for (const [aliasName, fileLocal] of Object.entries(header.aliases)) {
            const nodeId = this.translate(fileLocal);
            this.aliasMap.set(aliasName, nodeId);
            this.addressSpace.getNamespace(nodeId.namespace).addAlias(aliasName, nodeId);
        }
    }

    private addNamespace(model: NodesetModelRecord): NamespacePrivate {
        const addressSpace = this.addressSpace;
        if (model.requiredModels.length > 0) {
            // check that required models exist already in the address space
            for (const requiredModel of model.requiredModels) {
                const existingNamespace = addressSpace.getNamespace(requiredModel.modelUri);

                // c8 ignore next
                if (!existingNamespace) {
                    errorLog(
                        "Please ensure that the required namespace",
                        requiredModel.modelUri,
                        "is loaded first when loading",
                        model.modelUri
                    );
                    throw new Error(`LoadNodeSet : Cannot find namespace for ${requiredModel.modelUri}`);
                }
                /**
                 *  from https://reference.opcfoundation.org/Core/docs/Part6/F.2/
                 *  The version of the model defined in the UANodeSet.
                 *  This is a human-readable string and not intended for programmatic comparisons.
                 */
                const isLowerVersion = (existingVersion: string, requiredVersion: string): boolean => {
                    const existingSemver = makeSemverCompatible(existingVersion);
                    const requiredSemver = makeSemverCompatible(requiredVersion);
                    return semver.lt(existingSemver, requiredSemver);
                };

                if (isLowerVersion(existingNamespace.version, requiredModel.version)) {
                    errorLog(
                        "Expecting ",
                        requiredModel.modelUri,
                        " with version to be at least",
                        requiredModel.version,
                        " but namespace version is ",
                        existingNamespace.version
                    );
                }
                if (existingNamespace.publicationDate.getTime() < requiredModel.publicationDate.getTime()) {
                    errorLog(
                        "Expecting ",
                        requiredModel.modelUri,
                        " with publicationDate at least ",
                        requiredModel.publicationDate.toUTCString(),
                        " but namespace publicationDate is ",
                        existingNamespace.publicationDate.toUTCString()
                    );
                }
            }
        }

        let namespace: NamespacePrivate;
        // Model must not be already registered
        const existingNamespace = addressSpace.getNamespace(model.modelUri);
        if (existingNamespace) {
            namespace = existingNamespace;
        } else {
            namespace = addressSpace.registerNamespace(model.modelUri);
            namespace.setRequiredModels(model.requiredModels);
        }

        namespace.version = model.version;
        namespace.publicationDate = model.publicationDate || namespace.publicationDate;
        return namespace;
    }
    // #endregion

    // #region translation
    private translateNamespaceIndex(fileIndex: number): number {
        const namespaceIndex = this.table[fileIndex];
        // c8 ignore next
        if (namespaceIndex === undefined) {
            errorLog("Error; namespace_uri_translation", this.table);
            throw new Error(`_translateNamespaceIndex() ! Cannot find namespace definition for index ${fileIndex}`);
        }
        return namespaceIndex;
    }

    /** a file-local id to the address space's, built once per distinct id */
    private translate(fileLocal: NodeId): NodeId {
        const value = fileLocal.value;
        const key =
            typeof value === "number"
                ? fileLocal.namespace * 4294967296 + value
                : `${fileLocal.namespace}|${fileLocal.identifierType}|${String(value)}`;
        let nodeId = this.translatedIds.get(key);
        if (!nodeId) {
            const namespace = this.translateNamespaceIndex(fileLocal.namespace);
            nodeId = namespace === fileLocal.namespace ? fileLocal : new NodeId(fileLocal.identifierType, value, namespace);
            this.translatedIds.set(key, nodeId);
        }
        return nodeId;
    }
    private translateOrNull(fileLocal: NodeId | null | undefined): NodeId | null {
        return fileLocal ? this.translate(fileLocal) : null;
    }
    private translateQualifiedName(fileLocal: QualifiedName): QualifiedName {
        return new QualifiedName({ namespaceIndex: this.translateNamespaceIndex(fileLocal.namespaceIndex), name: fileLocal.name });
    }

    /**
     * an id given as text, the way the XML body of a deferred extension object carries them:
     * an alias, or `ns=<file index>;...`
     */
    private readonly translateString = (text: string): NodeId => {
        const aliased = this.aliasMap.get(text);
        if (aliased) {
            return aliased;
        }
        const translated = this.translatedStrings.get(text);
        if (translated) {
            return translated;
        }
        let nodeIdString = text;
        const m = text.match(reg);
        if (m) {
            nodeIdString = `ns=${this.translateNamespaceIndex(parseInt(m[1], 10))};${m[2]}`;
        }
        const result = resolveNodeId(nodeIdString);
        this.translatedStrings.set(text, result);
        return result;
    };

    /** the ids a value may hold, by data type; everything else passes through */
    private translateValue(value: VariantOptions): VariantOptions {
        switch (value.dataType) {
            case DataType.NodeId:
            case DataType.ExpandedNodeId: {
                const v = value.value;
                if (Array.isArray(v)) {
                    value.value = v.map((e) => (e instanceof NodeId ? this.translate(e) : e));
                } else if (v instanceof NodeId) {
                    value.value = this.translate(v);
                }
                break;
            }
            case DataType.QualifiedName: {
                const fix = (q: unknown) => {
                    if (q && typeof q === "object" && typeof (q as QualifiedName).namespaceIndex === "number") {
                        (q as QualifiedName).namespaceIndex = this.translateNamespaceIndex((q as QualifiedName).namespaceIndex);
                    }
                    return q;
                };
                value.value = Array.isArray(value.value) ? value.value.map(fix) : fix(value.value);
                break;
            }
            case DataType.ExtensionObject: {
                const fix = (e: unknown) => {
                    if (e instanceof Argument && e.dataType instanceof NodeId) {
                        e.dataType = this.translate(e.dataType);
                    }
                    return e;
                };
                if (Array.isArray(value.value)) {
                    value.value.forEach(fix);
                } else {
                    fix(value.value);
                }
                break;
            }
            default:
                break;
        }
        return value;
    }
    // #endregion

    // #region nodes
    private canIgnore(record: NodesetNodeRecord): boolean {
        if (record.releaseStatus === "Draft" && !this.options.loadDraftNodes) {
            // c8 ignore next
            doDebug && debugLog("Ignoring Draft            =", NodeClass[record.nodeClass], record.browseName.toString());
            return true;
        }
        if (record.releaseStatus === "Deprecated" && !this.options.loadDeprecatedNodes) {
            // c8 ignore next
            doDebug && debugLog("Ignoring Deprecate        =", NodeClass[record.nodeClass], record.browseName.toString());
            return true;
        }
        return false;
    }

    private permissions(record: NodesetNodeRecord): INodePermissions {
        let rolePermissions: RolePermissionTypeOptions[] | undefined;
        if (this.applyRolePermissions) {
            if (record.rolePermissions) {
                rolePermissions = record.rolePermissions.map((r) => ({
                    roleId: this.translate(r.roleId),
                    permissions: r.permissions
                }));
            } else if (record.hasNoPermissions) {
                // HasNoPermissions="true" is not the same as an absent <RolePermissions>: the former
                // grants nothing at all, the latter inherits the namespace default. An empty array
                // is how BaseNode distinguishes the two.
                rolePermissions = [];
            }
        }
        return {
            accessRestrictions: this.applyAccessRestrictions ? convertAccessRestrictions(record.accessRestrictions) : undefined,
            rolePermissions
        };
    }

    private common(record: NodesetNodeRecord) {
        return {
            nodeClass: record.nodeClass,
            nodeId: record.nodeId.isEmpty() ? null : this.translate(record.nodeId),
            browseName: this.translateQualifiedName(record.browseName),
            references: record.references.map((r) => ({
                isForward: r.isForward,
                nodeId: this.translate(r.nodeId),
                referenceType: this.translate(r.referenceType)
            })),
            ...this.permissions(record)
        };
    }

    private createNode(params: CreateNodeOptions): BaseNode {
        // c8 ignore next
        if (!(params.nodeId instanceof NodeId)) {
            throw new Error("invalid param expecting a valid nodeId");
        } // already translated
        const namespace = this.addressSpace.getNamespace(params.nodeId.namespace);
        return namespace.internalCreateNode(params) as BaseNode;
    }

    private applyNode(record: NodesetNodeRecord): void {
        if (this.canIgnore(record)) {
            return;
        }
        switch (record.nodeClass) {
            case NodeClass.Object:
                this.createNode({
                    ...this.common(record),
                    isAbstract: record.isAbstract,
                    eventNotifier: record.eventNotifier,
                    symbolicName: record.symbolicName ?? null,
                    displayName: record.displayName,
                    description: record.description
                } as CreateNodeOptions);
                return;
            case NodeClass.ObjectType:
                this.createNode({
                    ...this.common(record),
                    isAbstract: record.isAbstract,
                    eventNotifier: record.eventNotifier,
                    displayName: record.displayName,
                    description: record.description
                } as CreateNodeOptions);
                return;
            case NodeClass.ReferenceType: {
                const params = {
                    ...this.common(record),
                    isAbstract: record.isAbstract,
                    displayName: record.displayName,
                    description: record.description,
                    inverseName: record.inverseName
                } as unknown as AddReferenceTypeOptions;
                // c8 ignore next
                if (!(params.nodeId instanceof NodeId)) {
                    throw new Error("invalid param");
                } // already translated
                this.addressSpace.getNamespace(params.nodeId.namespace).addReferenceType(params);
                return;
            }
            case NodeClass.DataType:
                this.applyDataType(record);
                return;
            case NodeClass.Variable:
                this.applyVariable(record);
                return;
            case NodeClass.VariableType:
                this.applyVariableType(record);
                return;
            case NodeClass.Method:
                this.createNode({
                    ...this.common(record),
                    parentNodeId: this.translateOrNull(record.parentNodeId),
                    methodDeclarationId: this.translateOrNull(record.methodDeclarationId),
                    displayName: record.displayName
                } as CreateNodeOptions);
                return;
            default:
                throw new Error(`NodesetRecordApplier: unexpected node class ${record.nodeClass}`);
        }
    }

    private applyDataType(record: NodesetNodeRecord): void {
        const fields = (record.definition?.fields ?? []).map((field) => ({
            ...field,
            dataType: field.dataType ? this.translate(field.dataType) : null
        }));
        const params = {
            ...this.common(record),
            nodeId: record.nodeId.isEmpty() ? undefined : this.translate(record.nodeId),
            isAbstract: record.isAbstract || false,
            displayName: record.displayName ?? "",
            description: record.description ?? "",
            symbolicName: record.symbolicName,
            partialDefinition: fields
        } as unknown as CreateNodeOptions;

        let capturedDataTypeNode: UADataType | undefined = this.createNode(params) as UADataType;
        const queues = this.queues;
        const processBasicDataType = async (_addressSpace2: IAddressSpace) => {
            if (!capturedDataTypeNode) return;
            const definitionName = capturedDataTypeNode.browseName.name || "";
            const isStructure = capturedDataTypeNode.isStructure();
            const isEnumeration = capturedDataTypeNode.isEnumeration();
            if (!isEnumeration && !isStructure && capturedDataTypeNode.nodeId.namespace !== 0) {
                // add a custom basic type that is not a structure nor a enumeration
                queues.pendingSimpleTypeToRegister.push({ name: definitionName, dataTypeNodeId: capturedDataTypeNode.nodeId });
            }
            capturedDataTypeNode = undefined;
        };
        queues.postTasks.push(processBasicDataType);
    }

    /**
     * the value of a record, translated, with the extension objects still waiting as XML replaced
     * by null and their decode queued; the deferred getter yields them once decoded
     */
    private prepareValue(record: NodesetNodeRecord, value: VariantOptions): VariantOptions {
        value = this.translateValue(value);
        if (value.dataType !== DataType.ExtensionObject) {
            return value;
        }
        const nodeId = record.nodeId.isEmpty() ? NodeId.nullNodeId : this.translate(record.nodeId);
        const translateString = this.translateString;
        if (value.value instanceof XmlExtensionObjectFragment) {
            const fragment = value.value;
            let captured: ExtensionObject | null = null;
            this.queues.postTasks0_DecodePojoString.push(
                createXMLExtensionObjectDecodingTask(
                    translateString,
                    this.translate(fragment.typeId),
                    fragment.bodyXML,
                    (extensionObject) => {
                        captured = extensionObject;
                    }
                )
            );
            this.assignExtensionObjectLater(nodeId, () => captured);
            return { dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Scalar, value: null };
        }
        if (Array.isArray(value.value) && value.value.some((e) => e instanceof XmlExtensionObjectFragment)) {
            const list: (ExtensionObject | null)[] = value.value.map((e) => (e instanceof XmlExtensionObjectFragment ? null : e));
            value.value.forEach((e, index) => {
                if (!(e instanceof XmlExtensionObjectFragment)) return;
                this.queues.postTasks0_DecodePojoString.push(
                    createXMLExtensionObjectDecodingTask(
                        translateString,
                        this.translate(e.typeId),
                        e.bodyXML,
                        (extensionObject) => {
                            list[index] = extensionObject;
                        }
                    )
                );
            });
            this.assignExtensionObjectLater(nodeId, () => list as ExtensionObject[]);
            return { dataType: DataType.ExtensionObject, arrayType: VariantArrayType.Array, value: null };
        }
        return value;
    }

    private assignExtensionObjectLater(nodeId: NodeId, deferred: () => ExtensionObject | ExtensionObject[] | null): void {
        // let's create the mechanism that postpone the assignment of the extension object
        const task = async (addressSpace2: IAddressSpace) => {
            const extensionObjOrArray = deferred();
            assert(nodeId, "expecting a nodeid");
            const node = addressSpace2.findNode(nodeId);
            if (!node) return;

            if (node.nodeClass === NodeClass.Variable) {
                const v = node as UAVariable;
                assert(v.getBasicDataType() === DataType.ExtensionObject, "expecting an extension object");
                if (extensionObjOrArray != null) {
                    v.bindExtensionObject(extensionObjOrArray, { createMissingProp: false });
                }
            } else if (node.nodeClass === NodeClass.VariableType) {
                const v = node as UAVariableType;
                (v as unknown as { value: { value: unknown } }).value.value = extensionObjOrArray;
            }
        };
        this.queues.postTasks2_AssignedExtensionObjectToDataValue.push(task);
    }

    private variableCommon(record: NodesetNodeRecord) {
        return {
            ...this.common(record),
            parentNodeId: this.translateOrNull(record.parentNodeId),
            dataType: this.translateOrNull(record.dataType),
            valueRank: record.valueRank ?? -1,
            arrayDimensions: record.arrayDimensions ?? null,
            minimumSamplingInterval: record.minimumSamplingInterval ?? 0,
            displayName: record.displayName !== undefined ? (coerceLocalizedText(record.displayName) ?? undefined) : undefined,
            description: record.description !== undefined ? (coerceLocalizedText(record.description) ?? undefined) : undefined
        };
    }

    private applyVariable(record: NodesetNodeRecord): void {
        const accessLevel = convertAccessLevel(record.accessLevel);
        const value = record.value ? this.prepareValue(record, record.value) : undefined;
        const params = {
            ...this.variableCommon(record),
            historizing: record.historizing ?? false,
            accessLevel,
            userAccessLevel: convertUserAccessLevel(record.userAccessLevel, accessLevel),
            // the value is set by a post task, once every data type is known
            value: Object.create(null)
        } as unknown as CreateNodeOptions;

        const addressSpace = this.addressSpace;
        let capturedVariable: UAVariable | undefined;
        if (value && value.dataType !== DataType.Null) {
            let capturedValue: VariantOptions | undefined = value;
            const task = async (_addressSpace2: IAddressSpace) => {
                if (!capturedVariable) return;
                const cv = capturedVariable;
                (cv as UAVariableImpl)._setInitialDataValue(capturedValue as VariantOptions);
                capturedValue = undefined;
                capturedVariable = undefined;
            };
            if (capturedValue.dataType !== DataType.ExtensionObject) {
                this.queues.postTasks0_InitializeVariable.push(task);
            } else {
                // do them later when every thing is created
                this.queues.postTasks1_InitializeVariable.push(task);
            }
        } else {
            const task = async (_addressSpace2: IAddressSpace) => {
                if (!capturedVariable) return;
                const cv = capturedVariable;
                const defaultValue = makeDefaultVariant(addressSpace, cv.dataType, cv.valueRank, cv.arrayDimensions);
                if (defaultValue) {
                    // a Matrix variable declared with fixed ArrayDimensions but no <Value> is built with
                    // an empty value (value=[]) yet non-zero declared dimensions. This is an *uninitialized*
                    // and internally inconsistent matrix (value.length !== product(dimensions)). Advertising
                    // it as Good would put a spec-violating matrix on the wire (ArraySize 0 + non-empty
                    // ArrayDimensions), so flag it as BadWaitingForInitialData like any other missing value.
                    if (defaultValue.dataType === DataType.Null || isUninitializedMatrix(defaultValue)) {
                        (cv as UAVariableImpl)._setInitialDataValue(defaultValue, StatusCodes.BadWaitingForInitialData);
                    } else {
                        (cv as UAVariableImpl)._setInitialDataValue(defaultValue, StatusCodes.Good);
                    }
                }
                capturedVariable = undefined;
            };
            this.queues.postTasks0_InitializeVariable.push(task);
        }
        capturedVariable = this.createNode(params) as UAVariable;
    }

    private applyVariableType(record: NodesetNodeRecord): void {
        const value = record.value ? this.prepareValue(record, record.value) : undefined;
        const params = {
            ...this.variableCommon(record),
            // a ValueRank of 0 has always been read as Scalar on a variable type; kept
            valueRank: record.valueRank || -1,
            // UAVariableType has no Historizing attribute in the XSD: keep it false
            historizing: false,
            isAbstract: record.isAbstract,
            displayName:
                record.displayName !== undefined ? (coerceLocalizedText(record.displayName || "") ?? undefined) : undefined,
            description:
                record.description !== undefined ? (coerceLocalizedText(record.description || "") ?? undefined) : undefined,
            value
        } as unknown as CreateNodeOptions;
        this.createNode(params);
    }
    // #endregion
}
