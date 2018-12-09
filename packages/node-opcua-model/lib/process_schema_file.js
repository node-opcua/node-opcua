const Xml2Json = require("node-opcua-xml2json").Xml2Json;
const doDebug = false;

function w(s, l) {
    return (s + "                                                    ").substr(0, l);
}

const predefinedType = {
    "opc:Bit": 1,
    "opc:Boolean": 1,
    "opc:Byte": 1,
    "opc:ByteString": 1,
    "opc:Char": 1,
    "opc:CharArray": 1,
    "opc:DateTime": 1,
    "opc:Double": 1,
    "opc:Float": 1,
    "opc:Guid": 1,
    "opc:Int16": 1,
    "opc:Int32": 1,
    "opc:Int64": 1,
    "opc:UInt16": 1,
    "opc:UInt32": 1,
    "opc:UInt64": 1,
    "opc:String": 1,
    "opc:SByte":1,

    "ua:StatusCode": 1,
    "ua:NodeId":1,
    "ua:DiagnosticInfo": 1,
    "ua:ExtensionObject": 1,
    "ua:Variant": 1,
    "ua:NodeIdType": 1,
    "ua:TwoByteNodeId": 1,
    "ua:FourByteNodeId": 1,
    "ua:NumericNodeId": 1,
    "ua:StringNodeId": 1,
    "ua:ByteStringNodeId": 1,
    "ua:GuidNodeId": 1,
    "ua:ExpandedNodeId": 1,
    "ua:XmlElement": 1,
    "ua:QualifiedName": 1,
    "ua:LocalizedText": 1,
    "ua:DataValue": 1,
};

const found ={};
function resolveType(typeDictionary, typeName) {

    const namespace = typeName.split(":")[0];
    if (predefinedType[typeName]) {
        return;
    }
    if (!found[typeName]) {
        console.log(typeName);
        found[typeName] = typeName;
    }
    if (namespace === "ua") {
    }
};

const state_0 = {
    init: function () {
    },
    parser: {
        "TypeDictionary": {
            init: function () {

                this.typeDictionary = this.engine.typeDictionary;
            },
            parser: {
                "Import": {
                    finish: function () {
                        // _register_namespace_uri(this.text);
                        console.log("Import NameSpace = ", this.attrs.Namespace, " Location", this.attrs.Location);
                    }
                },
                "EnumeratedType": {
                    init: function () {
                        if(doDebug){
                            console.log("EnumeratedType Name=".cyan, w(this.attrs.Name, 40), "LengthInBits=", this.attrs.LengthInBits);
                        }
                        this.enumeratedType = {};
                    },
                    parser: {
                        "EnumeratedValue": {
                            finish: function () {
                                if (doDebug) {
                                    console.log(" EnumeratedValue Name=", w(this.attrs.Name, 40), " Value=", this.attrs.Value);
                                }
                                this.parent.enumeratedType[this.attrs.Name] = parseInt(this.attrs.Value);
                            }
                        }
                    },
                    finish: function () {
                        this.parent.typeDictionary.enumeratedTypes[this.attrs.Name] = this.enumeratedType;
                    }
                },
                "StructuredType": {
                    init: function () {
                        if (doDebug) {
                            console.log("StructureType Name=".cyan, this.attrs.Name.green, " BaseType=", this.attrs.BaseType);
                        }
                        const baseType =this.attrs.BaseType;
                        const base =this.parent.typeDictionary.structuredTypes[baseType];
                        this.structuredType = {
                            name: this.attrs.Name,
                            baseType: baseType,
                            bb: base,
                            fields: []
                        };
                    },
                    parser: {
                        "Field": {
                            finish: function () {
                                if (doDebug) {
                                    console.log(
                                      " field Name=".yellow, w(this.attrs.Name, 40),
                                      " field TypeName=".yellow, w(this.attrs.TypeName, 40),
                                      " field LengthField=".yellow, w(this.attrs.LengthField, 40));
                                }
                                resolveType(this.parent.typeDictionary, this.attrs.TypeName);


                                const field = { name: this.attrs.Name, fieldType:this.attrs.TypeName};
                                if (this.attrs.LengthField) {
                                    field.isArray = true;
                                    this.parent.structuredType.fields[this.parent.structuredType.fields.length-1]=field;
                                } else {
                                    this.parent.structuredType.fields.push(field);
                                }
                            }
                        }
                    },
                    finish: function () {
                        this.parent.typeDictionary.structuredTypes[this.attrs.Name] = this.structuredType;
                    }
                }
            }
        }
    }
};

function parseBinaryXSD(str, callback) {

    const typeDictionary = {
        structuredTypes: {},
        enumeratedTypes: {}
    };

    const parser = new Xml2Json(state_0);
    parser.typeDictionary = typeDictionary;
    parser.parseString(str, function (err) {
        callback(err, typeDictionary);
    });
}

exports.parseBinaryXSD = parseBinaryXSD;


