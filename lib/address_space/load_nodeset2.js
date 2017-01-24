require("requirish")._(module);

import { Xml2Json } from "lib/xml2json/lib";
import { NodeClass } from "lib/datamodel/nodeclass";
import { resolveNodeId } from "lib/datamodel/nodeid";
import { AddressSpace } from "lib/address_space/address_space";
import { DataType } from "lib/datamodel/variant";
import { VariantArrayType } from "lib/datamodel/variant";
import { Variant } from "lib/datamodel/variant";
import { Argument } from "_generated_/_auto_generated_Argument";
import { coerceLocalizedText } from "lib/datamodel/localized_text";
import { EnumValueType } from "_generated_/_auto_generated_EnumValueType";
import assert from "better-assert";
import _ from "underscore";
import * as ec from "lib/misc/encode_decode";
import async from "async";


/**
 * @method make_back_references
 * @param addressSpace  {AddressSpace}
 */
function make_back_references(addressSpace) {
  addressSpace.suspendBackReference = false;

  _.forEach(addressSpace._nodeid_index, (node) => {
    node.propagate_back_references();
  });
  _.forEach(addressSpace._nodeid_index, (node) => {
    node.install_extra_properties();
  });
}

function stringToUInt32Array(str) {
  const array = str ? str.split(",").map(value => parseInt(value)) : null;
  return array;
}

