/**
 * @module node-opcua-address-space
 */
import * as async from "async";
import * as chalk from "chalk";
import * as fs from "fs";
import * as _ from "underscore";
import { callbackify } from "util";

import { assert } from "node-opcua-assert";
import * as ec from "node-opcua-basic-types";
import { ExtraDataTypeManager, populateDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { EnumValueType } from "node-opcua-common";
import { EUInformation } from "node-opcua-data-access";
import {
    AccessLevelFlag,
    coerceLocalizedText,
    makeAccessLevelFlag,
    NodeClass,
    QualifiedName,
    stringToQualifiedName,
} from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import {
    findSimpleType,
    getStandardDataTypeFactory,
    getStructureTypeConstructor,
    registerBasicType,
    StructuredTypeSchema,
    DataTypeFactory,
    BasicTypeDefinition,
} from "node-opcua-factory";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { Argument } from "node-opcua-service-call";
import {
    DataTypeDefinition,
    EnumDefinition,
    Range,
    StructureDefinition,
    StructureField,
    StructureType,
    StructureFieldOptions,
} from "node-opcua-types";
import { DataType, VariantArrayType, VariantOptions, Variant } from "node-opcua-variant";
import { ParserLike, ReaderState, ReaderStateParserLike, Xml2Json, XmlAttributes } from "node-opcua-xml2json";

import {
    _definitionParser,
    Definition,
    FragmentClonerParser,
    InternalFragmentClonerReaderState,
    makeExtensionObjectReader,
} from "node-opcua-xml2json";
import {
    AddReferenceTypeOptions,
    AddressSpace as AddressSpacePublic,
    CreateNodeOptions,
    Namespace,
    PseudoSession,
} from "../../source";
import { AddressSpace } from "../../src/address_space";
import { AddressSpacePrivate } from "../../src/address_space_private";
import { BaseNode } from "../../src/base_node";
import { NamespacePrivate } from "../../src/namespace_private";
import { UADataType } from "../../src/ua_data_type";
import { UAVariable } from "../../src/ua_variable";
import { UAVariableType } from "../../src/ua_variable_type";

import * as PrettyError from "pretty-error";
import { isValidGuid } from "node-opcua-basic-types";
import { parse } from "path";
const pe = new PrettyError();

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);

export async function ensureDatatypeExtracted(addressSpace: any): Promise<ExtraDataTypeManager> {
    const addressSpacePriv: any = addressSpace as any;
    if (!addressSpacePriv.$$extraDataTypeManager) {
        const dataTypeManager = new ExtraDataTypeManager();

        const namespaceArray = addressSpace.getNamespaceArray().map((n: Namespace) => n.namespaceUri);
        debugLog("Namespace Array = ", namespaceArray.join("\n                   "));
        dataTypeManager.setNamespaceArray(namespaceArray);
        addressSpacePriv.$$extraDataTypeManager = dataTypeManager;

        for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
            const dataTypeFactory1 = new DataTypeFactory([getStandardDataTypeFactory()]);
            dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
        }
        // inject simple types

        // now extract structure and enumeration from old form if
        const session = new PseudoSession(addressSpace);
        await populateDataTypeManager(session, dataTypeManager);
    }
    return addressSpacePriv.$$extraDataTypeManager;
}
export const ensureDatatypeExtractedWithCallback = callbackify(ensureDatatypeExtracted);

function findDataTypeNode(addressSpace: AddressSpace, encodingNodeId: NodeId): UADataType {
    const encodingNode = addressSpace.findNode(encodingNodeId)!;

    // istanbul ignore next
    if (!encodingNode) {
        throw new Error("findDataTypeNode:  Cannot find " + encodingNodeId.toString());
    }
    // xx console.log("encodingNode", encodingNode.toString());

    const refs = encodingNode.findReferences("HasEncoding", false);
    const dataTypes = refs.map((ref) => addressSpace.findNode(ref.nodeId)).filter((obj: any) => obj !== null);

    // istanbul ignore next
    if (dataTypes.length !== 1) {
        throw new Error("Internal Error");
    }

    const dataTypeNode = dataTypes[0] as UADataType;
    // istanbul ignore next
    if (dataTypeNode.nodeClass !== NodeClass.DataType) {
        throw new Error("internal error: expecting a UADataType node here");
    }
    return dataTypeNode;
}

