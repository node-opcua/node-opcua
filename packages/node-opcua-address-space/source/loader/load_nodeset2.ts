/* eslint-disable max-statements */
/**
 * @module node-opcua-address-space
 */
import { promisify } from "util";
import * as chalk from "chalk";

import * as ec from "node-opcua-basic-types";
import {
    AddReferenceTypeOptions,
    BaseNode,
    CreateNodeOptions,
    IAddressSpace,
    INamespace,
    UADataType,
    UAVariable,
    UAVariableType
} from "node-opcua-address-space-base";
import { assert, renderError } from "node-opcua-assert";
import { coerceInt64, coerceUInt64, Int64, isValidGuid, StatusCodes, UInt64 } from "node-opcua-basic-types";
import { EUInformation } from "node-opcua-data-access";
import {
    AccessLevelFlag,
    coerceLocalizedText,
    LocalizedTextOptions,
    makeAccessLevelFlag,
    NodeClass,
    QualifiedName,
    QualifiedNameOptions,
    stringToQualifiedName
} from "node-opcua-data-model";
import { checkDebugFlag, make_debugLog, make_errorLog } from "node-opcua-debug";
import { ExtensionObject } from "node-opcua-extension-object";
import { getBuiltInType } from "node-opcua-factory";
import { NodeId, NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { Argument } from "node-opcua-service-call";
import { ErrorCallback } from "node-opcua-status-code";
import { EnumFieldOptions, EnumValueType, Range, StructureFieldOptions } from "node-opcua-types";
import { DataType, Variant, VariantArrayType, VariantOptions } from "node-opcua-variant";
import {
    _definitionParser,
    FragmentClonerParser,
    InternalFragmentClonerReaderState,
    ParserLike,
    ReaderState,
    ReaderStateParserLike,
    Xml2Json,
    XmlAttributes,
    SimpleCallback
} from "node-opcua-xml2json";
import * as semver from "semver";

import { AddressSpacePrivate } from "../../src/address_space_private";
import { NamespacePrivate } from "../../src/namespace_private";
import { promoteObjectsAndVariables } from "./namespace_post_step";
import { ensureDatatypeExtracted } from "./ensure_datatype_extracted";
import { decodeXmlExtensionObject } from "./decode_xml_extension_object";
import { makeSemverCompatible } from "./make_semver_compatible";

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

function makeDefaultVariant(addressSpace: IAddressSpace, dataTypeNode: NodeId, valueRank: number): VariantOptions | undefined {
    let variant: VariantOptions = { dataType: DataType.Null };

    const nodeDataType = addressSpace.findNode(dataTypeNode) as UADataType;
    if (nodeDataType) {
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
                variant = { dataType: basicDataType, value: [], arrayType, dimensions: [] };
                break;
        }
    }
    return variant;
}
export interface NodeSet2ParserEngine {
    addNodeSet: (xmlData: string, callback1: SimpleCallback) => void;
    terminate: (callback: SimpleCallback) => void;
}

