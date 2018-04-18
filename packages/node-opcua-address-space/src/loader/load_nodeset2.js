"use strict";
const assert = require("node-opcua-assert").assert;
const _ = require("underscore");
const async = require("async");
const fs = require("fs");


const Xml2Json = require("node-opcua-xml2json").Xml2Json;
const NodeClass = require("node-opcua-data-model").NodeClass;
const resolveNodeId = require("node-opcua-nodeid").resolveNodeId;

const DataType = require("node-opcua-variant").DataType;
const VariantArrayType = require("node-opcua-variant").VariantArrayType;
const Argument = require("node-opcua-service-call").Argument;

const coerceLocalizedText = require("node-opcua-data-model").coerceLocalizedText;
const EnumValueType = require("node-opcua-data-model").EnumValueType;

const ec = require("node-opcua-basic-types");

const AddressSpace = require("../address_space").AddressSpace;

const EUInformation = require("node-opcua-data-access").EUInformation;

/**
 * @method make_back_references
 * @param addressSpace  {AddressSpace}
 */
function make_back_references(addressSpace) {

    addressSpace.suspendBackReference = false;

    _.forEach(addressSpace._nodeid_index, function (node) {
        node.propagate_back_references();
    });
    _.forEach(addressSpace._nodeid_index, function (node) {
        node.install_extra_properties();
    });
}

function stringToUInt32Array(str) {
    const array = str ? str.split(",").map(function (value) {
        return parseInt(value);
    }) : null;
    return array;
}

const makeAccessLevel = require("node-opcua-data-model").makeAccessLevel;

function convertAccessLevel(accessLevel) {

    accessLevel = parseInt(accessLevel || 1); // CurrentRead if not specified

    return makeAccessLevel(accessLevel);

}

/**
 * @module opcua.address_space
 * @method generate_address_space
 * @param addressSpace
 * @param xmlFiles {String|String<>}
 * @param callback {Function}
 * @param callback.err {null|Error}
 * @async
 */