import { makeAccessLevel } from "lib/datamodel/access_level";
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
        // xx console.log(' nodeId', typeof nodeId,nodeId);
    assert(typeof nodeId === "string");
    const m = nodeId.match(reg);
    if (m) {
      const namespaceIndex = _translateNamespaceIndex(parseInt(m[1]));
      nodeId = `ns=${namespaceIndex};${m[2]}`;
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
    const stringToQualifiedName = require("lib/datamodel/qualified_name").stringToQualifiedName;
    const qn = stringToQualifiedName(qualifiedName);
    if (qn.namespaceIndex > 0) {
      qn.namespaceIndex = _translateNamespaceIndex(qn.namespaceIndex);
    }
    return qn;
  }

  assert(addressSpace instanceof AddressSpace);
  assert(_.isFunction(callback)); // expecting a callback

  const state_Alias = {
    finish() {
      add_alias(this.attrs.Alias, _translateNodeId(this.text));
    }
  };

  const references_parser = {
    init() {
      this.parent.obj.references = [];
      this.array = this.parent.obj.references;
    },
    parser: {
      Reference: {
        finish() {
          this.parent.array.push({
            referenceType: _translateReferenceType(this.attrs.ReferenceType),
            isForward: (this.attrs.IsForward === undefined) ? true : (this.attrs.IsForward !== "false"),
            nodeId: convertToNodeId(this.text)
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
    init(name, attrs) {
      this.parent.obj.definition = [];
      this.parent.obj.definition_name = attrs.Name;
      this.array = this.parent.obj.definition;
    },
    parser: {
      Field: {
        init() {
          this.description = undefined;
        },
        parser: {
          Description: {
            finish() {
              this.parent.description = this.text;
            }
          }
        },
        finish() {
          this.parent.array.push({
            name: this.attrs.Name,
            value: this.attrs.Value,
            dataType: convertToNodeId(this.attrs.DataType),
            valueRank:  parseInt(this.attrs.ValueRank),
            description: this.description
          });
        }
      }
    }
  };

  const state_UAObject = {
    init(name, attrs) {
      this.obj = {};
      this.obj.nodeClass = NodeClass.Object;
      this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
      this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
      this.obj.browseName = convertQualifiedName(attrs.BrowseName);
      this.obj.eventNotifier = ec.coerceByte(attrs.EventNotifier) || 0;
      this.obj.symbolicName = attrs.SymbolicName || null;
    },
    finish() {
            // xx console.log("xxxx add object ".red,this.obj.nodeId.toString().yellow , this.obj.browseName);
      addressSpace._createNode(this.obj);
    },
    parser: {
      DisplayName: {
        finish() {
          this.parent.obj.displayName = this.text;
        }
      },
      Description: {
        finish() {
          this.parent.obj.description = this.text;
        }
      },

      References: references_parser
    }
  };

  const state_UAObjectType = {
    init(name, attrs) {
      this.obj = {};
      this.obj.nodeClass = NodeClass.ObjectType;
      this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
      this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
      this.obj.browseName = convertQualifiedName(attrs.BrowseName);
      this.obj.eventNotifier = ec.coerceByte(attrs.EventNotifier) || 0;
    },
    finish() {
      addressSpace._createNode(this.obj);
    },
    parser: {
      DisplayName: {
        finish() {
          this.parent.obj.displayName = this.text;
        }
      },
      Description: {
        finish() {
          this.parent.obj.description = this.text;
        }
      },

      References: references_parser
    }
  };

  const state_UAReferenceType = {
    init(name, attrs) {
      this.obj = {};
      this.obj.nodeClass = NodeClass.ReferenceType;
      this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
      this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
      this.obj.browseName = convertQualifiedName(attrs.BrowseName);
    },
    finish() {
      addressSpace.addReferenceType(this.obj,false);
    },
    parser: {
      DisplayName: {
        finish() {
          this.parent.obj.displayName = this.text;
        }
      },
      Description: {
        finish() {
          this.parent.obj.description = this.text;
        }
      },
      InverseName: {
        finish() {
          this.parent.obj.inverseName = this.text;
        }
      },
      References: references_parser
    }
  };

  const state_UADataType = {
    init(name, attrs) {
      this.obj = {};
      this.obj.nodeClass = NodeClass.DataType;
      this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);
      this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
      this.obj.browseName = convertQualifiedName(attrs.BrowseName);
      this.obj.displayName = "";
      this.obj.description = "";
    },
    finish() {
      addressSpace._createNode(this.obj);
      assert(addressSpace.findNode(this.obj.nodeId));
    },
    parser: {
      DisplayName: {
        finish() {
          this.parent.obj.displayName = this.text;
        }
      },
      Description: {
        finish() {
          this.parent.obj.description = this.text;
        }
      },
      References: references_parser,
      Definition: definition_parser
    }
  };

  const localizedText_parser = {
    LocalizedText: {
      init() {
        this.localizedText = {};
      },
      parser: {
        Locale: {
          finish() {
            this.parent.localizedText.locale = this.text.trim();
          }
        },
        Text: {
          finish() {
            this.parent.localizedText.text = this.text.trim();
          }
        }
      }
    }
  };

  const enumValueType_parser = {
    EnumValueType: {
      init() {
        this.enumValueType = {
          value: 0,
          displayName: null,
          description: null
        };
      },
      parser: {
        Value: {
          finish() {
            this.parent.enumValueType.value = parseInt(this.text);
          }
        },
        DisplayName:     _.extend(_.clone(localizedText_parser.LocalizedText),{
          finish() {
            this.parent.enumValueType.displayName = _.clone(this.localizedText);
          }
        }),
        Description:     _.extend(_.clone(localizedText_parser.LocalizedText),{
          finish() {
            this.parent.enumValueType.description = _.clone(this.localizedText);
          }
        })
      },
      finish() {
        this.enumValueType = new EnumValueType(this.enumValueType);
      }
    }
  };

  const argument_parser = {
    Argument: {
      init() {
        this.argument = {};
      },
      parser: {
        Name: {
          finish() {
            this.parent.argument.name = this.text.trim();
          }
        },
        DataType: {
          parser: {
            Identifier: {
              finish() {
                this.parent.parent.argument.dataType = resolveNodeId(this.text.trim());
              }
            }
          }
        },
        ValueRank: {
          finish() {
            this.parent.argument.valueRank = parseInt(this.text.trim());
          }
        },
        ArrayDimensions: {

          finish() {
                      // xx  this.parent.argument.arrayDimensions =[];
          }
        },
        Description: {
          init() {
            this._text = "";
            this.locale = null; this.text = null;
          },
          parser: {
            Locale: {
              init() {
                this.text = "";
              },
              finish() {
                this.parent.locale = this.text.trim();
              }
            },
            Text: {
              finish() {
                this.text = this.text || "";
                this.parent._text = this.text.trim();
              }
            }
          },
          finish() {
            this.parent.argument.description = coerceLocalizedText(this._text);
          }
        }
      },
      finish() {
        this.argument = new Argument(this.argument);
      }
    }
  };

  const extensionObject_parser = {
    ExtensionObject: {
      init() {
        this.typeId = {};
        this.extensionObject = null;
      },
      parser: {
        TypeId: {
          parser: {
            Identifier: {
              finish() {
                const typeId = this.text.trim();
                this.parent.parent.typeId = resolveNodeId(typeId);

                switch (typeId) {
                  case "i=297":  // Argument
                    break;
                  case "i=7616": // EnumValueType
                    break;
                  default:
                    console.warn(`xxxx unsupported typeId in ExtensionObject ${typeId}`);
                    break;

                }
              }
            }
          }
        },
        Body: {
          parser: {
            Argument: argument_parser.Argument,
            EnumValueType: enumValueType_parser.EnumValueType
          },
          finish() {
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
              default:
                                // xx console.log("xxxxx unsupported typeId in ExtensionObject " +  self.typeId);
                break;
            }
          }
        }
      }
    }
  };

  function BasicType_parser(dataType,parseFunc) {
    const parser = {};
    parser[dataType] = {
      init() {
        this.value = 0;
      },
      finish() {
        this.value = parseFunc(this.text);
      }
    };
    return parser;
  }
  function ListOf(dataType,parseFunc) {
    return {
      init() {
        this.listData = [];
      },

      parser: BasicType_parser(dataType,parseFunc),

      finish() {
        this.parent.parent.obj.value = {
          dataType:   DataType[dataType],
          arrayType:  VariantArrayType.Array,
          value: this.listData
        };
      },
      endElement(element) {
        this.listData.push(this.parser[dataType].value);
      }
    };
  }

  const state_Variant =     {
    parser: {
      String: {
        finish() {
          this.parent.parent.obj.value = {
            dataType: DataType.String,
            value: this.text
          };
        }
      },
      Boolean: {
        finish() {
          this.parent.parent.obj.value = {
            dataType: DataType.Boolean,
            value: this.text.toLowerCase() === "true"
          };
        }
      },
      ByteString: {
        init() {
          this.byteString = null;
        },
        finish() {
          const base64text = this.text;
          const byteString = Buffer.from(base64text,"base64");
          this.parent.parent.obj.value = {
            dataType: DataType.ByteString,
            arrayType: VariantArrayType.Scalar,
            value: byteString
          };
        }
      },
      ListOfLocalizedText: {
        init() {
          this.listData = [];
        },
        parser: localizedText_parser,
        finish() {
          this.parent.parent.obj.value = {
            dataType: DataType.LocalizedText,
            arrayType: VariantArrayType.Array,
            value: this.listData

          };
        },
        endElement() /* element*/{
                    // xx console.log("xxxxxx element",element,this.parser.LocalizedText.localizedText);
          this.listData.push(this.parser.LocalizedText.localizedText);
        }
      },
      ListOfDouble: ListOf("Double",parseFloat),
      ListOfFloat:  ListOf("Float", parseFloat),
      ListOfInt32:  ListOf("Int32", parseInt),
      ListOfInt16:  ListOf("Int16", parseInt),
      ListOfInt8:   ListOf("Int8",  parseInt),
      ListOfUint32:  ListOf("Uint32", parseInt),
      ListOfUint16:  ListOf("Uint16", parseInt),
      ListOfUint8:   ListOf("Uint8",  parseInt),

      ListOfExtensionObject: {
        init() {
          this.listData = [];
        },
        parser: extensionObject_parser,
        finish() {
          this.parent.parent.obj.value = {
            dataType: DataType.ExtensionObject,
            arrayType: VariantArrayType.Array,
            value: this.listData
          };
        },
        endElement(element) {
          if (this.parser.ExtensionObject.extensionObject) {
                        // assert(element === "ExtensionObject");
            this.listData.push(this.parser.ExtensionObject.extensionObject);
          }
        }

      }
    }
  };

  const state_UAVariable = {
    init(name, attrs) {
      this.obj = {};

      this.obj.nodeClass = NodeClass.Variable;
      this.obj.browseName = convertQualifiedName(attrs.BrowseName);
      this.obj.parentNodeId = convertToNodeId(attrs.ParentNodeId);
      this.obj.dataType = convertToNodeId(attrs.DataType);

      this.obj.valueRank = ec.coerceInt32(attrs.ValueRank) || null;
      this.obj.arrayDimensions = stringToUInt32Array(attrs.ArrayDimensions);

      this.obj.minimumSamplingInterval = attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval) : 0;
      this.obj.minimumSamplingInterval = parseInt(this.obj.minimumSamplingInterval);


      this.obj.historizing = false;
      this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;

      this.obj.accessLevel = convertAccessLevel(attrs.AccessLevel);
      this.obj.userAccessLevel = convertAccessLevel(attrs.UserAccessLevel);
    },
    finish() {
      addressSpace._createNode(this.obj);
    },
    parser: {
      DisplayName: {
        finish() {
          this.parent.obj.displayName = this.text;
        }
      },
      Description: {
        finish() {
          this.parent.obj.description = this.text;
        }
      },
      References: references_parser,
      Value: state_Variant
    }
  };

  const state_UAVariableType = {
    init(name, attrs) {
      this.obj = {};
      this.obj.isAbstract = ec.coerceBoolean(attrs.IsAbstract);

      this.obj.nodeClass = NodeClass.VariableType;
      this.obj.browseName = convertQualifiedName(attrs.BrowseName);
      this.obj.parentNodeId = attrs.ParentNodeId || null;
      this.obj.dataType = convertToNodeId(attrs.DataType) || null;

      this.obj.valueRank = ec.coerceInt32(attrs.ValueRank) || null;
      this.obj.arrayDimensions = stringToUInt32Array(attrs.ArrayDimensions);

      this.obj.minimumSamplingInterval = attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval) : 0;

      this.obj.historizing = false;
      this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
    },
    finish() {
      try {
        addressSpace._createNode(this.obj);
      }      catch (err) {
        this.obj.addressSpace = null;
        console.warn(" Cannot create object", JSON.stringify(this.obj, null, " "));
        throw err;
      }
    },
    parser: {
      DisplayName: {
        finish() {
          this.parent.obj.displayName = this.text;
        }
      },
      Description: {
        finish() {
          this.parent.obj.description = this.text;
        }
      },
      References: references_parser,
      Value: state_Variant
    }
  };

  const state_UAMethod = {
    init(name, attrs) {
      this.obj = {};
      this.obj.nodeClass = NodeClass.Method;
            // MethodDeclarationId
            // ParentNodeId
      this.obj.browseName = convertQualifiedName(attrs.BrowseName);
      this.obj.parentNodeId = attrs.ParentNodeId || null;
      this.obj.nodeId = convertToNodeId(attrs.NodeId) || null;
      this.obj.methodDeclarationId = attrs.MethodDeclarationId ? resolveNodeId(attrs.MethodDeclarationId) : null;
    },
    finish() {
            // xx console.log("xxxx add Method ".red,this.obj.nodeId.toString().yellow );
      addressSpace._createNode(this.obj);
    },
    parser: {
      DisplayName: {
        finish() {
          this.parent.obj.displayName = this.text;
        }
      },
      References: references_parser
    }
  };

  const state_0 = {
    parser: {
      NamespaceUris: {
        init() {
        },
        parser: {
          Uri: {
            finish() {
              _register_namespace_uri(this.text);
            }
          }
        }
      },
      Aliases: { parser: { Alias: state_Alias } },
      UAObject: state_UAObject,
      UAObjectType: state_UAObjectType,
      UAReferenceType: state_UAReferenceType,
      UADataType: state_UADataType,
      UAVariable: state_UAVariable,
      UAVariableType: state_UAVariableType,
      UAMethod: state_UAMethod
    }
  };

  if (!_.isArray(xmlFiles)) {
    xmlFiles = [xmlFiles];
  }
  const parser = new Xml2Json(state_0);

  addressSpace.suspendBackReference = true;
  async.mapSeries(xmlFiles, (xmlFile, callback) => {
    _reset_namespace_translation();
    parser.parse(xmlFile, callback);
  }, function (...args) {
    make_back_references(addressSpace);
    assert(!addressSpace.suspendBackReference);
    callback.apply(this, args);
  });
}
export { generate_address_space };
