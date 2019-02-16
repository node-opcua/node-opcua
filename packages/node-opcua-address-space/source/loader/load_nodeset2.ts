/**
 * @module node-opcua-address-space
 */
import * as async from "async";
import * as fs from "fs";
import * as _ from "underscore";

import { assert } from "node-opcua-assert";
import * as ec from "node-opcua-basic-types";
import { EnumValueType } from "node-opcua-common";
import { EUInformation } from "node-opcua-data-access";
import { AccessLevelFlag, NodeClass, QualifiedName } from "node-opcua-data-model";
import { makeAccessLevelFlag } from "node-opcua-data-model";
import { stringToQualifiedName } from "node-opcua-data-model";
import { coerceLocalizedText } from "node-opcua-data-model";
import { make_debugLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";
import { resolveNodeId } from "node-opcua-nodeid";
import { Argument } from "node-opcua-service-call";
import { DataType } from "node-opcua-variant";
import { VariantArrayType } from "node-opcua-variant";
import {
    Parser,
    ParserLike,
    ReaderState,
    ReaderStateParser,
    ReaderStateParserLike,
    Xml2Json,
    XmlAttributes
} from "node-opcua-xml2json";

import {
    AddReferenceTypeOptions,
    AddressSpace as AddressSpacePublic,
    CreateNodeOptions
} from "../../source";

import { AddressSpace } from "../../src/address_space";
import { BaseNode } from "../../src/base_node";
import { NamespacePrivate } from "../../src/namespace_private";

const debugLog = make_debugLog(__filename);

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

export function generateAddressSpace(
  addressSpace: AddressSpacePublic ,
  xmlFiles: string | string[],
  callback: (err?: Error) => void
): void;
export function generateAddressSpace(
  addressSpace: AddressSpacePublic ,
  xmlFiles: string | string[],
): Promise<void>;
export function generateAddressSpace(
  addressSpace: AddressSpacePublic ,
  xmlFiles: string | string[],
  callback?: (err?: Error) => void
): any {

    const addressSpace1 = addressSpace as AddressSpace;

    let alias_map: { [key: string]: NodeId } = {};

    /**
     *
     * @param alias_name {string}
     * @param nodeId
     */
    function addAlias(alias_name: string, nodeIdinXmlContext: string) {
        assert(typeof nodeIdinXmlContext === "string");
        const nodeId = _translateNodeId(nodeIdinXmlContext);
        assert(nodeId instanceof NodeId);
        alias_map[alias_name] = nodeId;
        addressSpace1.getNamespace(nodeId.namespace).addAlias(alias_name, nodeId);
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
        if (namespaceIndex === undefined) {
            throw new Error("_translateNamespaceIndex! Cannot find namespace definition for index " + innerIndex);
        }
        return namespaceIndex;
    }

    function _internal_addReferenceType(params: AddReferenceTypeOptions) {

        if (!(params.nodeId instanceof NodeId)) {
            throw new Error("invalid param");
        } // already translated
        const namespace = addressSpace1.getNamespace(params.nodeId!.namespace);
        namespace.addReferenceType(params);
    }

    function _internal_createNode(params: CreateNodeOptions): BaseNode {
        if (!(params.nodeId instanceof NodeId)) {
            throw new Error("invalid param");
        } // already translated

        // sconsole.log(params.browseName,params.nodeId.toString());

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

        debugLog(" _register_namespace_uri = ", namespaceUri,
          "index in Xml=", index_in_xml,
          " index in addressSpace", namespace.index);
        return namespace;
    }

    function _register_namespace_uri_model(model: any) {
        const namespace = _register_namespace_uri(model.modelUri);
        namespace.version = model.version;
        namespace.publicationDate = model.publicationDate;
        return namespace;
    }

    /**
     * convert a nodedId
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
    const reg = /ns=([0-9]+);(.*)/;

    function _translateNodeId(nodeId: string): NodeId {
        assert(typeof nodeId === "string");
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
                        isForward: (this.attrs.IsForward === undefined)
                          ? true
                          : (this.attrs.IsForward === "false" ? false : true),
                        nodeId: convertToNodeId(this.text),
                        referenceType: _translateReferenceType(this.attrs.ReferenceType)
                    });
                }
            }
        }
    };

    // <Definition Name="SomeName">
    //   <Field Name="Running" Value="0" dataType: [ValueRank="1"]>
    //      [<Description>text</Description>]
    //   <Field>
    // </Definition>
    const definition_parser = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.parent.obj.definition = [];
            this.parent.obj.definition_name = attrs.Name;
            this.array = this.parent.obj.definition;
        },
        parser: {
            Field: {
                init(this: any) {
                    this.description = undefined;
                },
                parser: {
                    Description: {
                        finish(this: any) {
                            this.parent.description = this.text;
                        }
                    }
                },
                finish(this: any) {
                    this.parent.array.push({
                        dataType: convertToNodeId(this.attrs.DataType),
                        description: this.description,
                        name: this.attrs.Name,
                        value: this.attrs.Value,
                        valueRank: parseInt(this.attrs.ValueRank || "-1", 10)
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

    const state_UADataType = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.DataType;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.displayName = "";
            this.obj.description = "";
        },
        finish(this: any) {
            _internal_createNode(this.obj);
            assert(addressSpace1.findNode(this.obj.nodeId));
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

            Definition: definition_parser
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

    const enumValueType_parser = {
        EnumValueType: {
            init(this: any) {
                this.enumValueType = {
                    description: null,
                    displayName: null,
                    value: 0
                };
            },
            parser: {
                Value: {
                    finish(this: any) {
                        this.parent.enumValueType.value = parseInt(this.text, 10);
                    }
                },

                DisplayName: _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish(this: any) {
                        this.parent.enumValueType.displayName = _.clone(this.localizedText);
                    }
                }),

                Description: _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish(this: any) {
                        this.parent.enumValueType.description = _.clone(this.localizedText);
                    }
                })
            },
            finish(this: any) {
                this.enumValueType = new EnumValueType(this.enumValueType);
            }
        }
    };

    const argument_parser = {
        Argument: {
            init(this: any) {
                this.argument = {};
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
                                this.parent.parent.argument.dataType = resolveNodeId(this.text.trim());
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
                this.argument = new Argument(this.argument);
            }
        }
    };

    const Range_parser = {
        Range: {
            init(this: any) {
                this.range = {};
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
                this.euInformation = {};
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

                DisplayName: _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish(this: any) {
                        this.parent.euInformation.displayName = _.clone(this.localizedText);
                    }
                }),

                Description: _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish(this: any) {
                        this.parent.euInformation.description = _.clone(this.localizedText);
                    }
                })
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
                    finish(this: any) {

                        const typeDefinitionId = this.text.trim();
                        // xx console.log("typeDefinitionId = ",typeDefinitionId);
                        this.parent.parent.typeDefinitionId = resolveNodeId(typeDefinitionId);

                        switch (typeDefinitionId) {
                            case "i=297":  // Argument
                            case "ns=0;i=297":  // Argument
                                break;
                            case "ns=0;i=7616": // EnumValueType
                            case "i=7616": // EnumValueType
                                break;
                            case "ns=0;i=888": // EnumValueType
                            case "i=888":  // EUInformation
                                break;
                            case "ns=0;i=885":  // Range
                            case "i=885":  // Range
                                break;
                            default:
                                // tslint:disable:no-console
                                // tslint:disable:max-line-length
                                console.warn("loadnodeset2 ( checking identifier type) : unsupported typeDefinitionId in ExtensionObject " + typeDefinitionId);
                                break;
                        }
                    }
                }
            }
        },

        Body: {
            parser: {
                Argument: argument_parser.Argument,
                EUInformation: EUInformation_parser.EUInformation,
                EnumValueType: enumValueType_parser.EnumValueType,
                Range: Range_parser.Range
            },
            finish(this: any) {
                const self = this.parent;
                switch (self.typeDefinitionId.toString()) {
                    case "ns=0;i=7616": // EnumValueType
                        self.extensionObject = self.parser.Body.parser.EnumValueType.enumValueType;
                        assert(_.isObject(self.extensionObject));
                        break;
                    case "ns=0;i=297": // Arguments
                        self.extensionObject = self.parser.Body.parser.Argument.argument;
                        assert(_.isObject(self.extensionObject));
                        break;
                    case "i=888":
                    case "ns=0;i=888": // EUInformation
                        self.extensionObject = self.parser.Body.parser.EUInformation.euInformation;
                        assert(_.isObject(self.extensionObject));
                        break;
                    case "i=885":      // Range
                    case "ns=0;i=885":
                        self.extensionObject = self.parser.Body.parser.Range.range;
                        assert(_.isObject(self.extensionObject));
                        break;
                    default:
                        // to do: implement a post action to create and bind extension object
                        console.log("loadnodeset2: unsupported typeDefinitionId in ExtensionObject " + self.typeDefinitionId.toString());
                        break;
                }
            }
        }
    };

    const extensionObject_parser = {
        ExtensionObject: {
            init(this: any) {
                this.typeDefinitionId = {};
                this.extensionObject = null;
            },
            parser: _extensionObject_inner_parser
        }
    };

    function BasicType_parser(
      dataType: string,
      parseFunc: (this: any, text: string) => any
    ): ParserLike {

        const _parser: ParserLike = {};

        const r: ReaderStateParserLike = {

            init(name: string, attrs: XmlAttributes) {
                this.value = 0;
            },

            finish() {
                this.value = parseFunc.call(this, this.text);
            }
        };
        _parser[dataType] = r;
        return _parser;
    }

    function ListOf(
      dataType: string,
      parseFunc: any
    ) {
        return {
            init(this: any) {
                this.listData = [];
            },

            parser: BasicType_parser(dataType, parseFunc),

            finish(this: any) {
                this.parent.parent.obj.value = {
                    arrayType: VariantArrayType.Array,
                    dataType: (DataType as any)[dataType],
                    value: this.listData
                };
            },
            endElement(this: any, element: any) {
                this.listData.push(this.parser[dataType].value);
            }
        };
    }

    const state_Variant = {
        parser: {
            String: {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.String,
                        value: this.text
                    };
                }
            },

            Boolean: {
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.Boolean,
                        value: this.text.toLowerCase() === "true" ? true : false
                    };
                }
            },
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
                init(this: any) {
                    this.listData = [];
                },
                parser: extensionObject_parser,
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.ExtensionObject,
                        value: this.listData
                    };

                },
                endElement(this: any /*,element*/) {
                    if (this.parser.ExtensionObject.extensionObject) {
                        // assert(element === "ExtensionObject");
                        this.listData.push(this.parser.ExtensionObject.extensionObject);
                    }
                }

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
                        value: this.listData
                    };
                },
                endElement(this: any/*element*/) {
                    this.listData.push(this.parser.LocalizedText.localizedText);
                }
            },

            ListOfDouble: ListOf("Double", parseFloat),

            ListOfFloat: ListOf("Float", parseFloat),

            ListOfInt32: ListOf("Int32", parseInt),

            ListOfInt16: ListOf("Int16", parseInt),

            ListOfInt8: ListOf("Int8", parseInt),

            ListOfUint32: ListOf("Uint32", parseInt),

            ListOfUint16: ListOf("Uint16", parseInt),

            ListOfUint8: ListOf("Uint8", parseInt),

            ExtensionObject: {
                init(this: any) {
                    this.typeDefinitionId = {};
                    this.extensionObject = null;
                },
                parser: _extensionObject_inner_parser,
                finish(this: any) {
                    this.parent.parent.obj.value = {
                        dataType: DataType.ExtensionObject,
                        value: this.extensionObject
                    };
                }
            }
        }
    };

    const state_UAVariable = {
        init(this: any, name: string, attrs: XmlAttributes) {
            this.obj = {};

            this.obj.nodeClass = NodeClass.Variable;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.parentNodeId = convertToNodeId(attrs.ParentNodeId);
            this.obj.dataType = convertToNodeId(attrs.DataType);

            this.obj.valueRank = ec.coerceInt32(attrs.ValueRank) || -1;
            this.obj.arrayDimensions = this.obj.valueRank === -1 ? null : stringToUInt32Array(attrs.ArrayDimensions);

            this.obj.minimumSamplingInterval =
              attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval, 10) : 0;
            this.obj.minimumSamplingInterval = parseInt(this.obj.minimumSamplingInterval, 10);

            this.obj.historizing = false;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;

            this.obj.accessLevel = convertAccessLevel(attrs.AccessLevel);
            this.obj.userAccessLevel = convertAccessLevel(attrs.UserAccessLevel);
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
            this.obj.arrayDimensions = this.obj.valueRank === -1 ? null : stringToUInt32Array(attrs.ArrayDimensions);

            this.obj.minimumSamplingInterval =
              attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval, 10) : 0;

            this.obj.historizing = false;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
        },
        finish(this: any) {
            try {
                _internal_createNode(this.obj);
            } catch (err) {
                this.obj.addressSpace = null;
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
            this.obj.methodDeclarationId = attrs.MethodDeclarationId ? resolveNodeId(attrs.MethodDeclarationId) : null;

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
            References: references_parser
        }
    };

    const state_ModelTableEntry = new ReaderState({ // ModelTableEntry

        init(this: any) {
            this._requiredModels = [];
        },
        parser: {
            // xx  "RequiredModel":  null
        },
        finish(this: any) {

            const modelUri = this.attrs.ModelUri; // //"http://opcfoundation.org/UA/"
            const version = this.attrs.Version;   // 1.04
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
                version
            });
            this._requiredModels.push(namespace);
        }
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
                        }
                    }
                }
            },

            Models: { // ModelTable
                init(this: any) {
                    //
                },
                parser: {
                    Model: state_ModelTableEntry
                },

                finish(this: any) {
                    //
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

    if (!_.isArray(xmlFiles)) {
        xmlFiles = [xmlFiles];
    }
    const parser = new Xml2Json(state_0);

    addressSpace1.suspendBackReference = true;

    async.mapSeries(xmlFiles, (xmlFile: string, callback1: (err?: Error) => void) => {
        if (!fs.existsSync(xmlFile)) {
            throw new Error("generateAddressSpace : cannot file nodeset2 xml file at " + xmlFile);
        }
        debugLog(" parsing ", xmlFile);
        _reset_namespace_translation();
        parser.parse(xmlFile, callback1);
    }, (err?: Error | null) => {
        make_back_references(addressSpace1);
        assert(!addressSpace1.suspendBackReference);
        callback!(err || undefined);
    });
}

// tslint:disable:no-var-requires
// tslint:disable:max-line-length
const thenify = require("thenify");
(module.exports as any).generateAddressSpace = thenify.withCallback((module.exports as any).generateAddressSpace );