async function decodeXmlObject(
    addressSpace2: AddressSpace,
    xmlEncodingNodeId: NodeId,
    xmlBody: string
): Promise<ExtensionObject | null> {
    const dataTypeManager = await ensureDatatypeExtracted(addressSpace2);
    const dataTypeNode = findDataTypeNode(addressSpace2, xmlEncodingNodeId);

    const dataTypeFactory = dataTypeManager.getDataTypeFactory(xmlEncodingNodeId.namespace);

    // istanbul ignore next
    if (!dataTypeNode) {
        debugLog(" cannot find ", xmlEncodingNodeId.toString());
        return null;
    }
    const dataTypeName = dataTypeNode.browseName.name!;
    const definitionMap = {
        findDefinition(name: string): Definition {
            debugLog(chalk.magentaBright("xxxxxxxxxxxxx !!!! "), name);
            if (!name) {
                return { name: "", fields: [] };
            }
            return (dataTypeFactory.getStructuredTypeSchema(name) as any) as Definition;
        },
    };
    const reader = makeExtensionObjectReader(dataTypeName, definitionMap, {});
    const parser2 = new Xml2Json(reader);
    const pojo = await parser2.parseString(xmlBody);
    // at this time the bsd file containing object definition
    // must have been found and object can be constructed
    const userDefinedExtensionObject = addressSpace2.constructExtensionObject(dataTypeNode, pojo);

    // istanbul ignore next
    if (doDebug) {
        debugLog("userDefinedExtensionObject", userDefinedExtensionObject.toString());
    }
    //
    return userDefinedExtensionObject;
}

function makeEnumDefinition(definitionFields: any[]) {
    return new EnumDefinition({
        fields: definitionFields.map((x) => ({
            description: {
                text: x.description,
            },
            name: x.name,
            value: x.value,
        })),
    });
}
function makeStructureDefinition(
    name: string,
    definitionFields: StructureFieldOptions[],
    isUnion: boolean
): StructureDefinition {
    // Structure = 0,
    // StructureWithOptionalFields = 1,
    // Union = 2,
    const hasOptionalFields = definitionFields.filter((field) => field.isOptional).length > 0;

    const structureType = isUnion
        ? StructureType.Union
        : hasOptionalFields
        ? StructureType.StructureWithOptionalFields
        : StructureType.Structure;

    const sd = new StructureDefinition({
        baseDataType: undefined,
        defaultEncodingId: undefined,
        fields: definitionFields,
        structureType,
    });

    return sd;
}

function __make_back_references(namespace: NamespacePrivate) {
    _.forEach(namespace._nodeid_index, (node: BaseNode) => {
        node.propagate_back_references();
    });
    _.forEach(namespace._nodeid_index, (node: BaseNode) => {
        node.install_extra_properties();
    });
}

/**
 * @method make_back_references
 * @param addressSpace  {AddressSpace}
 */
function make_back_references(addressSpace: AddressSpace): void {
    addressSpace.suspendBackReference = false;
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

type Task = (addressSpace: AddressSpace) => Promise<void>;

function makeDefaultVariant(
    addressSpace: AddressSpacePublic,
    dataTypeNode: NodeId,
    valueRank: number
): VariantOptions | undefined {
    const variant: VariantOptions = { dataType: DataType.Null };
    return variant;
}
function makeDefaultVariant2(
    addressSpace: AddressSpacePublic,
    dataTypeNode: NodeId,
    valueRank: number
): VariantOptions | undefined {
    let variant: VariantOptions = { dataType: DataType.Null };

    const nodeDataType = addressSpace.findNode(dataTypeNode);
    if (nodeDataType) {
        const dataType = addressSpace.findCorrespondingBasicDataType(dataTypeNode);
        if (dataType === DataType.ExtensionObject) {
            // console.log("xxxxxxxxxx ", dataTypeNode.toString(addressSpace as any));
            return variant;
        }
        const dv = findSimpleType(DataType[dataType]).defaultValue;

        let arrayType: VariantArrayType;
        const value = typeof dv === "function" ? dv() : dv;
        //  if (dataType === DataType.ByteString ) { value = Buffer.alloc(0) }
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
                variant = { dataType, value, arrayType };
                break;
            case 0: // one or more dimension
            case 1: // one dimension
                arrayType = VariantArrayType.Array;
                variant = { dataType, value: [], arrayType };
                break;
            default:
                arrayType = VariantArrayType.Matrix;
                variant = { dataType, value: [], arrayType, dimensions: [] };
                break;
        }
        // console.log(variant, DataType[dataType], valueRank);
    }
    return variant;
}

