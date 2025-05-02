/* eslint-disable max-statements */
/**
 * @module node-opcua-address-space
 */
import { promisify, types } from "util";
import chalk from "chalk";

import { coerceByte, coerceBoolean, coerceInt32 } from "node-opcua-basic-types";
import {
    AddReferenceTypeOptions,
    BaseNode,
    CreateNodeOptions,
    IAddressSpace,
    INamespace,
    RequiredModel,
    UADataType,
    UAVariable,
    UAVariableType
} from "node-opcua-address-space-base";
import { assert, renderError } from "node-opcua-assert";
import { StatusCodes } from "node-opcua-basic-types";
import {
    AccessLevelFlag,
    coerceLocalizedText,
    LocalizedText,
    makeAccessLevelFlag,
    NodeClass,
    QualifiedName,
    stringToQualifiedName
} from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { getBuiltInType } from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { ErrorCallback } from "node-opcua-status-code";
import { EnumFieldOptions, StructureFieldOptions } from "node-opcua-types";
import { DataType, Variant, VariantArrayType, VariantOptions, VariantOptionsT } from "node-opcua-variant";
import {
    _definitionParser,
    ReaderState,
    ReaderStateParserLike,
    Xml2Json,
    XmlAttributes,
    SimpleCallback
} from "node-opcua-xml2json";
import semver from "semver";

import { AddressSpacePrivate } from "../../src/address_space_private";
import { NamespacePrivate } from "../../src/namespace_private";
import { NodeSetLoaderOptions } from "../interfaces/nodeset_loader_options";
import { promoteObjectsAndVariables } from "./namespace_post_step";
import { ensureDatatypeExtracted } from "./ensure_datatype_extracted";
import { makeSemverCompatible } from "./make_semver_compatible";
import { makeVariantReader } from "./parsers/variant_parser";
import { ExtensionObject } from "node-opcua-extension-object";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);
const errorLog = make_errorLog(__filename);

function __make_back_references(namespace: INamespace) {
    const namespaceP = namespace as NamespacePrivate;
    for (const node of namespaceP.nodeIterator()) {
        node.propagate_back_references();
    }
    for (const node of namespaceP.nodeIterator()) {
        node.install_extra_properties();
    }
}

function make_back_references(addressSpace: IAddressSpace): void {
    const addressSpacePrivate = addressSpace as AddressSpacePrivate;
    addressSpacePrivate.suspendBackReference = false;
    addressSpace.getNamespaceArray().map(__make_back_references);
}

function stringToUInt32Array(str: string): number[] | null {
    const array = str ? str.split(",").map((value: string) => parseInt(value, 10)) : null;
    return array;
}

function convertAccessLevel(accessLevel?: string | null): AccessLevelFlag {
    const accessLevelN: number = parseInt(accessLevel || "1", 10); // CurrentRead if not specified
    return makeAccessLevelFlag(accessLevelN);
}

type Task = (addressSpace: IAddressSpace) => Promise<void>;

