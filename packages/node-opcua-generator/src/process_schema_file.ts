// tslint:disable:no-console
// tslint:disable:object-literal-sort-keys

import chalk from "chalk";
import * as fs from "fs";
import { StructuredTypeField, StructuredTypeOptions, StructuredTypeSchema } from "node-opcua-factory";
import { EnumeratedType, EnumeratedValue } from "./process_schema_file";

const Xml2Json = require("node-opcua-xml2json").Xml2Json;
const doDebug = false;

function w(s: string, l: number): string {
    return (s + "                                                    ").substr(0, l);
}

const predefinedType: any = {
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
    "opc:SByte": 1,
    "opc:String": 1,
    "opc:UInt16": 1,
    "opc:UInt32": 1,
    "opc:UInt64": 1,

    "ua:ByteStringNodeId": 1,
    "ua:DataValue": 1,
    "ua:DiagnosticInfo": 1,
    "ua:ExpandedNodeId": 1,
    "ua:ExtensionObject": 1,
    "ua:FourByteNodeId": 1,
    "ua:GuidNodeId": 1,
    "ua:LocalizedText": 1,
    "ua:NodeId": 1,
    "ua:NodeIdType": 1,
    "ua:NumericNodeId": 1,
    "ua:QualifiedName": 1,
    "ua:StatusCode": 1,
    "ua:StringNodeId": 1,
    "ua:TwoByteNodeId": 1,
    "ua:Variant": 1,
    "ua:XmlElement": 1,
};

const found: any = {};

function resolveType(typeDictionary: string, typeName: string) {

    const namespace = typeName.split(":")[0];
    if (predefinedType[typeName]) {
        return;
    }
    if (!found[typeName]) {
        found[typeName] = typeName;
    }
    if (namespace === "ua") {
    }
}

export interface EnumeratedValue {
    name: string;
    value: number;
}

export interface EnumeratedType {
    name: string;
    documentation?: string;
    enumeratedValues: EnumeratedValue[];
    lengthInBits?: number;
}

export interface TypeDictionary {
    structuredTypes: { [key: string]: StructuredTypeSchema; };
    enumeratedTypes: { [key: string]: EnumeratedType; };
}

/* tslint:disable:object-literal-shorthand */
const state0: any = {
    init: () => {
        const a = 1;
    },
    parser: {
        TypeDictionary: {
            init: function () {
                const self = this as any;
                self.typeDictionary = self.engine.typeDictionary;
            },
            parser: {
                Import: {
                    finish: function () {
                        const self = this as any;
                        // _register_namespace_uri(this.text);
                        console.log("Import NameSpace = ", self.attrs.Namespace, " Location", self.attrs.Location);
                    }
                },

                EnumeratedType: {
                    init: function () {

                        const self = this as any;

                        if (doDebug) {
                            console.log(chalk.cyan("EnumeratedType Name="),
                                w(self.attrs.Name, 40), "LengthInBits=", self.attrs.LengthInBits);
                        }

                        self.enumeratedType = {
                            enumeratedValues: [] as EnumeratedValue[],
                            lengthInBits: parseInt(self.attrs.LengthInBits, 10),
                            name: self.attrs.Name,
                        };
                    },
                    parser: {
                        Documentation: {
                            finish: function () {
                                const self = this as any;
                                self.parent.enumeratedType.documentation = self.text;
                            }
                        },
                        EnumeratedValue: {
                            finish: function () {
                                const self = this as any;
                                if (doDebug) {
                                    console.log(" EnumeratedValue Name=",
                                        w(self.attrs.Name, 40), " Value=", self.attrs.Value);
                                }
                                self.parent.enumeratedType.enumeratedValues.push({
                                    name: self.attrs.Name,
                                    value: parseInt(self.attrs.Value, 10)
                                });
                            }
                        }
                    },
                    finish: function () {
                        const self = this as any;
                        self.parent.typeDictionary.enumeratedTypes[self.attrs.Name] = self.enumeratedType;
                    }
                },
                StructuredType: {
                    init: function () {
                        const self = this as any;
                        if (doDebug) {
                            console.log(chalk.cyan("StructureType Name="),
                                self.attrs.Name.green, " BaseType=", self.attrs.BaseType);
                        }
                        const baseType = self.attrs.BaseType;

                        const base = self.parent.typeDictionary.structuredTypes[baseType];

                        self.structuredType = {
                            name: self.attrs.Name,
                            baseType: baseType,
                            fields: []
                        };
                        if (base) {
                            self.structuredType.base = base;
                        }
                    },
                    parser: {
                        Field: {
                            finish: function () {
                                const self = this as any;

                                if (self.attrs.SourceType) {
                                    // ignore  this field, This is a repeatition of the base type field with same name
                                   return;
                                }
                                if (doDebug) {
                                    console.log(
                                        chalk.yellow(" field Name="), w(self.attrs.Name, 40),
                                        chalk.yellow(" field TypeName="), w(self.attrs.TypeName, 40),
                                        chalk.yellow(" field LengthField="), w(self.attrs.LengthField, 40));
                                }
                                resolveType(self.parent.typeDictionary, self.attrs.TypeName);

                                const field: any = {name: self.attrs.Name, fieldType: self.attrs.TypeName};

                                if (field.fieldType === "opc:Bit") {
                                    // do something to collect bits but ignore them as field
                                    self.parent.structuredType.flags = self.parent.structuredType.flags || [];
                                    self.parent.structuredType.flags.push(field.name);
                                    return;
                                }

                                if (self.attrs.LengthField) {
                                    field.isArray = true;
                                    const n = self.parent.structuredType.fields.length - 1;
                                    self.parent.structuredType.fields[n] = field;
                                } else {
                                    self.parent.structuredType.fields.push(field);
                                }
                            }
                        }
                    },
                    finish: function () {
                        const self = this as any;
                        self.parent.typeDictionary.structuredTypes[self.attrs.Name] = self.structuredType;
                    }
                }
            }
        }
    }
};

export function parseBinaryXSD(
    xmlString: string,
    callback: (err: Error | null, typeDictionary: TypeDictionary
    ) => void) {

    const typeDictionary: TypeDictionary = {
        structuredTypes: {},
        enumeratedTypes: {}
    };

    const parser = new Xml2Json(state0);
    parser.typeDictionary = typeDictionary;
    parser.parseString(xmlString, (err: Error | null) => {
        callback(err, typeDictionary);
    });
}

