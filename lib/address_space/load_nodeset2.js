require("requirish")._(module);
var Xml2Json = require("lib/xml2json/lib").Xml2Json;
var NodeClass = require("lib/datamodel/nodeclass").NodeClass;
var resolveNodeId = require("lib/datamodel/nodeid").resolveNodeId;
var makeNodeId = require("lib/datamodel/nodeid").makeNodeId;
var AddressSpace = require("lib/address_space/address_space").AddressSpace;

var DataType = require("lib/datamodel/variant").DataType;
var VariantArrayType = require("lib/datamodel/variant").VariantArrayType;
var Variant = require("lib/datamodel/variant").Variant;
var Argument = require("_generated_/_auto_generated_Argument").Argument;

var assert = require("better-assert");
var _ = require("underscore");

var ec = require("lib/misc/encode_decode");
var async = require("async");


/**
 * @method make_back_references
 * @param address_space  {AddressSpace}
 */
function make_back_references(address_space) {
    _.forEach(address_space._nodeid_index, function (node) {
        node.propagate_back_references(address_space);
    });
    _.forEach(address_space._nodeid_index, function (node) {
        node.install_extra_properties();
    });
}

function stringToUInt32Array(str) {
    var array =str  ? str.split(",").map(function(value) { return parseInt(value);} ) : null;
    return  array;
}