function makeDefaultVariant(
    addressSpace: IAddressSpace,
    dataTypeNode: NodeId,
    valueRank: number,
    arrayDimensions?: number[] | null
): VariantOptions | undefined {
    let variant: VariantOptions = { dataType: DataType.Null };

    const nodeDataType = addressSpace.findNode(dataTypeNode) as UADataType;
    if (nodeDataType && nodeDataType.basicDataType) {
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
export interface NodeSet2ParserEngine {
    addNodeSet: (xmlData: string) => Promise<void>;
    terminate: () => Promise<void>;
}

function makeNodeSetParserEngine(addressSpace: IAddressSpace, options: NodeSetLoaderOptions): NodeSet2ParserEngine {
    const addressSpace1 = addressSpace as AddressSpacePrivate;
    addressSpace1.suspendBackReference = true;

    options.loadDeprecatedNodes = options.loadDeprecatedNodes === undefined ? true : options.loadDeprecatedNodes;
    options.loadDraftNodes = options.loadDraftNodes || false;

    const postTasks: Task[] = [];
    const postTasks0_InitializeVariable: Task[] = [];
    const postTasks0_DecodePojoString: Task[] = [];
    const postTasks1_InitializeVariable: Task[] = [];
    const postTasks2_AssignedExtensionObjectToDataValue: Task[] = [];

    let aliasMap: Map<string, NodeId> = new Map();

    /**
     * @param aliasName
     */
    function addAlias(aliasName: string, nodeIdInXmlContext: string) {
        assert(typeof nodeIdInXmlContext === "string");
        const nodeId = _translateNodeId(nodeIdInXmlContext);
        assert(nodeId instanceof NodeId);
        aliasMap.set(aliasName, nodeId);
        addressSpace1.getNamespace(nodeId.namespace).addAlias(aliasName, nodeId);
    }

    let namespaceUriTranslationMap: Map<number, number> = new Map();
    let namespaceCounter = 0;
    let foundNamespaceMap: Map<string, NamespacePrivate> = new Map();
    let models: Model[] = [];
    let performedCalled = false;

    function _reset_namespace_translation() {
        debugLog("_reset_namespace_translation");
        namespaceUriTranslationMap.clear();
        foundNamespaceMap.clear();
        namespaceCounter = 0;
        aliasMap.clear();
        models = [];
        performedCalled = false;
    }

    function _translateNamespaceIndex(innerIndex: number) {
        const namespaceIndex = namespaceUriTranslationMap.get(innerIndex);

        // istanbul ignore next
        if (namespaceIndex === undefined) {
            errorLog("Error; namespace_uri_translation", namespaceUriTranslationMap.entries());
            throw new Error("_translateNamespaceIndex() ! Cannot find namespace definition for index " + innerIndex);
        }
        return namespaceIndex;
    }

    function _internal_addReferenceType(params: AddReferenceTypeOptions) {
        // istanbul ignore next
        if (!(params.nodeId instanceof NodeId)) {
            throw new Error("invalid param");
        } // already translated

        const namespace = addressSpace1.getNamespace(params.nodeId!.namespace);
        namespace.addReferenceType(params);
    }

    function _internal_createNode(params: CreateNodeOptions): BaseNode {
        // istanbul ignore next
        if (!(params.nodeId instanceof NodeId)) {
            throw new Error("invalid param expecting a valid nodeId");
        } // already translated

        const namespace = addressSpace1.getNamespace(params.nodeId.namespace);
        return namespace.internalCreateNode(params) as BaseNode;
    }

    function _register_namespace_uri_in_translation_table(namespaceUri: string): void {
        if (foundNamespaceMap.has(namespaceUri)) {
            return;
        }
        const namespace = addressSpace1.getNamespace(namespaceUri);

        // istanbul ignore next
        if (!namespace) {
            throw new Error(
                "cannot find namespace for " +
                namespaceUri +
                "\nplease make sure to initialize your address space with the corresponding nodeset files"
            );
        }
        foundNamespaceMap.set(namespaceUri, namespace);

        const index_in_xml = namespaceCounter;
        namespaceCounter++;
        namespaceUriTranslationMap.set(index_in_xml, namespace.index);

        doDebug &&
            debugLog(
                " _register_namespace_uri = ",
                namespaceUri,
                "index in Xml=",
                index_in_xml,
                " index in addressSpace",
                namespace.index
            );
    }

    function _add_namespace(model: Model) {
        if (model.requiredModels.length > 0) {
            // check that required models exist already in the address space
            for (const requiredModel of model.requiredModels) {
                const existingNamespace = addressSpace1.getNamespace(requiredModel.modelUri);

                // istanbul ignore next
                if (!existingNamespace) {
                    errorLog(
                        "Please ensure that the required namespace",
                        requiredModel.modelUri,
                        "is loaded first when loading",
                        model.modelUri
                    );
                    throw new Error("LoadNodeSet : Cannot find namespace for " + requiredModel.modelUri);
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
        const existingNamespace = addressSpace1.getNamespace(model.modelUri);
        if (existingNamespace) {
            namespace = existingNamespace;
        } else {
            namespace = addressSpace1.registerNamespace(model.modelUri);
            namespace.setRequiredModels(model.requiredModels);
        }

        namespace.version = model.version;
        namespace.publicationDate = model.publicationDate || namespace.publicationDate;
        return namespace;
    }

    const reg = /ns=([0-9]+);(.*)/;

    function _translateNodeId(nodeId: string): NodeId {
        if (aliasMap.has(nodeId)) {
            // note alias are already translated to the right namespaces
            const aliasedNodeId = aliasMap.get(nodeId)!;
            return aliasedNodeId;
        }
        const m = nodeId.match(reg);
        if (m) {
            const namespaceIndex = _translateNamespaceIndex(parseInt(m[1], 10));
            nodeId = "ns=" + namespaceIndex + ";" + m[2];
        }
        return resolveNodeId(nodeId);
    }

    function _translateReferenceType(refType: string): NodeId {
        return _translateNodeId(refType);
    }

    /**
     * convert a nodeId
     *
     *
     * @example
     *    convertToNodeId("String") => resolve alias
     *    convertToNodeId("i=58")   => resolve to nodeId in namespace 0
     *    convertToNodeId("ns=1;i=100") => convert namespace from xml namespace
     *                                      table to corresponding namespace in addressSpace
     */
    function convertToNodeId(nodeIdLike: string | null): NodeId | null {
        // treat alias
        if (!nodeIdLike) {
            return null;
        }
        const nodeId = _translateNodeId(nodeIdLike);
        return addressSpace1.resolveNodeId(nodeId);
    }

    function convertQualifiedName(qualifiedName: string): QualifiedName {
        const qn = stringToQualifiedName(qualifiedName);
        // Xx if (qn.namespaceIndex > 0) {
        qn.namespaceIndex = _translateNamespaceIndex(qn.namespaceIndex);
        // Xx }
        return qn;
    }

    const state_Alias = {
        finish(this: any) {
            addAlias(this.attrs.Alias, this.text);
        }
    };

    const references_parser = {
        init(this: any) {
            this.parent.obj.references = [];
            this.array = this.parent.obj.references;
        },
        parser: {
            Reference: {
                finish(this: any) {
                    this.parent.array.push({
                        isForward: this.attrs.IsForward === undefined ? true : this.attrs.IsForward === "false" ? false : true,
                        nodeId: convertToNodeId(this.text),
                        referenceType: _translateReferenceType(this.attrs.ReferenceType)
                    });
                }
            }
        }
    };
    // #region UAObject
    const state_UAObject = {
        init(this: any, name: string, attrs: XmlAttributes) {
            _perform();

            this.obj = {
                nodeClass: NodeClass.Object,
                isAbstract: coerceBoolean(attrs.IsAbstract),
                nodeId: convertToNodeId(attrs.NodeId) || null,
                browseName: convertQualifiedName(attrs.BrowseName),
                eventNotifier: coerceByte(attrs.EventNotifier) || 0,
                symbolicName: attrs.SymbolicName || null
            };

            this.isDraft = attrs.ReleaseStatus === "Draft";
            this.isDeprecated = attrs.ReleaseStatus === "Deprecated";
        },
        finish(this: any) {
            if (canIngore({ isDraft: this.isDraft, isDeprecated: this.isDeprecated }, this.obj)) {
                return;
            }
            _internal_createNode(this.obj);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                }
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                }
            },

            References: references_parser
        }
    };
    // #endregion
    // #region UAObjectType
    const state_UAObjectType = {
        init(this: any, name: string, attrs: XmlAttributes) {
            _perform();

            this.obj = {
                nodeClass: NodeClass.ObjectType,
                isAbstract: coerceBoolean(attrs.IsAbstract),
                nodeId: convertToNodeId(attrs.NodeId) || null,
                browseName: convertQualifiedName(attrs.BrowseName),
                eventNotifier: coerceByte(attrs.EventNotifier) || 0
            };
        },
        finish(this: any) {
            _internal_createNode(this.obj);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                }
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                }
            },

            References: references_parser
        }
    };
    // #endregion
    // #region UAReferenceType
    const state_UAReferenceType = {
        init(this: any, name: string, attrs: XmlAttributes) {
            _perform();

            this.obj = {
                nodeClass: NodeClass.ReferenceType,
                isAbstract: coerceBoolean(attrs.IsAbstract),
                nodeId: convertToNodeId(attrs.NodeId) || null,
                browseName: convertQualifiedName(attrs.BrowseName)
            };
        },
        finish(this: any) {
            _internal_addReferenceType(this.obj);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                }
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                }
            },

            InverseName: {
                finish(this: any) {
                    this.parent.obj.inverseName = this.text;
                }
            },
            References: references_parser
        }
    };
    // #endregion
    // #region UADataType
    const pendingSimpleTypeToRegister: any[] = [];
    const state_UADataType = {
        init(this: any, name: string, attrs: XmlAttributes) {
            _perform();

            this.obj = {
                nodeClass: NodeClass.DataType,
                isAbstract: coerceBoolean(attrs.IsAbstract) || false,
                nodeId: convertToNodeId(attrs.NodeId) || null,
                browseName: convertQualifiedName(attrs.BrowseName),
                displayName: "",
                description: "",
                symbolicName: attrs.SymbolicName
            };

            this.isDraft = attrs.ReleaseStatus === "Draft";
            this.isDeprecated = attrs.ReleaseStatus === "Deprecated";

            this.definitionFields = [];
        },
        finish(this: any) {
            if (canIngore({ isDraft: this.isDraft, isDeprecated: this.isDeprecated }, this.obj)) {
                return;
            }

            const definitionFields = this.definitionFields as StructureFieldOptions[] | EnumFieldOptions[];

            // replace DataType with nodeId, and description to LocalizedText
            definitionFields.map((x: any) => {
                if (x.description) {
                    x.description = { text: x.description };
                }
                if (x.displayName) {
                    x.displayName = { text: x.displayName };
                }
                if (x.dataType) {
                    x.dataType = convertToNodeId(x.dataType);
                }
                return x;
            });
            this.obj.partialDefinition = definitionFields;

            let capturedDataTypeNode = _internal_createNode(this.obj) as UADataType;
            const processBasicDataType = async (addressSpace2: IAddressSpace) => {
                const definitionName = capturedDataTypeNode.browseName.name!;
                const isStructure = capturedDataTypeNode.isStructure();
                const isEnumeration = capturedDataTypeNode.isEnumeration();
                if (!isEnumeration && !isStructure && capturedDataTypeNode.nodeId.namespace !== 0) {
                    // add a custom basic type that is not a structure nor a enumeration
                    pendingSimpleTypeToRegister.push({ name: definitionName, dataTypeNodeId: capturedDataTypeNode.nodeId });
                }
                (capturedDataTypeNode as any) = undefined;
            };
            postTasks.push(processBasicDataType);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                }
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                }
            },
            References: references_parser,

            Definition: _definitionParser
        }
    };
    // #endregion
    const canIngore = (
        { isDraft, isDeprecated }: { isDraft: boolean; isDeprecated: boolean },
        node: { browseName: QualifiedName; nodeClass: NodeClass }
    ) => {
        if (isDraft && !options.loadDraftNodes) {
            debugLog("Ignoring Draft            =", NodeClass[node.nodeClass], node.browseName.toString());
            return true;
        }
        if (isDeprecated && !options.loadDeprecatedNodes) {
            debugLog("Ignoring Deprecate        =", NodeClass[node.nodeClass], node.browseName.toString());
            return true;
        }
        return false;
    };

    function fixExtensionObjectAndArray(obj: { nodeId: NodeId }, deferred: () => ExtensionObject | ExtensionObject[] | null) {
        // let's create the mechanism that postpone the assignment of the extension object
        let capturedNode = obj;
        const task = async (addressSpace2: IAddressSpace) => {
            const extensionObjOrArray = deferred();
            let nodeId = capturedNode.nodeId;
            assert(nodeId, "expecting a nodeid");
            const node = addressSpace2.findNode(nodeId)!;

            if (node.nodeClass === NodeClass.Variable) {
                const v = node as UAVariable;
                assert(v.getBasicDataType() === DataType.ExtensionObject, "expecting an extension object");
                if (extensionObjOrArray != null) {
                    v.bindExtensionObject(extensionObjOrArray, { createMissingProp: false });
                }
            } else if (node.nodeClass === NodeClass.VariableType) {
                const v = node as UAVariableType;
                (v as any) /*fix me*/.value.value = extensionObjOrArray;
            }
        };
        postTasks2_AssignedExtensionObjectToDataValue.push(task);
    }
    // #region UAVariable
    interface IUAVariableProps {
        nodeId: NodeId | null;
        value?: VariantOptions;
        nodeClass: NodeClass;
        browseName: QualifiedName;
        displayName?: LocalizedText;
        description?: LocalizedText;
        parentNodeId: NodeId | null;
        dataType: NodeId | null;
        valueRank: number;
        arrayDimensions: number[] | null;
        minimumSamplingInterval: number;
        historizing: boolean;
        accessLevel: number;
        userAccessLevel: number;
    }
    type ReaderUAVariableL1 = ReaderStateParserLike & { obj: IUAVariableProps; isDraft: boolean; isDeprecated: boolean };
    type ReaderUAVariableL2 = ReaderStateParserLike & { parent: ReaderUAVariableL1; text: string };

    const state_UAVariable = {
        init(this: ReaderUAVariableL1, name: string, attrs: XmlAttributes) {
            _perform();

            const valueRank = attrs.ValueRank === undefined ? -1 : coerceInt32(attrs.ValueRank);
            const accessLevel = convertAccessLevel(attrs.AccessLevel);
            const nodeId = convertToNodeId(attrs.NodeId);
            this.obj = {
                value: undefined, //  { dataType: DataType.Null },
                nodeClass: NodeClass.Variable,
                browseName: convertQualifiedName(attrs.BrowseName),
                parentNodeId: convertToNodeId(attrs.ParentNodeId),
                dataType: convertToNodeId(attrs.DataType),
                //description: null,
                // displayName: coerceLocalizedText(attrs.BrowseName)!,
                valueRank,
                arrayDimensions: valueRank <= 0 ? null : stringToUInt32Array(attrs.ArrayDimensions),
                minimumSamplingInterval: attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval, 10) : 0,
                historizing: false,
                nodeId,
                accessLevel: accessLevel,
                userAccessLevel: accessLevel // convertAccessLevel(attrs.UserAccessLevel || attrs.AccessLevel);
            };
            this.isDraft = attrs.ReleaseStatus === "Draft" || false;
            this.isDeprecated = attrs.ReleaseStatus === "Deprecated" || false;
        },
        finish(this: ReaderUAVariableL1) {
            if (canIngore({ isDraft: this.isDraft, isDeprecated: this.isDeprecated }, this.obj)) {
                return;
            }

            /*
            // set default value based on obj data Type
            if (this.obj.value === undefined) {
                const dataTypeNode = this.obj.dataType;
                const valueRank = this.obj.valueRank;
                this.obj.value = makeDefaultVariant(addressSpace, dataTypeNode, valueRank);
            }
            */
            // eslint-disable-next-line prefer-const
            let capturedVariable: UAVariable;
            if (this.obj.value && this.obj.value.dataType !== DataType.Null) {
                let capturedValue: any | undefined = this.obj.value;
                const task = async (addressSpace2: IAddressSpace) => {
                    if (false && doDebug) {
                        debugLog("1 setting value to ", capturedVariable.nodeId.toString(), new Variant(capturedValue).toString());
                    }
                    capturedVariable.setValueFromSource(capturedValue);
                    capturedValue = undefined;
                    (capturedVariable as any) = undefined;
                };
                if (capturedValue.dataType !== DataType.ExtensionObject) {
                    postTasks0_InitializeVariable.push(task);
                } else {
                    // do them later when every thing is created
                    postTasks1_InitializeVariable.push(task);
                }
            } else {
                const task = async (addressSpace2: IAddressSpace) => {
                    const dataTypeNode = capturedVariable.dataType;
                    const valueRank = capturedVariable.valueRank;
                    const arrayDimensions = capturedVariable.arrayDimensions;

                    const value = makeDefaultVariant(addressSpace, dataTypeNode, valueRank, arrayDimensions);
                    if (value) {
                        if (false && doDebug) {
                            debugLog("2 setting value to ", capturedVariable.nodeId.toString(), value);
                        }
                        if (value.dataType === DataType.Null) {
                            capturedVariable.setValueFromSource(value, StatusCodes.BadWaitingForInitialData);
                        } else {
                            capturedVariable.setValueFromSource(value, StatusCodes.Good);
                        }
                    }
                    (capturedVariable as any) = undefined;
                };
                postTasks0_InitializeVariable.push(task);
            }
            this.obj.value = Object.create(null);
            capturedVariable = _internal_createNode(this.obj) as UAVariable;
        },
        parser: {
            DisplayName: {
                finish(this: ReaderUAVariableL2) {
                    this.parent.obj.displayName = coerceLocalizedText(this.text)!;
                }
            },

            Description: {
                finish(this: ReaderUAVariableL2) {
                    this.parent.obj.description = coerceLocalizedText(this.text)!;
                }
            },
            References: references_parser,

            Value: makeVariantReader<ReaderUAVariableL2>(
                (self: ReaderUAVariableL2, data: VariantOptions) => {
                    self.parent.obj.value = data;
                },
                (self: ReaderUAVariableL2, data: VariantOptions, deferredTask) => {
                    self.parent.obj.value = data;
                    const capturedVariable = { nodeId: self.parent.obj.nodeId! };
                    fixExtensionObjectAndArray(capturedVariable, deferredTask);
                },
                (task) => {
                    postTasks0_DecodePojoString.push(task);
                },
                _translateNodeId
            )
        }
    };
    // #endregion
    // #region UAVariableType
    interface IUAVariableTypeProps extends Omit<IUAVariableProps, "accessLevel" | "userAccessLevel"> {
        isAbstract: boolean;
    }
    type ReaderUAVariableTypeL1 = ReaderStateParserLike & { obj: IUAVariableTypeProps; isDraft: boolean; isDeprecated: boolean };
    type ReaderUAVariableTypeL2 = ReaderStateParserLike & { parent: ReaderUAVariableTypeL1; text: string };
    const state_UAVariableType = {
        init(this: ReaderUAVariableTypeL1, name: string, attrs: XmlAttributes) {
            _perform();
            const valueRank = coerceInt32(attrs.ValueRank) || -1;
            this.obj = {
                value: undefined, // { dataType: DataType.Null },
                isAbstract: coerceBoolean(attrs.IsAbstract),
                nodeClass: NodeClass.VariableType,
                browseName: convertQualifiedName(attrs.BrowseName),
                parentNodeId: convertToNodeId(attrs.ParentNodeId) || null,
                dataType: convertToNodeId(attrs.DataType) || null,
                valueRank,
                arrayDimensions: valueRank <= 0 ? null : stringToUInt32Array(attrs.ArrayDimensions),
                minimumSamplingInterval: attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval, 10) : 0,
                historizing: false,
                nodeId: convertToNodeId(attrs.NodeId) || null
            };
            this.isDraft = attrs.ReleaseStatus === "Draft";
            this.isDeprecated = attrs.ReleaseStatus === "Deprecated";
        },
        finish(this: ReaderUAVariableTypeL1) {
            if (canIngore({ isDraft: this.isDraft, isDeprecated: this.isDeprecated }, this.obj)) {
                return;
            }
            _internal_createNode(this.obj);
        },
        parser: {
            DisplayName: {
                finish(this: ReaderUAVariableTypeL2) {
                    this.parent.obj.displayName = coerceLocalizedText(this.text || "")!;
                }
            },

            Description: {
                finish(this: ReaderUAVariableTypeL2) {
                    this.parent.obj.description = coerceLocalizedText(this.text || "")!;
                }
            },
            References: references_parser,
            Value: makeVariantReader<ReaderUAVariableTypeL2>(
                (self: ReaderUAVariableTypeL2, data: VariantOptions) => {
                    self.parent.obj.value = data;
                },
                (self: ReaderUAVariableTypeL2, data: VariantOptions, deferredTask) => {
                    self.parent.obj.value = data;
                    const capturedVariable = { nodeId: self.parent.obj.nodeId! };
                    fixExtensionObjectAndArray(capturedVariable, deferredTask);
                },
                (task) => {
                    postTasks0_DecodePojoString.push(task);
                },
                _translateNodeId
            )
        }
    };
    // #endregion
    // #region UAMethod
    const state_UAMethod = {
        init(this: any, name: string, attrs: XmlAttributes) {
            _perform();

            this.obj = {
                nodeClass: NodeClass.Method,
                // MethodDeclarationId
                // ParentNodeId
                browseName: convertQualifiedName(attrs.BrowseName),
                parentNodeId: attrs.ParentNodeId || null,
                nodeId: convertToNodeId(attrs.NodeId) || null,
                methodDeclarationId: attrs.MethodDeclarationId ? _translateNodeId(attrs.MethodDeclarationId) : null
            };
            this.isDraft = attrs.ReleaseStatus === "Draft";
            this.isDeprecated = attrs.ReleaseStatus === "Deprecated";
        },
        finish(this: any) {
            if (canIngore({ isDraft: this.isDraft, isDeprecated: this.isDeprecated }, this.obj)) {
                return;
            }
            _internal_createNode(this.obj);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                }
            },
            References: references_parser
        }
    };
    // #endregion
    // #region Model
    interface Model {
        modelUri: string;
        version: string;
        publicationDate?: Date;
        requiredModels: RequiredModel[];
        accessRestrictions?: string;
        symbolicName?: string;
    }

    const state_ModelTableEntry = new ReaderState({
        // ModelTableEntry

        init(this: any) {
            this._requiredModels = [] as RequiredModel[];
        },
        parser: {
            RequiredModel: {
                init(this: any, name: string, attrs: XmlAttributes) {
                    const modelUri = attrs.ModelUri;
                    const version = attrs.Version;
                    const publicationDate = new Date(Date.parse(attrs.PublicationDate));

                    this.parent._requiredModels.push({ modelUri, version, publicationDate });
                },
                finish(this: any) {
                    /** */
                }
            }
        },
        finish(this: any) {
            const modelUri = this.attrs.ModelUri; // //"http://opcfoundation.org/UA/"
            const version = this.attrs.Version; // 1.04
            const publicationDate = this.attrs.PublicationDate ? new Date(Date.parse(this.attrs.PublicationDate)) : undefined; // "2018-05-15T00:00:00Z" "
            // optional,
            const symbolicName = this.attrs.SymbolicName;
            const accessRestrictions = this.attrs.AccessRestrictions;

            const model = {
                accessRestrictions,
                modelUri,
                publicationDate,
                requiredModels: this._requiredModels,
                symbolicName,
                version
            };
            const namespace = _add_namespace(model);
            models.push(model);
        }
    });
    // #endregion
    function _updateTranslationTable() {
        _register_namespace_uri_in_translation_table("http://opcfoundation.org/UA/");
        for (const namespaceUri of _namespaceUris) {
            _register_namespace_uri_in_translation_table(namespaceUri);
        }
    }

    function _perform() {
        if (performedCalled) return;
        performedCalled = true;

        /**special case for old nodeset file version 1.02 where no models exists */
        if (models.length === 0) {
            for (const namespaceuri of _namespaceUris) {
                const existingNamespace = addressSpace1.getNamespace(namespaceuri);
                if (existingNamespace) {
                    continue;
                }

                _add_namespace({
                    modelUri: namespaceuri,
                    version: "1.0.0",
                    requiredModels: []
                });
            }
        }
        _updateTranslationTable();
    }
    // state_ModelTableEntry.parser["RequiredModel"] = state_ModelTableEntry;
    let _namespaceUris: string[] = [];
    const state_0: ReaderStateParserLike = {
        parser: {
            Aliases: {
                init(this: any) {
                    _perform();
                },
                parser: { Alias: state_Alias }
            },

            NamespaceUris: {
                init(this: any) {
                    //
                    _namespaceUris = [];
                },
                parser: {
                    Uri: {
                        finish(this: any) {
                            _namespaceUris.push(this.text);
                        }
                    }
                },
                finish(this: any) {
                    // verify that requested namespaces are already loaded or abort with a message
                }
            },

            Models: {
                // ModelTable
                init(this: any, name: string, attrs: XmlAttributes) {
                    /* */
                },
                parser: {
                    Model: state_ModelTableEntry
                },

                finish(this: any) {
                    /** */
                }
            },

            UADataType: state_UADataType,
            UAMethod: state_UAMethod,
            UAObject: state_UAObject,
            UAObjectType: state_UAObjectType,
            UAReferenceType: state_UAReferenceType,
            UAVariable: state_UAVariable,
            UAVariableType: state_UAVariableType
        }
    };

    const parser = new Xml2Json(state_0);

    async function terminate() {
        make_back_references(addressSpace1);

        // setting up Server_NamespaceArray

        if (addressSpace1.rootFolder?.objects?.server?.namespaceArray) {
            addressSpace1.rootFolder.objects.server.namespaceArray.setValueFromSource({
                arrayType: VariantArrayType.Array,
                dataType: DataType.String,
                value: addressSpace1.getNamespaceArray().map((ns) => ns.namespaceUri)
            });
            // istanbul ignore next
            if (doDebug) {
                debugLog(
                    "addressSpace NS = ",
                    addressSpace1.rootFolder.objects.server.namespaceArray.readValue().value.value.join(" ")
                );
            }
        }
        doDebug &&
            debugLog(
                chalk.bgGreenBright("Performing post loading tasks -------------------------------------------") +
                chalk.green("DONE")
            );

        async function performPostLoadingTasks(tasks: Task[]): Promise<void> {
            for (const task of tasks) {
                try {
                    await task(addressSpace1);
                } catch (err) {
                    // istanbul ignore next
                    // tslint:disable:no-console
                    if (types.isNativeError(err)) {
                        errorLog(" performPostLoadingTasks Err  => ", err.message, "\n", err);
                    }
                    await task(addressSpace1);
                }
            }
            tasks.splice(0);
        }
        async function finalSteps(): Promise<void> {
            /// ----------------------------------------------------------------------------------------
            // perform post task
            doDebug && debugLog(chalk.bgGreenBright("Performing post loading tasks -------------------------------------------"));
            await performPostLoadingTasks(postTasks);

            doDebug &&
                debugLog(chalk.bgGreenBright("Performing post loading task: Initializing Simple Variables ---------------------"));
            await performPostLoadingTasks(postTasks0_InitializeVariable);

            doDebug && debugLog(chalk.bgGreenBright("Performing DataType extraction -------------------------------------------"));
            assert(!addressSpace1.suspendBackReference);
            await ensureDatatypeExtracted(addressSpace);
            const dataTypeManager = (addressSpace as AddressSpacePrivate).getDataTypeManager();

            /// ----------------------------------------------------------------------------------------
            doDebug && debugLog(chalk.bgGreenBright("DataType extraction done ") + chalk.green("DONE"));

            for (const { name, dataTypeNodeId } of pendingSimpleTypeToRegister) {
                if (dataTypeNodeId.namespace === 0) {
                    continue;
                }
                const dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(dataTypeNodeId.namespace);
            }
            pendingSimpleTypeToRegister.splice(0);

            doDebug && debugLog(chalk.bgGreenBright("Performing post loading task: Decoding Pojo String (parsing XML objects) -"));
            await performPostLoadingTasks(postTasks0_DecodePojoString);

            doDebug &&
                debugLog(chalk.bgGreenBright("Performing post loading task: Initializing Complex Variables ---------------------"));
            await performPostLoadingTasks(postTasks1_InitializeVariable);

            doDebug && debugLog(chalk.bgGreenBright("Performing post loading tasks: (assigning Extension Object to Variables) -"));
            await performPostLoadingTasks(postTasks2_AssignedExtensionObjectToDataValue);

            doDebug && debugLog(chalk.bgGreenBright("Performing post variable initialization ---------------------"));
            promoteObjectsAndVariables(addressSpace);
        }

        try {
            await finalSteps();
        } catch (err) {
            renderError(err);
        }
    }
    async function addNodeSet(xmlData: string): Promise<void> {
        _reset_namespace_translation();
        parser.parseString(xmlData);
    }

    return {
        addNodeSet,
        terminate
    };
}

export class NodeSetLoader {
    _s: NodeSet2ParserEngine;
    constructor(
        addressSpace: IAddressSpace,
        private options?: NodeSetLoaderOptions
    ) {
        this._s = makeNodeSetParserEngine(addressSpace, options || {});
    }

    async addNodeSetAsync(xmlData: string): Promise<void> {
        return await this._s.addNodeSet(xmlData);
    }

    async terminate(): Promise<void> {
        await this._s.terminate();
    }
}