export function generateAddressSpace(
    addressSpace: AddressSpacePublic,
    xmlFiles: string | string[],
    callback: (err?: Error) => void
): void;
export function generateAddressSpace(addressSpace: AddressSpacePublic, xmlFiles: string | string[]): Promise<void>;
export function generateAddressSpace(
    addressSpace: AddressSpacePublic,
    xmlFiles: string | string[],
    callback?: (err?: Error) => void
): any {
    const addressSpace1 = addressSpace as AddressSpace;

    let postTasks: Task[] = [];
    let postTaskInitializeVariable: Task[] = [];
    let postTasks2: Task[] = [];
    let postTasks3: Task[] = [];

    let alias_map: { [key: string]: NodeId } = {};

    /**
     * @param aliasName
     */
    function addAlias(aliasName: string, nodeIdInXmlContext: string) {
        assert(typeof nodeIdInXmlContext === "string");
        const nodeId = _translateNodeId(nodeIdInXmlContext);
        assert(nodeId instanceof NodeId);
        alias_map[aliasName] = nodeId;
        addressSpace1.getNamespace(nodeId.namespace).addAlias(aliasName, nodeId);
    }

    let namespace_uri_translation: { [key: number]: number } = {};
    let namespaceCounter = 0;
    let found_namespace_in_uri: { [key: string]: NamespacePrivate } = {};

    function _reset_namespace_translation() {
        debugLog("_reset_namespace_translation");
        namespace_uri_translation = {};
        found_namespace_in_uri = {};
        namespaceCounter = 0;
        _register_namespace_uri("http://opcfoundation.org/UA/");
        alias_map = {};
    }

    function _translateNamespaceIndex(innerIndex: number) {
        const namespaceIndex = namespace_uri_translation[innerIndex];

        // istanbul ignore next
        if (namespaceIndex === undefined) {
            // tslint:disable-next-line: no-console
            debugLog("Warning: namespace_uri_translation = ", namespace_uri_translation);
            throw new Error("_translateNamespaceIndex! Cannot find namespace definition for index " + innerIndex);
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
        return namespace._createNode(params) as BaseNode;
    }

    function _register_namespace_uri(namespaceUri: string): NamespacePrivate {
        if (found_namespace_in_uri[namespaceUri]) {
            return found_namespace_in_uri[namespaceUri];
        }

        const namespace = addressSpace1.registerNamespace(namespaceUri);
        found_namespace_in_uri[namespaceUri] = namespace;

        const index_in_xml = namespaceCounter;
        namespaceCounter++;
        namespace_uri_translation[index_in_xml] = namespace.index;

        debugLog(
            " _register_namespace_uri = ",
            namespaceUri,
            "index in Xml=",
            index_in_xml,
            " index in addressSpace",
            namespace.index
        );
        return namespace;
    }

    function _register_namespace_uri_model(model: any) {
        const namespace = _register_namespace_uri(model.modelUri);
        namespace.version = model.version;
        namespace.publicationDate = model.publicationDate;
        return namespace;
    }

    const reg = /ns=([0-9]+);(.*)/;

    function _translateNodeId(nodeId: string): NodeId {
        if (alias_map[nodeId]) {
            return alias_map[nodeId];
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
     * @method convertToNodeId
     * @param nodeId {String|null}
     * @return {NodeId}
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

    assert(_.isFunction(callback)); // expecting a callback

    const state_Alias = {
        finish(this: any) {
            addAlias(this.attrs.Alias, this.text);
        },
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
                        isForward:
                            this.attrs.IsForward === undefined ? true : this.attrs.IsForward === "false" ? false : true,
                        nodeId: convertToNodeId(this.text),
                        referenceType: _translateReferenceType(this.attrs.ReferenceType),
                    });
                },
            },
        },
    };

    const state_UAObject = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.Object;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.eventNotifier = ec.coerceByte(attrs.EventNotifier) || 0;
            this.obj.symbolicName = attrs.SymbolicName || null;
        },
        finish(this: any) {
            _internal_createNode(this.obj);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                },
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                },
            },

            References: references_parser,
        },
    };

    const state_UAObjectType = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.ObjectType;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.eventNotifier = ec.coerceByte(attrs.EventNotifier) || 0;
        },
        finish(this: any) {
            _internal_createNode(this.obj);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                },
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                },
            },

            References: references_parser,
        },
    };

    const state_UAReferenceType = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.ReferenceType;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
        },
        finish(this: any) {
            _internal_addReferenceType(this.obj);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                },
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                },
            },

            InverseName: {
                finish(this: any) {
                    this.parent.obj.inverseName = this.text;
                },
            },
            References: references_parser,
        },
    };

    const pendingSimpleTypeToRegister: any[] = [];

    const state_UADataType = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.DataType;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract) || false;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.displayName = "";
            this.obj.description = "";
            this.obj.symbolicName = attrs.SymbolicName;
            this.isDraft = attrs.ReleaseStatus === "Draft";
            this.definitionFields = [];
        },
        finish(this: any) {
            if (this.isDraft) {
                // ignore Draft element
                debugLog("Ignoring Draft dataType =", this.obj.browseName.toString());
                return;
            }
            let definitionFields = this.definitionFields;
            // replace DataType with nodeId
            definitionFields = definitionFields.map((x: any) => {
                if (x.dataType) {
                    x.dataType = convertToNodeId(x.dataType);
                }
                return x;
            });

            const dataTypeNode = _internal_createNode(this.obj) as UADataType;
            assert(addressSpace1.findNode(this.obj.nodeId));
            const definitionName = dataTypeNode.browseName.name!;

            let alreadyCalled = false;
            const processBasicDataType = async (addressSpace2: AddressSpace) => {
                assert(!alreadyCalled);
                alreadyCalled = true;

                const enumeration = addressSpace2.findDataType("Enumeration");
                const structure = addressSpace2.findDataType("Structure");
                const union = addressSpace2.findDataType("Union");

                // we have a data type from a companion specification
                // let's see if this data type need to be registered
                const isEnumeration = enumeration && dataTypeNode.isSupertypeOf(enumeration);
                const isStructure = structure && dataTypeNode.isSupertypeOf(structure);
                const isUnion = !!(structure && union && dataTypeNode.isSupertypeOf(union!));

                if (definitionFields.length) {
                    // remove <namespace>:
                    const nameWithoutNamespace = definitionName.split(":").slice(-1)[0];

                    if (isStructure /*&& dataTypeNode.nodeId.namespace !== 0*/) {
                        // note: at this stage, structure definition will be incomplete as we do not know
                        //       what is the subType yet, encodings are also unknown...
                        //       structureType may also be inaccurate
                        debugLog("setting structure $definition for ", definitionName, nameWithoutNamespace);
                        (dataTypeNode as any).$definition = makeStructureDefinition(
                            definitionName,
                            definitionFields,
                            isUnion
                        );
                    } else if (isEnumeration /* && dataTypeNode.nodeId.namespace !== 0 */) {
                        (dataTypeNode as any).$definition = makeEnumDefinition(definitionFields);
                    }
                }
                if (!isEnumeration && !isStructure && this.obj.nodeId.namespace !== 0) {
                    pendingSimpleTypeToRegister.push({ name: definitionName, dataTypeNodeId: dataTypeNode.nodeId });
                }
            };
            postTasks.push(processBasicDataType);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                },
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                },
            },
            References: references_parser,

            Definition: _definitionParser,
        },
    };

    const localizedText_parser = {
        LocalizedText: {
            init(this: any) {
                this.localizedText = {};
            },
            parser: {
                Locale: {
                    finish(this: any) {
                        this.parent.localizedText.locale = this.text.trim();
                    },
                },
                Text: {
                    finish(this: any) {
                        this.parent.localizedText.text = this.text.trim();
                    },
                },
            },
        },
    };

    const enumValueType_parser = {
        EnumValueType: {
            init(this: any) {
                this.enumValueType = new EnumValueType({
                    description: undefined,
                    displayName: undefined,
                    value: [0, 0], // Int64
                });
            },
            parser: {
                Value: {
                    finish(this: any) {
                        // Low part
                        this.parent.enumValueType.value[1] = parseInt(this.text, 10);
                    },
                },

                DisplayName: _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish(this: any) {
                        this.parent.enumValueType.displayName = _.clone(this.localizedText);
                    },
                }),

                Description: _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish(this: any) {
                        this.parent.enumValueType.description = _.clone(this.localizedText);
                    },
                }),
            },
            finish(this: any) {
                this.enumValueType = new EnumValueType(this.enumValueType);
            },
        },
    };

    const argument_parser = {
        Argument: {
            init(this: any) {
                this.argument = new Argument({});
            },
            parser: {
                Name: {
                    finish(this: any) {
                        this.parent.argument.name = this.text.trim();
                    },
                },

                DataType: {
                    parser: {
                        Identifier: {
                            finish(this: any) {
                                this.parent.parent.argument.dataType = _translateNodeId(
                                    resolveNodeId(this.text.trim()).toString()
                                );
                            },
                        },
                    },
                },
                ValueRank: {
                    finish(this: any) {
                        this.parent.argument.valueRank = parseInt(this.text.trim(), 10);
                    },
                },

                ArrayDimensions: {
                    finish(this: any) {
                        // xx  this.parent.argument.arrayDimensions =[];
                    },
                },
                Description: {
                    init(this: any) {
                        this._text = "";
                        this.locale = null;
                        this.text = null;
                    },
                    parser: {
                        Locale: {
                            init(this: any) {
                                this.text = "";
                            },
                            finish(this: any) {
                                this.parent.locale = this.text.trim();
                            },
                        },
                        Text: {
                            finish(this: any) {
                                this.text = this.text || "";
                                this.parent._text = this.text.trim();
                            },
                        },
                    },
                    finish(this: any) {
                        this.parent.argument.description = coerceLocalizedText(this._text);
                    },
                },
            },
            finish(this: any) {
                // xx this.argument = new Argument(this.argument);
            },
        },
    };

    const Range_parser = {
        Range: {
            init(this: any) {
                this.range = new Range({});
            },
            parser: {
                Low: {
                    finish(this: any) {
                        this.parent.range.low = parseFloat(this.text);
                    },
                },

                High: {
                    finish(this: any) {
                        this.parent.range.high = parseFloat(this.text);
                    },
                },
            },
        },
    };

    const EUInformation_parser = {
        EUInformation: {
            init(this: any) {
                this.euInformation = new EUInformation({});
            },
            parser: {
                NamespaceUri: {
                    finish(this: any) {
                        this.parent.euInformation.namespaceUri = this.text;
                    },
                },
                UnitId: {
                    finish(this: any) {
                        this.parent.euInformation.unitId = parseInt(this.text, 10);
                    },
                },

                DisplayName: _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish(this: any) {
                        this.parent.euInformation.displayName = _.clone(this.localizedText);
                    },
                }),

                Description: _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish(this: any) {
                        this.parent.euInformation.description = _.clone(this.localizedText);
                    },
                }),
            },
            finish(this: any) {
                this.euInformation = new EUInformation(this.euInformation);
            },
        },
    };

    const _extensionObject_inner_parser = {
        TypeId: {
            parser: {
                Identifier: {
                    finish(this: any) {
                        const typeDefinitionId = this.text.trim();
                        const self = this.parent.parent; // ExtensionObject
                        self.typeDefinitionId = resolveNodeId(typeDefinitionId);
                    },
                },
            },
        },

        Body2: new FragmentClonerParser(),

        Body: {
            parser: {
                Argument: argument_parser.Argument,
                EUInformation: EUInformation_parser.EUInformation,
                EnumValueType: enumValueType_parser.EnumValueType,
                Range: Range_parser.Range,
            },
            startElement(this: any, elementName: string, attrs: any) {
                const self = this.parent; // ExtensionObject
                self.extensionObject = null;
                self.extensionObjectPojo = null;

                if (!this.parser.hasOwnProperty(elementName)) {
                    // treat it as a opaque XML bloc for the time being
                    // until we find the definition of this object, so we know how to interpret the fields
                    this._cloneFragment = new InternalFragmentClonerReaderState();
                    this.engine!._promote(this._cloneFragment, this.engine!.currentLevel, elementName, attrs);
                }
            },
            finish(this: any) {
                const self = this.parent; // ExtensionObject

                // typeDefinitionId is also the "Default XML" encoding nodeId !
                switch (self.typeDefinitionId.toString()) {
                    case "i=7616": // EnumValueType
                    case "ns=0;i=7616": // EnumValueType
                        self.extensionObject = self.parser.Body.parser.EnumValueType.enumValueType;
                        assert(_.isObject(self.extensionObject));
                        assert(self.extensionObject instanceof ExtensionObject);
                        break;
                    case "i=297": // Arguments
                    case "ns=0;i=297": // Arguments
                        self.extensionObject = self.parser.Body.parser.Argument.argument;
                        assert(_.isObject(self.extensionObject));
                        assert(self.extensionObject instanceof ExtensionObject);
                        break;
                    case "i=888":
                    case "ns=0;i=888": // EUInformation
                        self.extensionObject = self.parser.Body.parser.EUInformation.euInformation;
                        assert(_.isObject(self.extensionObject));
                        assert(self.extensionObject instanceof ExtensionObject);
                        break;
                    case "i=885": // Range
                    case "ns=0;i=885":
                        self.extensionObject = self.parser.Body.parser.Range.range;
                        assert(_.isObject(self.extensionObject));
                        assert(self.extensionObject instanceof ExtensionObject);
                        break;
                    default: {
                        this.bodyXML = this._cloneFragment!.value;
                        this._cloneFragment!.value = null;

                        // the "Default Xml" encoding  nodeId
                        const xmlEncodingNodeId = _translateNodeId(self.typeDefinitionId.toString());
                        const xmlBody = this.bodyXML;
                        // this is a user defined Extension Object
                        debugLog(
                            "load nodeset2: typeDefinitionId in ExtensionObject Default XML = " +
                                xmlEncodingNodeId.toString()
                        );
                        if (doDebug) {
                            debugLog("xxxx ", chalk.yellow(xmlBody));
                        }
                        const postTaskData = self.postTaskData;
                        const task = async (addressSpace2: AddressSpace) => {
                            const extensionObject: ExtensionObject | null = await decodeXmlObject(
                                addressSpace2,
                                xmlEncodingNodeId,
                                xmlBody
                            );
                            if (postTaskData) {
                                postTaskData.postponedExtensionObject = extensionObject;
                            }
                        };
                        postTasks2.push(task);
                        self.extensionObjectPojo = null;
                        assert(!self.extensionObject || self.extensionObject instanceof ExtensionObject);
                        break;
                    }
                }
            },
        },
    };

    const extensionObject_parser = {
        ExtensionObject: {
            init(this: any) {
                this.typeDefinitionId = "";
                this.extensionObject = null;
                this.extensionObjectPojo = null;
            },
            parser: _extensionObject_inner_parser,
            finish(this: any) {
                /* empty */
            },
        },
    };

    function BasicType_parser(dataType: string, parseFunc: (this: any, text: string) => any): ParserLike {
        const _parser: ParserLike = {};

        const r: ReaderStateParserLike = {
            init(this: any, name: string, attrs: XmlAttributes) {
                this.value = 0;
            },

            finish(this: any) {
                this.value = parseFunc.call(this, this.text);
            },
        };
        _parser[dataType] = r;
        return _parser;
    }

    function ListOf(dataType: string, parseFunc: any) {
        return {
            init(this: any) {
                this.listData = [];
            },

            parser: BasicType_parser(dataType, parseFunc),

            finish(this: any) {
                this.parent.parent.obj.value = {
                    arrayType: VariantArrayType.Array,
                    dataType: (DataType as any)[dataType],
                    value: this.listData,
                };
            },
            endElement(this: any, element: string) {
                this.listData.push(this.parser[dataType].value);
            },
        };
    }

    function parser2(type: string, p: (a: any) => any): any {
        return {
            finish(this: any) {
                this.parent.parent.obj.value = {
                    dataType: (DataType as any)[type],
                    value: p(this.text),
                };
            },
        };
    }
    const state_Variant = {
        init: () => {
            /* empty */
        },
        parser: {
            LocalizedText: _.extend(_.clone(localizedText_parser.LocalizedText), {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.LocalizedText,
                        value: this.localizedText,
                    };
                },
            }),

            String: {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.String,
                        value: this.text,
                    };
                },
            },

            Guid: {
                parser: {
                    String: {
                        finish(this: any) {
                            const guid = this.text;
                            if (!isValidGuid(guid)) {
                                /* ?*/
                            }
                            this.parent.parent.parent.obj.value = {
                                dataType: DataType.Guid,
                                value: this.text,
                            };
                        },
                    },
                },
            },

            Boolean: parser2("Boolean", ec.coerceBoolean),
            Int8: parser2("Int8", parseInt),
            Byte: parser2("Byte", parseInt),
            SByte: parser2("SByte", parseInt),
            Int16: parser2("Int16", parseInt),
            Int32: parser2("Int32", parseInt),
            UInt8: parser2("UInt8", parseInt),
            UInt16: parser2("UInt16", parseInt),
            UInt32: parser2("UInt32", parseInt),

            ByteString: {
                init(this: any) {
                    this.value = null;
                },
                finish(this: any) {
                    const base64text = this.text;
                    const byteString = Buffer.from(base64text, "base64");
                    this.parent.parent.obj.value = {
                        arrayType: VariantArrayType.Scalar,
                        dataType: DataType.ByteString,
                        value: byteString,
                    };
                },
            },
            Float: {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.Float,
                        value: parseFloat(this.text),
                    };
                },
            },

            Double: {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.Double,
                        value: parseFloat(this.text),
                    };
                },
            },

            ListOfExtensionObject: {
                init(this: any) {
                    this.listData = [];
                },
                parser: extensionObject_parser,
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.ExtensionObject,
                        value: this.listData,
                    };
                },
                startElement(this: any, elementName: string) {
                    /* empty */
                },
                endElement(this: any, elementName: string) {
                    this.listData.push(this.parser.ExtensionObject.extensionObject);

                    if (this.parser.ExtensionObject.extensionObject) {
                        // assert(element === "ExtensionObject");

                        // istanbul ignore next
                        if (!(this.parser.ExtensionObject.extensionObject instanceof ExtensionObject)) {
                            throw new Error("expecting an extension object");
                        }
                    }
                },
            },

            ListOfLocalizedText: {
                init(this: any) {
                    this.listData = [];
                },
                parser: localizedText_parser,
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.LocalizedText,
                        value: this.listData,
                    };
                },
                endElement(this: any /*element*/) {
                    this.listData.push(this.parser.LocalizedText.localizedText);
                },
            },

            ListOfBoolean: ListOf("Boolean", ec.coerceBoolean),
            ListOfByte: ListOf("Byte", parseInt),

            ListOfDouble: ListOf("Double", parseFloat),

            ListOfFloat: ListOf("Float", parseFloat),

            ListOfInt32: ListOf("Int32", parseInt),

            ListOfInt16: ListOf("Int16", parseInt),

            ListOfInt8: ListOf("Int8", parseInt),

            ListOfUInt32: ListOf("UInt32", parseInt),

            ListOfUInt16: ListOf("UInt16", parseInt),

            ListOfUInt8: ListOf("UInt8", parseInt),

            ListOfString: ListOf("String", (value: string) => value),

            ExtensionObject: {
                init(this: any) {
                    this.typeDefinitionId = {};
                    this.extensionObject = null;
                    this.postTaskData = {};
                },
                parser: _extensionObject_inner_parser,
                finish(this: any) {
                    // istanbul ignore next
                    if (this.extensionObject && !(this.extensionObject instanceof ExtensionObject)) {
                        throw new Error("expecting an extension object");
                    }

                    this.parent.parent.obj.value = {
                        dataType: DataType.ExtensionObject,
                        value: this.extensionObject,
                    };

                    // let's create the mechanism that postpone the creation of the
                    // extension object
                    const data = this.postTaskData;
                    data.variant = this.parent.parent.obj.value;
                    if (!data.variant) {
                        data.nodeId = this.parent.parent.obj.nodeId;
                        this.postTaskData = null;
                        const task = async (addressSpace2: AddressSpace) => {
                            data.variant.value = data.postponedExtensionObject;
                            assert(data.nodeId, "expecting a nodeid");
                            const node = addressSpace2.findNode(data.nodeId)!;
                            if (node.nodeClass === NodeClass.Variable) {
                                const v = node as UAVariable;
                                v.setValueFromSource(data.variant);
                            }
                            if (node.nodeClass === NodeClass.VariableType) {
                                const v = node as UAVariableType;
                                v.value.value = data.variant.value;
                            }
                        };
                        postTasks3.push(task);
                    }
                },
            },
        },
    };

    const state_UAVariable = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};

            this.obj.nodeClass = NodeClass.Variable;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.parentNodeId = convertToNodeId(attrs.ParentNodeId);
            this.obj.dataType = convertToNodeId(attrs.DataType);

            this.obj.valueRank = attrs.ValueRank === undefined ? -1 : ec.coerceInt32(attrs.ValueRank);
            this.obj.arrayDimensions = this.obj.valueRank === -1 ? null : stringToUInt32Array(attrs.ArrayDimensions);

            this.obj.minimumSamplingInterval = attrs.MinimumSamplingInterval
                ? parseInt(attrs.MinimumSamplingInterval, 10)
                : 0;
            this.obj.minimumSamplingInterval = parseInt(this.obj.minimumSamplingInterval, 10);

            this.obj.historizing = false;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;

            this.obj.accessLevel = convertAccessLevel(attrs.AccessLevel);
            this.obj.userAccessLevel = this.obj.accessLevel; // convertAccessLevel(attrs.UserAccessLevel || attrs.AccessLevel);
        },
        finish(this: any) {
            /*
            // set default value based on obj data Type
            if (this.obj.value === undefined) {
                const dataTypeNode = this.obj.dataType;
                const valueRank = this.obj.valueRank;
                this.obj.value = makeDefaultVariant(addressSpace, dataTypeNode, valueRank);
            }
            */
            let variable: UAVariable;
            if (this.obj.value) {
                const capturedValue = this.obj.value;
                const task = async (addressSpace2: AddressSpace) => {
                    if (false && doDebug) {
                        debugLog(
                            "1 setting value to ",
                            variable.nodeId.toString(),
                            new Variant(capturedValue).toString()
                        );
                    }
                    variable.setValueFromSource(capturedValue);
                };
                postTaskInitializeVariable.push(task);
            } else {
                const task = async (addressSpace2: AddressSpace) => {
                    const dataTypeNode = variable.dataType;
                    const valueRank = variable.valueRank;
                    const value = makeDefaultVariant(addressSpace, dataTypeNode, valueRank);
                    if (value) {
                        if (false && doDebug) {
                            debugLog("2 setting value to ", variable.nodeId.toString(), value);
                        }
                        variable.setValueFromSource(value);
                    }
                };
                postTaskInitializeVariable.push(task);
            }
            this.obj.value = undefined;
            variable = _internal_createNode(this.obj) as UAVariable;
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                },
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                },
            },
            References: references_parser,

            Value: state_Variant,
        },
    };

    const state_UAVariableType = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);

            this.obj.nodeClass = NodeClass.VariableType;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.parentNodeId = attrs.ParentNodeId || null;
            this.obj.dataType = convertToNodeId(attrs.DataType) || null;

            this.obj.valueRank = ec.coerceInt32(attrs.ValueRank) || -1;
            this.obj.arrayDimensions = this.obj.valueRank === -1 ? null : stringToUInt32Array(attrs.ArrayDimensions);

            this.obj.minimumSamplingInterval = attrs.MinimumSamplingInterval
                ? parseInt(attrs.MinimumSamplingInterval, 10)
                : 0;

            this.obj.historizing = false;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
        },
        finish(this: any) {
            try {
                _internal_createNode(this.obj);
            } /* istanbul ignore next */ catch (err) {
                this.obj.addressSpace = null;
                // tslint:disable:no-console
                console.warn(" Cannot create object", JSON.stringify(this.obj, null, " "));
                throw err;
            }
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                },
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                },
            },
            References: references_parser,
            Value: state_Variant,
        },
    };

    const state_UAMethod = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.Method;
            // MethodDeclarationId
            // ParentNodeId
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.parentNodeId = attrs.ParentNodeId || null;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.methodDeclarationId = attrs.MethodDeclarationId ? resolveNodeId(attrs.MethodDeclarationId) : null;
        },
        finish(this: any) {
            _internal_createNode(this.obj);
        },
        parser: {
            DisplayName: {
                finish(this: any) {
                    this.parent.obj.displayName = this.text;
                },
            },
            References: references_parser,
        },
    };

    const state_ModelTableEntry = new ReaderState({
        // ModelTableEntry

        init(this: any) {
            this._requiredModels = [];
        },
        parser: {
            // xx  "RequiredModel":  null
        },
        finish(this: any) {
            const modelUri = this.attrs.ModelUri; // //"http://opcfoundation.org/UA/"
            const version = this.attrs.Version; // 1.04
            const publicationDate = this.attrs.PublicationDate; // "2018-05-15T00:00:00Z" "
            // optional,
            const symbolicName = this.attrs.SymbolicName;
            const accessRestrictions = this.attrs.AccessRestrictions;

            const namespace = _register_namespace_uri_model({
                accessRestrictions,
                modelUri,
                publicationDate,
                requiredModels: this._requiredModels,
                symbolicName,
                version,
            });
            this._requiredModels.push(namespace);
        },
    });
    // state_ModelTableEntry.parser["RequiredModel"] = state_ModelTableEntry;

    const state_0: ReaderStateParserLike = {
        parser: {
            Aliases: { parser: { Alias: state_Alias } },

            NamespaceUris: {
                init(this: any) {
                    //
                },
                parser: {
                    Uri: {
                        finish(this: any) {
                            _register_namespace_uri(this.text);
                        },
                    },
                },
            },

            Models: {
                // ModelTable
                init(this: any) {
                    //
                },
                parser: {
                    Model: state_ModelTableEntry,
                },

                finish(this: any) {
                    //
                },
            },

            UADataType: state_UADataType,
            UAMethod: state_UAMethod,
            UAObject: state_UAObject,
            UAObjectType: state_UAObjectType,
            UAReferenceType: state_UAReferenceType,
            UAVariable: state_UAVariable,
            UAVariableType: state_UAVariableType,
        },
    };

    if (!_.isArray(xmlFiles)) {
        xmlFiles = [xmlFiles];
    }
    const parser = new Xml2Json(state_0);

    addressSpace1.suspendBackReference = true;

    async.mapSeries(
        xmlFiles,
        (xmlFile: string, callback1: (err?: Error) => void) => {
            // istanbul ignore next
            if (!fs.existsSync(xmlFile)) {
                throw new Error("generateAddressSpace : cannot file nodeset2 xml file at " + xmlFile);
            }

            debugLog(" parsing ", xmlFile);
            _reset_namespace_translation();
            parser.parse(xmlFile, callback1);
        },
        (err?: Error | null) => {
            make_back_references(addressSpace1);

            // setting up Server_NamespaceArray

            if (addressSpace.rootFolder?.objects?.server?.namespaceArray) {
                addressSpace.rootFolder.objects.server.namespaceArray.setValueFromSource({
                    arrayType: VariantArrayType.Array,
                    dataType: DataType.String,
                    value: addressSpace1.getNamespaceArray().map((ns) => ns.namespaceUri),
                });
                // istanbul ignore next
                if (doDebug) {
                    debugLog(
                        "addressSpace NS = ",
                        addressSpace.rootFolder.objects.server.namespaceArray.readValue().value.value.join(" ")
                    );
                }
            }
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
                        console.log(" performPostLoadingTasks Err  => ", err.message, "\n", err);
                        await task(addressSpace1);
                    }
                }
            }
            async function finalSteps(): Promise<void> {
                /// ----------------------------------------------------------------------------------------
                // perform post task
                debugLog(
                    chalk.bgGreenBright("Performing post loading tasks -------------------------------------------")
                );
                await performPostLoadingTasks(postTasks);
                postTasks = [];

                debugLog(
                    chalk.bgGreenBright("Performing DataType extraction -------------------------------------------")
                );
                assert(!addressSpace1.suspendBackReference);
                await ensureDatatypeExtracted(addressSpace);

                /// ----------------------------------------------------------------------------------------
                debugLog(chalk.bgGreenBright("DataType extraction done ") + chalk.green("DONE"), err?.message);

                for (const { name, dataTypeNodeId } of pendingSimpleTypeToRegister) {
                    if (dataTypeNodeId.namespace === 0) {
                        continue;
                    }
                    const dataTypeManager = (addressSpace as AddressSpacePrivate).getDataTypeManager();
                    const dataTypeFactory = dataTypeManager.getDataTypeFactoryForNamespace(dataTypeNodeId.namespace);
                }
                pendingSimpleTypeToRegister.splice(0);

                debugLog(
                    chalk.bgGreenBright("Performing post loading tasks 2 (parsing XML objects) ---------------------")
                );
                await performPostLoadingTasks(postTasks2);
                postTasks2 = [];

                debugLog(chalk.bgGreenBright("Performing post variable initialization ---------------------"));
                await performPostLoadingTasks(postTaskInitializeVariable);
                postTaskInitializeVariable = [];

                debugLog(
                    chalk.bgGreenBright(
                        "Performing post loading tasks 3 (assigning Extension Object to Variables) ---------------------"
                    )
                );
                await performPostLoadingTasks(postTasks3);
                postTasks3 = [];
            }
            callbackify(finalSteps)((err1?: Error) => {
                if (err1) {
                    console.log("Error ", pe.render(err1));
                }
                callback!(err1 || undefined);
            });
        }
    );
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
(module.exports as any).generateAddressSpace = thenify.withCallback((module.exports as any).generateAddressSpace);