function generate_address_space(address_space, xmlFiles, callback) {


    function add_alias(alias_name, nodeId) {
        nodeId = resolveNodeId(nodeId);
        address_space.add_alias(alias_name, nodeId);
    }

    function convertToNodeId(nodeId) {
        return address_space.resolveNodeId(nodeId);
    }

    assert(address_space instanceof AddressSpace);
    assert(_.isFunction(callback)); // expecting a callback

    var state_Alias = { finish: function () {
        add_alias(this.attrs["Alias"], this.text);
    } };

    var references_parser = {
        init: function () {
            this.parent.obj.references = [];
            this.array = this.parent.obj.references;
        },
        parser: {
            'Reference': {
                finish: function () {
                    this.parent.array.push({
                        referenceType: this.attrs["ReferenceType"],
                        isForward: (this.attrs["IsForward"] === undefined) ? true : (this.attrs["IsForward"] === "false" ? false : true),
                        nodeId: convertToNodeId(this.text)
                    });
                }
            }
        }
    };

    //<Definition Name="SomeName">
    //   <Field Name="Running" Value="0"/>
    //</Definition>
    var definition_parser = {
        init: function (name, attrs) {
            this.parent.obj.definition = [];
            this.parent.obj.definition_name = attrs["Name"];
            this.array = this.parent.obj.definition;
        },
        parser: {
            'Field': {
                finish: function () {
                    this.parent.array.push({
                        name: this.attrs["Name"],
                        value: this.attrs["Value"],
                        dataType: this.attrs["DataType"]
                    });
                }
            }
        }
    };

    var state_UAObject = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.Object;
            this.obj.isAbstract = ec.coerceBoolean(attrs["IsAbstract"]);
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.browseName = attrs["BrowseName"];
            this.obj.eventNotifier = ec.coerceByte(attrs["EventNotifier"]) || 0;
            this.obj.symbolicName = attrs["SymbolicName"] || null;


        },
        finish: function () {
            //xx console.log("xxxx add object ".red,this.obj.nodeId.toString().yellow , this.obj.browseName);
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function () {
                this.parent.obj.displayName = this.text;
            }},
            'Description': {finish: function () {
                this.parent.obj.description = this.text;
            }},

            'References': references_parser
        }
    };

    var state_UAObjectType = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.ObjectType;
            this.obj.isAbstract = ec.coerceBoolean(attrs["IsAbstract"]);
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.browseName = attrs["BrowseName"];
            this.obj.eventNotifier = ec.coerceByte(attrs["EventNotifier"]) || 0;
        },
        finish: function () {
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function () {
                this.parent.obj.displayName = this.text;
            }},
            'Description': {finish: function () {
                this.parent.obj.description = this.text;
            }},

            'References': references_parser
        }
    };

    var state_UAReferenceType = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.ReferenceType;
            this.obj.isAbstract = ec.coerceBoolean(attrs["IsAbstract"]);
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.browseName = attrs["BrowseName"];
        },
        finish: function () {
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function () {
                this.parent.obj.displayName = this.text;
            }},
            'Description': {finish: function () {
                this.parent.obj.description = this.text;
            }},
            'InverseName': {finish: function () {
                this.parent.obj.inverseName = this.text;
            }},
            'References': references_parser
        }
    };

    var state_UADataType = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.DataType;
            this.obj.isAbstract = ec.coerceBoolean(attrs["IsAbstract"]);
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.browseName = attrs["BrowseName"];
        },
        finish: function () {
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function () {
                this.parent.obj.displayName = this.text;
            }},
            'Description': {finish: function () {
                this.parent.obj.description = this.text;
            }},
            'References': references_parser,
            'Definition': definition_parser
        }
    };

    var localizedText_parser = {
        'LocalizedText': {
            init: function () {
                this.localizedText = {};
            },
            parser: {
                'Locale': {
                    finish: function () {
                        this.parent.localizedText.locale = this.text.trim();
                    }
                },
                'Text': {
                    finish: function () {
                        this.parent.localizedText.text = this.text.trim();
                    }
                }
            }
        }
    };

    var argument_parser = {
      'Argument': {
          init : function() {
              this.argument ={};
          },
          parser: {
              'Name' :  {
                  finish: function() {
                      this.parent.argument.name = this.text.trim();
                  }
              },
              'DataType': {
                    parser: {
                        'Identifier' : {
                            finish: function() {
                                this.parent.parent.argument.dataType = resolveNodeId(this.text.trim());
                            }
                        }
                    }
              },
              'ValueRank' : {
                  finish: function() {
                      this.parent.argument.valueRank = parseInt(this.text.trim());
                  }
              },
              'ArrayDimensions' : { finish: function() { } },
              'Description':      { finish: function() { } }
          },
          finish: function() {
              this.argument = new Argument(this.argument);
          }
      }
    };
    var extensionObject_parser = {
        'ExtensionObject': {
            init: function () {
                this.typeId = {};
                this.extensionObject = null;
            },
            parser: {
                'TypeId': {
                    parser: {
                        'Identifier' : {
                            finish: function () {

                                var typeId = this.text.trim();
                                this.parent.parent.typeId = resolveNodeId(typeId);

                                switch(typeId) {
                                    case 'i=297':
                                        break;
                                    case 'i=7616':
                                        break;
                                    default:
                                        //xx console.log("xxxx unsupported typeId in ExtensionObject " +  typeId);
                                        break;

                                }
                            }
                        }
                    }
                },
                'Body': {
                    parser: {
                        'Argument': argument_parser["Argument"]
                    },
                    finish: function () {
                        var self = this.parent;
                        switch(self.typeId.toString()) {
                            case 'ns=0;i=297':
                                self.extensionObject = self.parser.Body.parser['Argument'].argument;
                                assert(_.isObject(self.extensionObject));
                                break;
                            default:
                                //xx console.log("xxxxx unsupported typeId in ExtensionObject " +  self.typeId);
                                break;
                        }
                    }
                }
            }
        }
    };

    var state_UAVariable = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.Variable;
            this.obj.browseName = attrs["BrowseName"] || null;
            this.obj.parentNodeId = convertToNodeId(attrs["ParentNodeId"]);
            this.obj.dataType = convertToNodeId(attrs["DataType"]);

            this.obj.valueRank = attrs["ValueRank"] || 0;
            this.obj.valueRank = parseInt(this.obj.valueRank );

            this.obj.arrayDimension = attrs["ArrayDimension"] || null;
            this.obj.arrayDimension = parseInt(this.obj.arrayDimension );

            this.obj.minimumSamplingInterval = attrs["MinimumSamplingInterval"] ? parseInt(attrs["MinimumSamplingInterval"]) : 0;
            this.obj.minimumSamplingInterval = parseInt(this.obj.minimumSamplingInterval );


            this.obj.historizing = false;
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.arrayDimensions = stringToUInt32Array(attrs["ArrayDimensions"]);

        },
        finish: function () {
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function () {
                this.parent.obj.displayName = this.text;
            }},
            'Description': {finish: function () {
                this.parent.obj.description = this.text;
            }},
            'References': references_parser,
            'Value': {
                parser: {
                    'ListOfLocalizedText': {
                        init: function () {
                            this.listData = [];
                        },
                        parser: localizedText_parser,
                        finish: function () {
                            this.parent.parent.obj.value = new Variant({
                                dataType: DataType.LocalizedText,
                                arrayType: VariantArrayType.Array,
                                value: this.listData

                            });
                        },
                        endElement: function(element) {
                            //xx console.log("xxxxxx element",element,this.parser.LocalizedText.localizedText);
                            this.listData.push(this.parser.LocalizedText.localizedText);
                        }
                    },
                    'ListOfExtensionObject': {
                        init: function () {
                            this.listData = [];
                        },
                        parser: extensionObject_parser,
                        finish: function () {
                            this.parent.parent.obj.value = new Variant({
                                dataType: DataType.ExtensionObject,
                                arrayType: VariantArrayType.Array,
                                value: this.listData
                            });

                        },
                        endElement: function(element) {
                            if (this.parser.ExtensionObject.extensionObject) {
                                //xx console.log("xxxxxx element",element,this.parser.ExtensionObject.extensionObject.name);
                                //assert(element === "ExtensionObject");
                                this.listData.push(this.parser.ExtensionObject.extensionObject);
                            }
                        }

                    }
                }
            }
        }
    };


    var state_UAVariableType = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.VariableType;
            this.obj.isAbstract = ec.coerceBoolean(attrs["IsAbstract"]);
            this.obj.browseName = attrs["BrowseName"] || null;
            this.obj.parentNodeId = attrs["ParentNodeId"] || null;
            this.obj.dataType = convertToNodeId(attrs["DataType"]) || null;
            this.obj.valueRank = ec.coerceInt32(attrs["ValueRank"]) || null;
            this.obj.minimumSamplingInterval = attrs["MinimumSamplingInterval"] ? parseInt(attrs["MinimumSamplingInterval"]) : 0;
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.arrayDimensions = stringToUInt32Array(attrs["ArrayDimensions"]);
        },
        finish: function () {
            try {
                address_space._createObject(this.obj);
            }
            catch(err) {
                this.obj.address_space = null;
                console.log(" Cannot create object",JSON.stringify(this.obj,null," "));
                throw err;
            }
        },
        parser: {
            'DisplayName': {finish: function () {
                this.parent.obj.displayName = this.text;
            }},
            'Description': {finish: function () {
                this.parent.obj.description = this.text;
            }},
            'References': references_parser,
            'Value': {}
        }
    };
    var state_UAMethod = {
        init: function (name, attrs) {
            this.obj = {};
            this.obj.nodeClass = NodeClass.Method;
            // MethodDeclarationId
            // ParentNodeId
            this.obj.browseName = attrs["BrowseName"] || null;
            this.obj.parentNodeId = attrs["ParentNodeId"] || null;
            this.obj.nodeId = convertToNodeId(attrs["NodeId"]) || null;
            this.obj.methodDeclarationId = attrs["MethodDeclarationId"] ? resolveNodeId(attrs["MethodDeclarationId"]): null;

        },
        finish: function () {
            //xx console.log("xxxx add Method ".red,this.obj.nodeId.toString().yellow );
            address_space._createObject(this.obj);
        },
        parser: {
            'DisplayName': {finish: function () {
                this.parent.obj.displayName = this.text;
            }},
            'References': references_parser
        }
    };

    var state_0 = {
        parser: {
            'Aliases': { parser: { 'Alias': state_Alias } },
            'UAObject': state_UAObject,
            'UAObjectType': state_UAObjectType,
            'UAReferenceType': state_UAReferenceType,
            'UADataType': state_UADataType,
            'UAVariable': state_UAVariable,
            'UAVariableType': state_UAVariableType,
            'UAMethod': state_UAMethod
        }
    };

    if (!_.isArray(xmlFiles)) {
        xmlFiles = [xmlFiles]
    }
    var parser = new Xml2Json(state_0);

    async.mapSeries(xmlFiles,function(xmlFile,callback){

        parser.parse(xmlFile,callback);
    },function() {
        make_back_references(address_space);
        callback.apply(this, arguments);
    });

}
exports.generate_address_space = generate_address_space;