export function makeNodeSetParserEngine(addressSpace: IAddressSpace): NodeSet2ParserEngine {
    const addressSpace1 = addressSpace as AddressSpacePrivate;
    addressSpace1.suspendBackReference = true;

    const postTasks: Task[] = [];
    const postTasks0_DecodePojoString: Task[] = [];
    const postTasks1_InitializeVariable: Task[] = [];
    const postTasks2_AssignedExtensionObjectToDataValue: Task[] = [];

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
    let models: Model[] = [];

    function _reset_namespace_translation() {
        debugLog("_reset_namespace_translation");
        namespace_uri_translation = {};
        found_namespace_in_uri = {};
        namespaceCounter = 0;
        alias_map = {};
        models = [];
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
        return namespace.internalCreateNode(params) as BaseNode;
    }

    function _register_namespace_uri_in_translation_table(namespaceUri: string): NamespacePrivate {
        if (found_namespace_in_uri[namespaceUri]) {
            return found_namespace_in_uri[namespaceUri];
        }
        const namespace = addressSpace1.getNamespace(namespaceUri);
        if (!namespace) {
            throw new Error(
                "cannot find namespace for " +
                    namespaceUri +
                    "\nplease make sure to initialize your address space with the corresponding nodeset files"
            );
        }
        found_namespace_in_uri[namespaceUri] = namespace;

        const index_in_xml = namespaceCounter;
        namespaceCounter++;
        namespace_uri_translation[index_in_xml] = namespace.index;

        doDebug &&
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

    function _add_namespace(model: Model) {
        if (model.requiredModels.length > 0) {
            // check that required models exist already in the address space
            for (const requiredModel of model.requiredModels) {
                const existingNamespace = addressSpace1.getNamespace(requiredModel.modelUri);
                if (!existingNamespace) {
                    errorLog(
                        "Please ensure that the required namespace ",
                        requiredModel.modelUri,
                        "is loaded firs when loading ",
                        model.modelUri
                    );
                    throw new Error("LoadNodeSet : Cannot find namespace for " + requiredModel.modelUri);
                }
                /**
                 *  from https://reference.opcfoundation.org/Core/docs/Part6/F.2/
                 *  The version of the model defined in the UANodeSet.
                 *  This is a human readable string and not intended for programmatic comparisons.
                 *
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
                        " with publicationDatea at least ",
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
            // special treatment for namespace 0
            if (model.modelUri === "http://opcfoundation.org/UA/") {
                namespace = existingNamespace;
            } else {
                throw new Error(" namespace already registered " + model.modelUri);
            }
        } else {
            namespace = addressSpace1.registerNamespace(model.modelUri);
        }

        namespace.version = model.version;
        namespace.publicationDate = model.publicationDate || namespace.publicationDate;
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

    const state_UAObject = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.Object;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.eventNotifier = ec.coerceByte(attrs.EventNotifier) || 0;
            this.obj.symbolicName = attrs.SymbolicName || null;

            this.isDraft = attrs.ReleaseStatus === "Draft";
            this.obj.isDeprecated = attrs.ReleaseStatus === "Deprecated";
        },
        finish(this: any) {
            if (this.isDraft || this.isDeprecated) {
                // ignore Draft or Deprecated element
                debugLog("Ignoring Draft/Deprecated UAObject =", this.obj.browseName.toString());
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
            this.isDeprecated = attrs.ReleaseStatus === "Deprecated";

            this.definitionFields = [];
        },
        finish(this: any) {
            if (this.isDraft || this.isDeprecated) {
                // ignore Draft or Deprecated element
                debugLog("Ignoring Draft/Deprecated dataType =", this.obj.browseName.toString());
                return;
            }
            /*
            export interface StructureFieldOptions {
                name?: UAString ; // **
                description?: (LocalizedTextLike | null); // **
                dataType?: (NodeIdLike | null);
                valueRank?: Int32 ;
                arrayDimensions?: UInt32 [] | null;
                maxStringLength?: UInt32 ;
                isOptional?: UABoolean ;
            }
            export interface EnumValueTypeOptions {
                value?: Int64 ;
                displayName?: (LocalizedTextLike | null);
                description?: (LocalizedTextLike | null); // **
            }
            export interface EnumFieldOptions extends EnumValueTypeOptions {
                name?: UAString ; // **
            }
            */

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

    const localizedText_parser = {
        LocalizedText: {
            init(this: any) {
                this.localizedText = {};
            },
            parser: {
                Locale: {
                    finish(this: any) {
                        this.parent.localizedText.locale = this.text.trim();
                    }
                },
                Text: {
                    finish(this: any) {
                        this.parent.localizedText.text = this.text.trim();
                    }
                }
            }
        }
    };
    interface QualifiedNameParserChild {
        parent: {
            qualifiedName: QualifiedNameOptions;
        };
        text: string;
    }
    const qualifiedName_parser = {
        QualifiedName: {
            init(this: any) {
                this.qualifiedName = {
                    namespaceIndex: 0,
                    name: null
                } as QualifiedNameOptions;
            },
            parser: {
                Name: {
                    finish(this: QualifiedNameParserChild) {
                        this.parent.qualifiedName.name = this.text.trim();
                    }
                },
                NamespaceIndex: {
                    finish(this: QualifiedNameParserChild) {
                        const ns = parseInt(this.text, 10);
                        const t = _translateNodeId(resolveNodeId(`ns=${ns};i=1`).toString());
                        this.parent.qualifiedName.namespaceIndex = t.namespace;
                    }
                }
            }
        }
    };
    const nodeId_parser = {
        NodeId: {
            init(this: any) {
                this.nodeId = "";
            },
            parser: {
                Identifier: {
                    finish(this: any) {
                        this.parent.nodeId = _translateNodeId(resolveNodeId(this.text.trim()).toString());
                    }
                }
            }
        }
    };
    const enumValueType_parser = {
        EnumValueType: {
            init(this: any) {
                this.enumValueType = new EnumValueType({
                    description: undefined,
                    displayName: undefined,
                    value: [0, 0] // Int64
                });
            },
            parser: {
                Value: {
                    finish(this: any) {
                        // Low part
                        this.parent.enumValueType.value[1] = parseInt(this.text, 10);
                    }
                },

                DisplayName: {
                    ...localizedText_parser.LocalizedText,
                    finish(this: any) {
                        this.parent.enumValueType.displayName = { ...this.localizedText };
                    }
                },

                Description: {
                    ...localizedText_parser.LocalizedText,
                    finish(this: any) {
                        this.parent.enumValueType.description = { ...this.localizedText };
                    }
                }
            },
            finish(this: any) {
                this.enumValueType = new EnumValueType(this.enumValueType);
            }
        }
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
                    }
                },

                DataType: {
                    parser: {
                        Identifier: {
                            finish(this: any) {
                                this.parent.parent.argument.dataType = _translateNodeId(resolveNodeId(this.text.trim()).toString());
                            }
                        }
                    }
                },
                ValueRank: {
                    finish(this: any) {
                        this.parent.argument.valueRank = parseInt(this.text.trim(), 10);
                    }
                },

                ArrayDimensions: {
                    finish(this: any) {
                        // xx  this.parent.argument.arrayDimensions =[];
                    }
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
                            }
                        },
                        Text: {
                            finish(this: any) {
                                this.text = this.text || "";
                                this.parent._text = this.text.trim();
                            }
                        }
                    },
                    finish(this: any) {
                        this.parent.argument.description = coerceLocalizedText(this._text);
                    }
                }
            },
            finish(this: any) {
                // xx this.argument = new Argument(this.argument);
            }
        }
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
                    }
                },

                High: {
                    finish(this: any) {
                        this.parent.range.high = parseFloat(this.text);
                    }
                }
            }
        }
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
                    }
                },
                UnitId: {
                    finish(this: any) {
                        this.parent.euInformation.unitId = parseInt(this.text, 10);
                    }
                },

                DisplayName: {
                    ...localizedText_parser.LocalizedText,
                    finish(this: any) {
                        this.parent.euInformation.displayName = { ...this.localizedText };
                    }
                },

                Description: {
                    ...localizedText_parser.LocalizedText,
                    finish(this: any) {
                        this.parent.euInformation.description = { ...this.localizedText };
                    }
                }
            },
            finish(this: any) {
                this.euInformation = new EUInformation(this.euInformation);
            }
        }
    };

    const _extensionObject_inner_parser = {
        TypeId: {
            parser: {
                Identifier: {
                    finish(this: ExtensionObjectTypeIdIdentifierParser) {
                        const typeDefinitionId = this.text.trim();
                        const self = this.parent.parent; // ExtensionObject
                        self.typeDefinitionId = resolveNodeId(typeDefinitionId);
                    }
                }
            }
        },

        Body2: new FragmentClonerParser(),

        Body: {
            parser: {
                Argument: argument_parser.Argument,
                EUInformation: EUInformation_parser.EUInformation,
                EnumValueType: enumValueType_parser.EnumValueType,
                Range: Range_parser.Range
            },
            startElement(this: ExtensionObjectBodyParser, elementName: string, attrs: any) {
                const self = this.parent; // ExtensionObject
                self.extensionObject = null;
                self.extensionObjectPojo = null;

                if (!Object.prototype.hasOwnProperty.call(this.parser, elementName)) {
                    // treat it as a opaque XML bloc for the time being
                    // until we find the definition of this object, so we know how to interpret the fields
                    this._cloneFragment = new InternalFragmentClonerReaderState();
                    this.engine!._promote(this._cloneFragment, this.engine!.currentLevel, elementName, attrs);
                }
            },
            finish(this: ExtensionObjectBodyParser) {
                const self = this.parent; // ExtensionObject

                // typeDefinitionId is also the "Default XML" encoding nodeId !
                switch (self.typeDefinitionId.toString()) {
                    case "i=7616": // EnumValueType
                    case "ns=0;i=7616": // EnumValueType
                        self.extensionObject = self.parser.Body.parser.EnumValueType.enumValueType;
                        assert(self.extensionObject !== null && typeof self.extensionObject === "object");
                        assert(self.extensionObject instanceof ExtensionObject);
                        break;
                    case "i=297": // Arguments
                    case "ns=0;i=297": // Arguments
                        self.extensionObject = self.parser.Body.parser.Argument.argument;
                        assert(self.extensionObject !== null && typeof self.extensionObject === "object");
                        assert(self.extensionObject instanceof ExtensionObject);
                        break;
                    case "i=888":
                    case "ns=0;i=888": // EUInformation
                        self.extensionObject = self.parser.Body.parser.EUInformation.euInformation;
                        assert(self.extensionObject !== null && typeof self.extensionObject === "object");
                        assert(self.extensionObject instanceof ExtensionObject);
                        break;
                    case "i=885": // Range
                    case "ns=0;i=885":
                        self.extensionObject = self.parser.Body.parser.Range.range;
                        assert(self.extensionObject !== null && typeof self.extensionObject === "object");
                        assert(self.extensionObject instanceof ExtensionObject);
                        break;
                    default: {
                        this.bodyXML = this._cloneFragment!.value;
                        this._cloneFragment!.value = null;

                        // the "Default Xml" encoding  nodeId
                        const xmlEncodingNodeId = _translateNodeId(self.typeDefinitionId.toString());

                        if (xmlEncodingNodeId.isEmpty()) {
                            debugLog("xmlEncodingNodeId is empty for " + self.typeDefinitionId.toString());
                            break;
                        }
                        let captureXmlBody = this.bodyXML;
                        if (doDebug) {
                            debugLog("xxxx ", chalk.yellow(captureXmlBody));
                        }
                        // this is a user defined Extension Object
                        debugLog(
                            "load nodeset2: typeDefinitionId in ExtensionObject Default XML = " + xmlEncodingNodeId.toString()
                        );

                        let captured = self.postTaskData;
                        self.extensionObjectPojo = null;
                        const task = async (addressSpace2: IAddressSpace) => {
                            const extensionObject: ExtensionObject | null = await decodeXmlExtensionObject(
                                addressSpace2,
                                xmlEncodingNodeId,
                                captureXmlBody
                            );
                            if (captured) {
                                captured.postponedExtensionObject = extensionObject;
                            }
                            (captureXmlBody as any) = undefined;
                            (captured as any) = undefined;
                        };
                        postTasks0_DecodePojoString.push(task);
                        assert(!self.extensionObject || self.extensionObject instanceof ExtensionObject);

                        break;
                    }
                }
            }
        }
    };

    const extensionObject_parser = {
        ExtensionObject: {
            init(this: ExtensionObjectParser) {
                this.typeDefinitionId = NodeId.nullNodeId;
                this.extensionObject = null;
                this.extensionObjectPojo = null;
                this.postTaskData = { postponedExtensionObject: null };
            },
            parser: _extensionObject_inner_parser,
            finish(this: ExtensionObjectParser) {
                /* empty */
            }
        }
    };

    function BasicType_parser<T>(dataType: string, parseFunc: (this: { value: T | undefined }, text: string) => any): ParserLike {
        const _parser: ParserLike = {};

        const r: ReaderStateParserLike = {
            init(this: { value: T | undefined }, name: string, attrs: XmlAttributes) {
                this.value = undefined;
            },

            finish(this: { value: T | undefined; text: string }) {
                this.value = parseFunc.call(this, this.text);
            }
        };
        _parser[dataType] = r;
        return _parser;
    }

    function ListOf<T>(dataType: string, parseFunc: any) {
        return {
            init(this: ListOfTParser<T>) {
                this.listData = [];
            },

            parser: BasicType_parser<T>(dataType, parseFunc),

            finish(this: ListOfTParser<T>) {
                this.parent.parent.obj.value = {
                    arrayType: VariantArrayType.Array,
                    dataType: (DataType as any)[dataType],
                    value: this.listData
                };
            },
            endElement(this: ListOfTParser<T>, element: string) {
                this.listData.push(this.parser[dataType].value);
            }
        };
    }

    function parser2(type: string, p: (a: any) => any): any {
        return {
            finish(this: any) {
                this.parent.parent.obj.value = {
                    arrayType: VariantArrayType.Scalar,
                    dataType: (DataType as any)[type],
                    value: p(this.text)
                };
            }
        };
    }

    interface PostExtensionObjectData {
        postponedExtensionObject: ExtensionObject | null;
        // variant: Variant;
        // nodeId: NodeId;
    }
    interface ExtensionObjectParser {
        parent: any;
        typeDefinitionId: NodeId;
        extensionObject: ExtensionObject | null;
        extensionObjectPojo: any | null;
        postTaskData?: PostExtensionObjectData;
        parser: {
            Body: ExtensionObjectBodyParser;
        };
    }

    interface ExtensionObjectTypeIdParser {
        parent: ExtensionObjectParser;
    }
    interface ExtensionObjectTypeIdIdentifierParser {
        text: string;
        parent: ExtensionObjectTypeIdParser;
    }

    interface ExtensionObjectBodyParser {
        parent: ExtensionObjectParser;
        _cloneFragment: InternalFragmentClonerReaderState;
        bodyXML: string;
        engine: any;
        NodeSet2ParserEngine: any;
        parser: any;
    }

    interface Parser {
        parent: Parser | any;
    }
    interface ListOfTParser<T> extends Parser {
        listData: T[];
        parent: Parser;
        parser: {
            [key: string]: Parser | any;
        };
    }

    interface ListOfExtensionObjectParser extends ListOfTParser<ExtensionObject> {
        listExtensionObject: (ExtensionObject | null)[];
        parser: {
            ExtensionObject: ExtensionObjectParser;
        };
    }

    const parseUInt64 = (str: string): UInt64 => coerceUInt64(str);
    const parseInt64 = (str: string): Int64 => coerceInt64(str);

    const state_Variant = {
        init: () => {
            /* empty */
        },
        parser: {
            QualifiedName: {
                ...qualifiedName_parser.QualifiedName,
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.QualifiedName,
                        value: this.qualifiedName
                    };
                }
            },
            LocalizedText: {
                ...localizedText_parser.LocalizedText,
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.LocalizedText,
                        value: this.localizedText
                    };
                }
            },
            XmlElement: {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.XmlElement,
                        value: this.text
                    };
                }
            },
            String: {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.String,
                        value: this.text
                    };
                }
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
                                arrayType: VariantArrayType.Scalar,
                                value: this.text
                            };
                        }
                    }
                }
            },

            NodeId: {
                parser: {
                    Identifier: {
                        finish(this: any) {
                            const nodeId = this.text;
                            this.parent.parent.parent.obj.value = {
                                dataType: DataType.NodeId,
                                arrayType: VariantArrayType.Scalar,
                                value: _translateNodeId(resolveNodeId(nodeId).toString())
                            };
                        }
                    }
                }
            },

            Boolean: parser2("Boolean", ec.coerceBoolean),
            Byte: parser2("Byte", parseInt),
            Int16: parser2("Int16", parseInt),
            Int32: parser2("Int32", parseInt),
            Int8: parser2("Int8", parseInt),
            SByte: parser2("SByte", parseInt),
            UInt16: parser2("UInt16", parseInt),
            UInt32: parser2("UInt32", parseInt),
            UInt8: parser2("UInt8", parseInt),

            UInt64: parser2("UInt64", parseUInt64),
            Int64: parser2("Int64", parseInt64),

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
                        value: byteString
                    };
                }
            },
            Float: {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.Float,
                        value: parseFloat(this.text)
                    };
                }
            },

            Double: {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.Double,
                        value: parseFloat(this.text)
                    };
                }
            },

            ListOfExtensionObject: {
                init(this: ListOfExtensionObjectParser) {
                    this.listExtensionObject = [];
                },
                parser: extensionObject_parser,
                finish(this: ListOfExtensionObjectParser) {
                    installExtensionObjectListInitializationPostTask(this);
                },
                startElement(this: ListOfExtensionObjectParser, elementName: string) {
                    /* empty */
                    const extensionObjectParser = this.parser.ExtensionObject;
                    extensionObjectParser.postTaskData = { postponedExtensionObject: null };
                },
                endElement(this: ListOfExtensionObjectParser, elementName: string) {
                    const extensionObjectParser = this.parser.ExtensionObject;

                    this.listExtensionObject.push(extensionObjectParser.extensionObject);
                    if (this.parser.ExtensionObject.extensionObject === null) {
                        // extension object creation will be postponed
                        const index = this.listExtensionObject.length - 1;
                        let capturedData = extensionObjectParser.postTaskData;

                        // istanbul ignore next
                        if (!capturedData) {
                            throw new Error("Internal Error : postponedExtensionObject not resolved");
                        }

                        let listExtensionObject = this.listExtensionObject;
                        const task = async (addressSpace2: IAddressSpace) => {
                            // istanbul ignore next
                            if (!capturedData!.postponedExtensionObject) {
                                throw new Error("Internal Error : postponedExtensionObject not resolved");
                            }
                            listExtensionObject[index] = capturedData!.postponedExtensionObject!;
                            capturedData = undefined;
                            (listExtensionObject as any) = undefined;
                        };
                        postTasks2_AssignedExtensionObjectToDataValue.push(task);
                    }
                }
            },

            ListOfLocalizedText: {
                init(this: ListOfTParser<LocalizedTextOptions>) {
                    this.listData = [];
                },
                parser: localizedText_parser,
                finish(this: ListOfTParser<QualifiedNameOptions>) {
                    this.parent.parent.obj.value = {
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.LocalizedText,
                        value: this.listData
                    };
                },
                endElement(this: ListOfTParser<QualifiedNameOptions> /*element*/) {
                    this.listData.push(this.parser.LocalizedText.localizedText);
                }
            },
            ListOfQualifiedName: {
                init(this: ListOfTParser<QualifiedNameOptions>) {
                    this.listData = [];
                },
                parser: qualifiedName_parser,
                finish(this: ListOfTParser<QualifiedNameOptions>) {
                    this.parent.parent.obj.value = {
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.QualifiedName,
                        value: this.listData
                    };
                },
                endElement(this: ListOfTParser<QualifiedNameOptions> /*element*/) {
                    this.listData.push(this.parser.QualifiedName.qualifiedName);
                }
            },
            ListOfNodeId: {
                init(this: ListOfTParser<NodeIdLike>) {
                    this.listData = [];
                },
                parser: nodeId_parser,
                finish(this: ListOfTParser<NodeIdLike>) {
                    this.parent.parent.obj.value = {
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.NodeId,
                        value: this.listData
                    };
                },
                endElement(this: ListOfTParser<NodeIdLike>, elementName: string) {
                    this.listData.push(this.parser.NodeId.nodeId);
                }
            },

            ListOfBoolean: ListOf<boolean>("Boolean", ec.coerceBoolean),

            ListOfByte: ListOf<number>("Byte", parseInt),

            ListOfDouble: ListOf<number>("Double", parseFloat),

            ListOfFloat: ListOf<number>("Float", parseFloat),

            ListOfInt32: ListOf<number>("Int32", parseInt),

            ListOfInt16: ListOf<number>("Int16", parseInt),

            ListOfInt8: ListOf<number>("Int8", parseInt),

            ListOfUInt32: ListOf<number>("UInt32", parseInt),

            ListOfUInt16: ListOf<number>("UInt16", parseInt),

            ListOfUInt8: ListOf<number>("UInt8", parseInt),

            ListOfString: ListOf<string>("String", (value: string) => value),

            ListOfXmlElement: ListOf<string>("XmlElement", (value: string) => value),

            ExtensionObject: {
                init(this: ExtensionObjectParser) {
                    this.typeDefinitionId = NodeId.nullNodeId;
                    this.extensionObject = null;
                    this.postTaskData = { postponedExtensionObject: null };
                },
                parser: _extensionObject_inner_parser,
                finish(this: ExtensionObjectParser) {
                    // istanbul ignore next
                    if (this.extensionObject && !(this.extensionObject instanceof ExtensionObject)) {
                        throw new Error("expecting an extension object");
                    }
                    this.parent.parent.obj.value = {
                        dataType: DataType.ExtensionObject,
                        value: this.extensionObject
                    };
                    if (!this.extensionObject) {
                        installExtensionObjectInitializationPostTask(this);
                    }
                }
            }
        }
    };

    function installExtensionObjectListInitializationPostTask(element: ListOfExtensionObjectParser) {
        let listExtensionObject = element.listExtensionObject;
        let nodeId = element.parent.parent.obj.nodeId;
        assert(nodeId, "expecting a nodeid");
        const task = async (addressSpace2: IAddressSpace) => {
            const node = addressSpace2.findNode(nodeId)!;
            if (!node) {
                debugLog("Cannot find node with nodeId " + nodeId + ". may be the node was marked as deprecated");
            } else if (node.nodeClass === NodeClass.Variable) {
                const v = node as UAVariable;
                v.setValueFromSource({
                    dataType: DataType.ExtensionObject,
                    value: listExtensionObject
                });
            } else if (node.nodeClass === NodeClass.VariableType) {
                const v = node as UAVariableType;
                (v as any) /*fix me*/.value.value = listExtensionObject;
            }
            listExtensionObject.slice(0);
            (listExtensionObject as any) = undefined;
            (nodeId as any) = undefined;
        };
        postTasks2_AssignedExtensionObjectToDataValue.push(task);
    }

    function installExtensionObjectInitializationPostTask(element: ExtensionObjectParser) {
        // let's create the mechanism that postpone the creation of the
        // extension object
        let data = element.postTaskData!;
        let variant = element.parent.parent.obj.value;
        let nodeId = element.parent.parent.obj.nodeId;
        const task = async (addressSpace2: IAddressSpace) => {
            variant.value = data.postponedExtensionObject;
            assert(nodeId, "expecting a nodeid");
            const node = addressSpace2.findNode(nodeId)!;
            if (node.nodeClass === NodeClass.Variable) {
                const v = node as UAVariable;
                v.setValueFromSource(variant);
            } else if (node.nodeClass === NodeClass.VariableType) {
                const v = node as UAVariableType;
                (v as any) /*fix me*/.value.value = variant.value;
            }

            data.postponedExtensionObject = null;
            (data as any) = undefined;
            (variant as any) = undefined;
            (nodeId as any) = undefined;
        };
        postTasks2_AssignedExtensionObjectToDataValue.push(task);
    }
    const state_UAVariable = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};

            this.obj.nodeClass = NodeClass.Variable;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.parentNodeId = convertToNodeId(attrs.ParentNodeId);
            this.obj.dataType = convertToNodeId(attrs.DataType);

            this.obj.valueRank = attrs.ValueRank === undefined ? -1 : ec.coerceInt32(attrs.ValueRank);
            this.obj.arrayDimensions = this.obj.valueRank <= 0 ? null : stringToUInt32Array(attrs.ArrayDimensions);

            this.obj.minimumSamplingInterval = attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval, 10) : 0;
            this.obj.minimumSamplingInterval = parseInt(this.obj.minimumSamplingInterval, 10);

            this.obj.historizing = false;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;

            this.obj.accessLevel = convertAccessLevel(attrs.AccessLevel);
            this.obj.userAccessLevel = this.obj.accessLevel; // convertAccessLevel(attrs.UserAccessLevel || attrs.AccessLevel);

            this.isDraft = attrs.ReleaseStatus === "Draft";
            this.isDeprecated = attrs.ReleaseStatus === "Deprecated";
        },
        finish(this: any) {
            if (this.isDraft || this.isDeprecated) {
                debugLog("Ignoring Draft/Deprecated UAVariable =", this.obj.browseName.toString());
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
            if (this.obj.value) {
                let capturedValue = this.obj.value;
                const task = async (addressSpace2: IAddressSpace) => {
                    if (false && doDebug) {
                        debugLog("1 setting value to ", capturedVariable.nodeId.toString(), new Variant(capturedValue).toString());
                    }
                    capturedVariable.setValueFromSource(capturedValue);
                    capturedValue = undefined;
                    (capturedVariable as any) = undefined;
                };
                postTasks1_InitializeVariable.push(task);
            } else {
                const task = async (addressSpace2: IAddressSpace) => {
                    const dataTypeNode = capturedVariable.dataType;
                    const valueRank = capturedVariable.valueRank;
                    const value = makeDefaultVariant(addressSpace, dataTypeNode, valueRank);
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
                postTasks1_InitializeVariable.push(task);
            }
            this.obj.value = undefined;
            capturedVariable = _internal_createNode(this.obj) as UAVariable;
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

            Value: state_Variant
        }
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
            this.obj.arrayDimensions = this.obj.valueRank <= 0 ? null : stringToUInt32Array(attrs.ArrayDimensions);

            this.obj.minimumSamplingInterval = attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval, 10) : 0;

            this.obj.historizing = false;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;

            this.isDraft = attrs.ReleaseStatus === "Draft";
            this.isDeprecated = attrs.ReleaseStatus === "Deprecated";
        },
        finish(this: any) {
            if (this.isDraft || this.isDeprecated) {
                debugLog("Ignoring Draft/Deprecated UAVariableType =", this.obj.browseName.toString());
                return;
            }
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
                }
            },

            Description: {
                finish(this: any) {
                    this.parent.obj.description = this.text;
                }
            },
            References: references_parser,
            Value: state_Variant
        }
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
            this.obj.methodDeclarationId = attrs.MethodDeclarationId ? _translateNodeId(attrs.MethodDeclarationId) : null;

            this.isDraft = attrs.ReleaseStatus === "Draft";
            this.isDeprecated = attrs.ReleaseStatus === "Deprecated";
        },
        finish(this: any) {
            if (this.isDraft || this.isDeprecated) {
                debugLog("Ignoring Draft/Deprecated UAMethod =", this.obj.browseName.toString());
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

    interface RequiredModel {
        modelUri: string;
        version: string;
        publicationDate: Date;
    }
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

    function _perform() {
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

        doDebug && debugLog("xxx models =", JSON.stringify(models, null, " "));
        doDebug && debugLog("xxx _namespaceUris =", _namespaceUris);
        _register_namespace_uri_in_translation_table("http://opcfoundation.org/UA/");
        for (const namespaceUri of _namespaceUris) {
            _register_namespace_uri_in_translation_table(namespaceUri);
        }
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

    function terminate(callback: SimpleCallback) {
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
                    if (err instanceof Error) {
                        console.log(" performPostLoadingTasks Err  => ", err.message, "\n", err);
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

            doDebug && debugLog(chalk.bgGreenBright("Performing post loading task: Initializing Variables ---------------------"));
            await performPostLoadingTasks(postTasks1_InitializeVariable);

            doDebug && debugLog(chalk.bgGreenBright("Performing post loading tasks: (assigning Extension Object to Variables) -"));
            await performPostLoadingTasks(postTasks2_AssignedExtensionObjectToDataValue);

            doDebug && debugLog(chalk.bgGreenBright("Performing post variable initialization ---------------------"));
            promoteObjectsAndVariables(addressSpace);
        }
        finalSteps()
            .then(() => callback!())
            .catch((err1: Error) => {
                console.log("Error ", renderError(err1));
                callback!(err1);
            });
    }
    function addNodeSet(xmlData: string, callback1: SimpleCallback) {
        _reset_namespace_translation();
        parser.parseString(xmlData, callback1);
    }

    return {
        addNodeSet,
        terminate
    };
}
export class NodeSetLoader {
    _s: any;
    constructor(addressSpace: IAddressSpace) {
        this._s = makeNodeSetParserEngine(addressSpace);
    }

    addNodeSet(xmlData: string, callback: ErrorCallback): void {
        if (!callback) {
            throw new Error("Expecting callback function");
        }
        return this._s.addNodeSet(xmlData, callback);
    }

    async addNodeSetAsync(xmlData: string): Promise<void> {
        return promisify(this.addNodeSet).call(this, xmlData);
    }

    terminate(callback: ErrorCallback): void {
        this._s.terminate(callback);
    }

    async terminateAsync(): Promise<void> {
        return promisify(this.terminate).call(this);
    }
}