function generate_address_space(addressSpace, xmlFiles, callback) {

    function add_alias(alias_name, nodeId) {
        nodeId = resolveNodeId(nodeId);
        addressSpace.add_alias(alias_name, nodeId);
    }

    let namespace_uri_translation = {};
    let namespaceCounter = 0;

    function _reset_namespace_translation() {
        namespace_uri_translation = {};
        namespaceCounter = 0;
    }

    function _translateNamespaceIndex(innerIndex) {
        const namespaceIndex = namespace_uri_translation[innerIndex];
        if (namespaceIndex === undefined) {
            throw new Error("_translateNamespaceIndex! Cannot find namespace definition for index " + innerIndex);
        }
        return namespaceIndex;
    }

    function _register_namespace_uri(namespace_uri) {
        const index_in_xml = namespaceCounter + 1;
        namespaceCounter += 1;
        const index = addressSpace.registerNamespace(namespace_uri);
        namespace_uri_translation[index_in_xml] = index;
    }

    /*=
     * convert a nodedId
     *
     * @method convertToNodeId
     * @param nodeId {String|null}
     * @return {NodeId}
     *
     * @example:
     *    convertToNodeId("String") => resolve alias
     *    convertToNodeId("i=58")   => resolve to nodeId in namespace 0
     *    convertToNodeId("ns=1;i=100") => convert namespace from xml namespace table to corresponding namespace in addressapce
     */
    const reg = /ns=([0-9]+);(.*)/;

    function _translateNodeId(nodeId) {
        assert(typeof nodeId === "string");
        const m = nodeId.match(reg);
        if (m) {
            const namespaceIndex = _translateNamespaceIndex(parseInt(m[1]));
            nodeId = "ns=" + namespaceIndex + ";" + m[2];
        }
        return nodeId;
    }

    function _translateReferenceType(refType) {
        return _translateNodeId(refType).toString();
    }

    function convertToNodeId(nodeId) {
        if (!nodeId) {
            return null;
        }
        nodeId = _translateNodeId(nodeId);
        return addressSpace.resolveNodeId(nodeId);
    }

    function convertQualifiedName(qualifiedName) {
        const stringToQualifiedName = require("node-opcua-data-model").stringToQualifiedName;
        const qn = stringToQualifiedName(qualifiedName);
        if (qn.namespaceIndex > 0) {
            qn.namespaceIndex = _translateNamespaceIndex(qn.namespaceIndex);
        }
        return qn;
    }

    assert(addressSpace instanceof AddressSpace);
    assert(_.isFunction(callback)); // expecting a callback

    const state_Alias = {
        finish: function () {
            add_alias(this.attrs.Alias, _translateNodeId(this.text));
        }
    };

    const references_parser = {
        init: function () {
            this.parent.obj.references = [];
            this.array = this.parent.obj.references;
        },
        parser: {
            "Reference": {
                finish: function () {
                    this.parent.array.push({
                        referenceType: _translateReferenceType(this.attrs.ReferenceType),
                        isForward: (this.attrs.IsForward === undefined) ? true : (this.attrs.IsForward === "false" ? false : true),
                        nodeId: convertToNodeId(this.text)
                    });
                }
            }
        }
    };

    //<Definition Name="SomeName">
    //   <Field Name="Running" Value="0" dataType: [ValueRank="1"]>
    //      [<Description>text</Description>]
    //   <Field>
    //</Definition>
    const definition_parser = {
        init: function (name, attrs) {
            this.parent.obj.definition = [];
            this.parent.obj.definition_name = attrs.Name;
            this.array = this.parent.obj.definition;
        },
        parser: {
            "Field": {
                init: function () {
                    this.description = undefined;

                },
                parser: {
                    "Description": {
                        finish: function () {
                            this.parent.description = this.text;
                        }
                    }
                },
                finish: function () {
                    this.parent.array.push({
                        name: this.attrs.Name,
                        value: this.attrs.Value,
                        dataType: convertToNodeId(this.attrs.DataType),
                        valueRank: parseInt(this.attrs.ValueRank || "-1"),
                        description: this.description
                    });
                }
            }
        }
    };

    const state_UAObject = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.Object;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.eventNotifier = ec.coerceByte(attrs.EventNotifier) || 0;
            this.obj.symbolicName = attrs.SymbolicName || null;

        },
        finish: function () {
            //xx console.log("xxxx add object ".red,this.obj.nodeId.toString().yellow , this.obj.browseName);
            addressSpace._createNode(this.obj);
        },
        parser: {
            "DisplayName": {
                finish: function () {
                    this.parent.obj.displayName = this.text;
                }
            },
            "Description": {
                finish: function () {
                    this.parent.obj.description = this.text;
                }
            },

            "References": references_parser
        }
    };

    const state_UAObjectType = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.ObjectType;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.eventNotifier = ec.coerceByte(attrs.EventNotifier) || 0;
        },
        finish: function () {
            addressSpace._createNode(this.obj);
        },
        parser: {
            "DisplayName": {
                finish: function () {
                    this.parent.obj.displayName = this.text;
                }
            },
            "Description": {
                finish: function () {
                    this.parent.obj.description = this.text;
                }
            },

            "References": references_parser
        }
    };

    const state_UAReferenceType = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.ReferenceType;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
        },
        finish: function () {
            addressSpace.addReferenceType(this.obj, false);
        },
        parser: {
            "DisplayName": {
                finish: function () {
                    this.parent.obj.displayName = this.text;
                }
            },
            "Description": {
                finish: function () {
                    this.parent.obj.description = this.text;
                }
            },
            "InverseName": {
                finish: function () {
                    this.parent.obj.inverseName = this.text;
                }
            },
            "References": references_parser
        }
    };

    const state_UADataType = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.DataType;
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.displayName = "";
            this.obj.description = "";
        },
        finish: function () {
            addressSpace._createNode(this.obj);
            assert(addressSpace.findNode(this.obj.nodeId));
        },
        parser: {
            "DisplayName": {
                finish: function () {
                    this.parent.obj.displayName = this.text;
                }
            },
            "Description": {
                finish: function () {
                    this.parent.obj.description = this.text;
                }
            },
            "References": references_parser,
            "Definition": definition_parser
        }
    };

    const localizedText_parser = {
        "LocalizedText": {
            init: function () {
                this.localizedText = {};
            },
            parser: {
                "Locale": {
                    finish: function () {
                        this.parent.localizedText.locale = this.text.trim();
                    }
                },
                "Text": {
                    finish: function () {
                        this.parent.localizedText.text = this.text.trim();
                    }
                }
            }
        }
    };

    const enumValueType_parser = {
        "EnumValueType": {
            init: function () {
                this.enumValueType = {
                    value: 0,
                    displayName: null,
                    description: null
                };
            },
            parser: {
                "Value": {
                    finish: function () {
                        this.parent.enumValueType.value = parseInt(this.text);
                    }
                },
                "DisplayName": _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish: function () {
                        this.parent.enumValueType.displayName = _.clone(this.localizedText);
                    }
                }),
                "Description": _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish: function () {
                        this.parent.enumValueType.description = _.clone(this.localizedText);
                    }
                })
            },
            finish: function () {
                this.enumValueType = new EnumValueType(this.enumValueType);
            }
        }
    };

    const argument_parser = {
        "Argument": {
            init: function () {
                this.argument = {};
            },
            parser: {
                "Name": {
                    finish: function () {
                        this.parent.argument.name = this.text.trim();
                    }
                },
                "DataType": {
                    parser: {
                        "Identifier": {
                            finish: function () {
                                this.parent.parent.argument.dataType = resolveNodeId(this.text.trim());
                            }
                        }
                    }
                },
                "ValueRank": {
                    finish: function () {
                        this.parent.argument.valueRank = parseInt(this.text.trim());
                    }
                },
                "ArrayDimensions": {

                    finish: function () {
                        //xx  this.parent.argument.arrayDimensions =[];
                    }
                },
                "Description": {
                    init: function () {
                        this._text = "";
                        this.locale = null;
                        this.text = null;
                    },
                    parser: {
                        "Locale": {
                            init: function () {
                                this.text = "";
                            },
                            finish: function () {
                                this.parent.locale = this.text.trim();
                            }
                        },
                        "Text": {
                            finish: function () {
                                this.text = this.text || "";
                                this.parent._text = this.text.trim();
                            }
                        }
                    },
                    finish: function () {
                        this.parent.argument.description = coerceLocalizedText(this._text);
                    }
                }
            },
            finish: function () {
                this.argument = new Argument(this.argument);
            }
        }
    };

    const EUInformation_parser = {
        "EUInformation": {
            init: function () {
                this.euInformation = {};
            },
            parser: {
                "NamespaceUri": {
                    finish: function () {
                        this.parent.euInformation.namespaceUri = this.text;
                    }
                },
                "UnitId": {
                    finish: function () {
                        this.parent.euInformation.unitId = parseInt(this.text);
                    }
                },
                "DisplayName": _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish: function () {
                        this.parent.euInformation.displayName = _.clone(this.localizedText);
                    }
                }),
                "Description": _.extend(_.clone(localizedText_parser.LocalizedText), {
                    finish: function () {
                        this.parent.euInformation.description = _.clone(this.localizedText);
                    }
                })
            },
            finish: function () {
                this.euInformation = new EUInformation(this.euInformation);
            }
        }
    };

    const _extensionObject_inner_parser = {
        "TypeId": {
            parser: {
                "Identifier": {
                    finish: function () {

                        const typeId = this.text.trim();
                        this.parent.parent.typeId = resolveNodeId(typeId);

                        switch (typeId) {
                            case "i=297":  // Argument
                                break;
                            case "i=7616": // EnumValueType
                                break;
                            case "i=888":  // EUInformation
                                break;
                            default:
                                //xx console.warn("loadnodeset2 ( checking identifier type) : unsupported typeId in ExtensionObject " + typeId);
                                break;
                        }
                    }
                }
            }
        },
        "Body": {
            parser: {
                "Argument": argument_parser.Argument,
                "EnumValueType": enumValueType_parser.EnumValueType,
                "EUInformation": EUInformation_parser.EUInformation
            },
            finish: function () {
                const self = this.parent;
                switch (self.typeId.toString()) {
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
                    default:

                        // to do: implement a post action to create and bind extension object
                        console.log("loadnodeset2: unsupported typeId in ExtensionObject " + self.typeId);
                        break;
                }
            }
        }
    };

    const extensionObject_parser = {
        "ExtensionObject": {
            init: function () {
                this.typeId = {};
                this.extensionObject = null;
            },
            parser: _extensionObject_inner_parser
        }
    };

    function BasicType_parser(dataType, parseFunc) {
        const parser = {};
        parser[dataType] = {
            init: function () {
                this.value = 0;
            },
            finish: function () {
                this.value = parseFunc(this.text);
            }
        };
        return parser;
    }

    function ListOf(dataType, parseFunc) {
        return {
            init: function () {
                this.listData = [];
            },

            parser: BasicType_parser(dataType, parseFunc),

            finish: function () {
                this.parent.parent.obj.value = {
                    dataType: DataType[dataType],
                    arrayType: VariantArrayType.Array,
                    value: this.listData
                };
            },
            endElement: function (element) {
                this.listData.push(this.parser[dataType].value);
            }
        };
    }

    const state_Variant = {
        parser: {
            "String": {
                finish: function () {
                    this.parent.parent.obj.value = {
                        dataType: DataType.String,
                        value: this.text
                    };
                }
            },
            "Boolean": {
                finish: function () {
                    this.parent.parent.obj.value = {
                        dataType: DataType.Boolean,
                        value: this.text.toLowerCase() === "true" ? true : false
                    };
                }
            },
            "ByteString": {
                init: function () {
                    this.value = null;
                },
                finish: function () {
                    const base64text = this.text;
                    const byteString = Buffer.from(base64text, "base64");
                    this.parent.parent.obj.value = {
                        dataType: DataType.ByteString,
                        arrayType: VariantArrayType.Scalar,
                        value: byteString
                    };
                }
            },
            "Float": {
                finish: function() {
                    this.parent.parent.obj.value = {
                        dataType: DataType.Float,
                        value: parseFloat(this.text)
                    }
                }
            },
            "Double": {
                finish: function() {
                    this.parent.parent.obj.value = {
                        dataType: DataType.Double,
                        value: parseFloat(this.text)
                    }
                }
            },
            "ListOfLocalizedText": {
                init: function () {
                    this.listData = [];
                },
                parser: localizedText_parser,
                finish: function () {
                    this.parent.parent.obj.value = {
                        dataType: DataType.LocalizedText,
                        arrayType: VariantArrayType.Array,
                        value: this.listData

                    };
                },
                endElement: function (/*element*/) {
                    this.listData.push(this.parser.LocalizedText.localizedText);
                }
            },
            "ListOfDouble": ListOf("Double", parseFloat),
            "ListOfFloat": ListOf("Float", parseFloat),
            "ListOfInt32": ListOf("Int32", parseInt),
            "ListOfInt16": ListOf("Int16", parseInt),
            "ListOfInt8": ListOf("Int8", parseInt),
            "ListOfUint32": ListOf("Uint32", parseInt),
            "ListOfUint16": ListOf("Uint16", parseInt),
            "ListOfUint8": ListOf("Uint8", parseInt),
            "ListOfExtensionObject": {
                init: function () {
                    this.listData = [];
                },
                parser: extensionObject_parser,
                finish: function () {
                    this.parent.parent.obj.value = {
                        dataType: DataType.ExtensionObject,
                        arrayType: VariantArrayType.Array,
                        value: this.listData
                    };

                },
                endElement: function (element) {
                    if (this.parser.ExtensionObject.extensionObject) {
                        //assert(element === "ExtensionObject");
                        this.listData.push(this.parser.ExtensionObject.extensionObject);
                    }
                }

            },
            "ExtensionObject": {
                init: function () {
                    this.typeId = {};
                    this.extensionObject = null;
                },
                parser: _extensionObject_inner_parser,
                finish: function () {
                    this.parent.parent.obj.value = {
                        dataType: DataType.ExtensionObject,
                        value: this.extensionObject
                    };
                }
            }
        }
    };

    const state_UAVariable = {
        init: function (name, attrs) {
            this.obj = {};

            this.obj.nodeClass = NodeClass.Variable;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.parentNodeId = convertToNodeId(attrs.ParentNodeId);
            this.obj.dataType = convertToNodeId(attrs.DataType);

            this.obj.valueRank = ec.coerceInt32(attrs.ValueRank) || -1;
            this.obj.arrayDimensions = this.obj.valueRank === -1 ? null : stringToUInt32Array(attrs.ArrayDimensions);

            this.obj.minimumSamplingInterval = attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval) : 0;
            this.obj.minimumSamplingInterval = parseInt(this.obj.minimumSamplingInterval);


            this.obj.historizing = false;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;

            this.obj.accessLevel = convertAccessLevel(attrs.AccessLevel);
            this.obj.userAccessLevel = convertAccessLevel(attrs.UserAccessLevel);
        },
        finish: function () {
            addressSpace._createNode(this.obj);
        },
        parser: {
            "DisplayName": {
                finish: function () {
                    this.parent.obj.displayName = this.text;
                }
            },
            "Description": {
                finish: function () {
                    this.parent.obj.description = this.text;
                }
            },
            "References": references_parser,
            "Value": state_Variant
        }
    };

    const state_UAVariableType = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);

            this.obj.nodeClass = NodeClass.VariableType;
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.parentNodeId = attrs.ParentNodeId || null;
            this.obj.dataType = convertToNodeId(attrs.DataType) || null;

            this.obj.valueRank = ec.coerceInt32(attrs.ValueRank) || -1;
            this.obj.arrayDimensions = this.obj.valueRank === -1 ? null : stringToUInt32Array(attrs.ArrayDimensions);

            this.obj.minimumSamplingInterval = attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval) : 0;

            this.obj.historizing = false;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
        },
        finish: function () {
            try {
                addressSpace._createNode(this.obj);
            }
            catch (err) {
                this.obj.addressSpace = null;
                console.warn(" Cannot create object", JSON.stringify(this.obj, null, " "));
                throw err;
            }
        },
        parser: {
            "DisplayName": {
                finish: function () {
                    this.parent.obj.displayName = this.text;
                }
            },
            "Description": {
                finish: function () {
                    this.parent.obj.description = this.text;
                }
            },
            "References": references_parser,
            "Value": state_Variant
        }
    };

    const state_UAMethod = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.Method;
            // MethodDeclarationId
            // ParentNodeId
            this.obj.browseName = convertQualifiedName(attrs.BrowseName);
            this.obj.parentNodeId = attrs.ParentNodeId || null;
            this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
            this.obj.methodDeclarationId = attrs.MethodDeclarationId ? resolveNodeId(attrs.MethodDeclarationId) : null;

        },
        finish: function () {
            addressSpace._createNode(this.obj);
        },
        parser: {
            "DisplayName": {
                finish: function () {
                    this.parent.obj.displayName = this.text;
                }
            },
            "References": references_parser
        }
    };

    const state_0 = {
        parser: {
            "NamespaceUris": {
                init: function () {
                },
                parser: {
                    "Uri": {
                        finish: function () {
                            _register_namespace_uri(this.text);
                        }
                    }
                }
            },
            "Aliases": {parser: {"Alias": state_Alias}},
            "UAObject": state_UAObject,
            "UAObjectType": state_UAObjectType,
            "UAReferenceType": state_UAReferenceType,
            "UADataType": state_UADataType,
            "UAVariable": state_UAVariable,
            "UAVariableType": state_UAVariableType,
            "UAMethod": state_UAMethod
        }
    };

    if (!_.isArray(xmlFiles)) {
        xmlFiles = [xmlFiles];
    }
    const parser = new Xml2Json(state_0);

    addressSpace.suspendBackReference = true;

    async.mapSeries(xmlFiles, function (xmlFile, callback) {
        if (!fs.existsSync(xmlFile)) {
            throw new Error("generate_address_space : cannot file nodeset2 xml file at " + xmlFile);
        }
        _reset_namespace_translation();
        parser.parse(xmlFile, callback);
    }, function () {
        make_back_references(addressSpace);
        assert(!addressSpace.suspendBackReference);
        callback.apply(this, arguments);
    });

}

exports.generate_address_space = generate_address_space;
