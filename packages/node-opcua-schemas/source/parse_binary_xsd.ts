/**
 * @module node-opcua-schemas
 */
// tslint:disable:no-console
// tslint:disable:object-literal-sort-keys
// tslint:disable:no-empty

import chalk from "chalk";
import {
    buildStructuredType,
    StructuredTypeField,
    StructuredTypeOptions,
    StructuredTypeSchema
} from "node-opcua-factory";

import { Xml2Json } from "node-opcua-xml2json";
import { prepareStructureType } from "./tools";

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
    "ua:XmlElement": 1
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
    defaultByteOrder: "LittleEndian";
    targetNamespace: string;
    imports: string[];
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
            init: function (this: any, name: string, attributes: any) {
                this.typeDictionary = this.engine.typeDictionary;

                this.typeDictionary.defaultByteOrder = attributes.DefaultByteOrder;
                this.typeDictionary.targetNamespace = attributes.TargetNamespace;
            },
            parser: {
                Import: {
                    init: function (this: any, name: string, attributes: any) {
                        this.parent.typeDictionary.imports.push(attributes.Namespace);
                    },
                    finish: function (this: any) {
                        // _register_namespace_uri(this.text);
                        if (doDebug) {
                            console.log("Import NameSpace = ", this.attrs.Namespace,
                                " Location", this.attrs.Location);
                        }
                    }
                },

                EnumeratedType: {
                    init: function (this: any) {

                        if (doDebug) {
                            console.log(chalk.cyan("EnumeratedType Name="),
                                w(this.attrs.Name, 40), "LengthInBits=", this.attrs.LengthInBits);
                        }

                        this.enumeratedType = {
                            enumeratedValues: [] as EnumeratedValue[],
                            lengthInBits: parseInt(this.attrs.LengthInBits, 10),
                            name: this.attrs.Name
                        };
                    },
                    parser: {
                        Documentation: {
                            finish: function (this: any) {
                                this.parent.enumeratedType.documentation = this.text;
                            }
                        },
                        EnumeratedValue: {
                            finish: function (this: any) {
                                if (doDebug) {
                                    console.log(" EnumeratedValue Name=",
                                        w(this.attrs.Name, 40), " Value=", this.attrs.Value);
                                }
                                this.parent.enumeratedType.enumeratedValues.push({
                                    name: this.attrs.Name,
                                    value: parseInt(this.attrs.Value, 10)
                                });
                            }
                        }
                    },
                    finish: function (this: any) {
                        this.parent.typeDictionary.enumeratedTypes[this.attrs.Name] = this.enumeratedType;
                    }
                },
                StructuredType: {
                    init: function (this: any) {
                        if (doDebug) {
                            console.log(chalk.cyan("StructureType Name="),
                                this.attrs.Name.green, " BaseType=", this.attrs.BaseType);
                        }
                        const baseType = this.attrs.BaseType;

                        const base = this.parent.typeDictionary.structuredTypes[baseType];

                        this.structuredType = {
                            name: this.attrs.Name,
                            baseType: baseType,
                            fields: []
                        };
                        if (base) {
                            this.structuredType.base = base;
                        }
                    },
                    parser: {
                        Field: {
                            finish: function (this: any) {

                                if (this.attrs.SourceType) {
                                    // ignore  this field, This is a repeatition of the base type field with same name
                                    return;
                                }
                                if (doDebug) {
                                    console.log(
                                        chalk.yellow(" field Name="), w(this.attrs.Name, 40),
                                        chalk.yellow(" field TypeName="), w(this.attrs.TypeName, 40),
                                        chalk.yellow(" field LengthField="), w(this.attrs.LengthField, 40));
                                }
                                resolveType(this.parent.typeDictionary, this.attrs.TypeName);

                                const field: any = { name: this.attrs.Name, fieldType: this.attrs.TypeName };

                                if (field.fieldType === "opc:Bit") {
                                    // do something to collect bits but ignore them as field
                                    this.parent.structuredType.flags = this.parent.structuredType.flags || [];
                                    this.parent.structuredType.flags.push(field.name);
                                    return;
                                }

                                if (this.attrs.LengthField) {
                                    field.isArray = true;
                                    const n = this.parent.structuredType.fields.length - 1;
                                    this.parent.structuredType.fields[n] = field;
                                } else {
                                    this.parent.structuredType.fields.push(field);
                                }
                            }
                        }
                    },
                    finish: function (this: any) {
                        this.parent.typeDictionary.structuredTypes[this.attrs.Name] = this.structuredType;
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
        defaultByteOrder: "LittleEndian",
        targetNamespace: "",
        imports: [],
        structuredTypes: {},
        enumeratedTypes: {}
    };

    const parser = new Xml2Json(state0);
    (parser as any).typeDictionary = typeDictionary;
    parser.parseString(xmlString, (err?: Error | null) => {

        for (const key in typeDictionary.structuredTypes) {

            if (!typeDictionary.structuredTypes.hasOwnProperty(key)) {
                continue;
            }

            const structuredType = typeDictionary.structuredTypes[key];

            prepareStructureType(structuredType, typeDictionary);

            const structuredTypeSchema: StructuredTypeSchema = buildStructuredType(structuredType);
            typeDictionary.structuredTypes[key] = structuredTypeSchema;

        }

        callback(err!, typeDictionary);
    });
}
