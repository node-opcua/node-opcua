/**
 * @module node-opcua-schemas
 */
// tslint:disable:no-console
// tslint:disable:object-literal-sort-keys
// tslint:disable:no-empty

import chalk from "chalk";
import {
    EnumerationDefinitionSchema, FieldInterfaceOptions,
    StructuredTypeField,
    StructuredTypeOptions,
    StructuredTypeSchema
} from "node-opcua-factory";

import { checkDebugFlag } from "node-opcua-debug";
import { Xml2Json } from "node-opcua-xml2json";
import { prepareEnumeratedType, prepareStructureType } from "./tools";

const doDebug = checkDebugFlag(__filename);

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

export interface EnumeratedType {
    name: string;
    documentation?: string;
    enumeratedValues: any;
    lengthInBits?: number;
}

export interface StructureTypeRaw {
    name: string;
    baseType?: string;
    base?: StructureTypeRaw;
    fields: any[];
}

export interface TypeDictionary {
    defaultByteOrder: "LittleEndian";
    targetNamespace: string;
    imports: string[];
    structuredTypes: { [key: string]: StructuredTypeSchema; };
    enumeratedTypes: { [key: string]: EnumerationDefinitionSchema; };

    structuredTypesRaw: { [key: string]: StructureTypeRaw };
    enumeratedTypesRaw: { [key: string]: EnumeratedType; };
}

/* tslint:disable:object-literal-shorthand */
const state0: any = {
    init: () => {
        const a = 1;
    },
    parser: {
        TypeDictionary: {
            init: function(this: any, name: string, attributes: any) {

                this.typeDictionary = this.engine.typeDictionary as TypeDictionary;
                this.typeDictionary.defaultByteOrder = attributes.DefaultByteOrder;
                this.typeDictionary.targetNamespace = attributes.TargetNamespace;

            },
            parser: {
                Import: {
                    init: function(this: any, name: string, attributes: any) {
                        this.parent.typeDictionary.imports.push(attributes.Namespace);
                    },
                    finish: function(this: any) {
                        // _register_namespace_uri(this.text);
                        if (doDebug) {
                            console.log("Import NameSpace = ", this.attrs.Namespace,
                                " Location", this.attrs.Location);
                        }
                    }
                },

                EnumeratedType: {
                    init: function(this: any) {

                        this.typescriptDefinition = "";
                        if (doDebug) {
                            console.log(chalk.cyan("EnumeratedType Name="),
                                w(this.attrs.Name, 40), "LengthInBits=", this.attrs.LengthInBits);
                        }

                        this.enumeratedType = {
                            enumeratedValues: {},
                            lengthInBits: parseInt(this.attrs.LengthInBits, 10),
                            name: this.attrs.Name
                        };

                        this.typescriptDefinition += `enum ${this.enumeratedType.name} {`;
                    },
                    parser: {
                        Documentation: {
                            finish: function(this: any) {
                                this.parent.enumeratedType.documentation = this.text;
                            }
                        },
                        EnumeratedValue: {
                            finish: function(this: any) {
                                if (doDebug) {
                                    console.log(" EnumeratedValue Name=",
                                        w(this.attrs.Name, 40), " Value=", this.attrs.Value);
                                }
                                const key = this.attrs.Name;
                                const value = parseInt(this.attrs.Value, 10);
                                const _enum = this.parent.enumeratedType.enumeratedValues;
                                _enum[_enum[key] = value] = key;
                                this.parent.typescriptDefinition += `\n  ${key} = ${value},`;
                            }
                        }
                    },
                    finish: function(this: any) {
                        this.typescriptDefinition += `\n}`;
                        this.parent.typeDictionary.enumeratedTypesRaw[this.attrs.Name] = this.enumeratedType;
                        if (doDebug) {
                            console.log(" this.typescriptDefinition  = ", this.typescriptDefinition);
                        }
                    }
                },
                StructuredType: {
                    init: function(this: any) {

                        if (doDebug) {
                            console.log(chalk.cyan("StructureType Name="),
                                chalk.green(this.attrs.Name), " BaseType=", this.attrs.BaseType);
                        }

                        const baseType = this.attrs.BaseType;

                        const base = this.parent.typeDictionary.structuredTypesRaw[baseType];

                        const structuredType: StructuredTypeOptions = {
                            name: this.attrs.Name,
                            baseType: baseType,
                            fields: []
                        };
                        if (base) {
                            structuredType.base = base;
                        }
                        this.structuredType = structuredType;
                    },
                    parser: {
                        Field: {
                            finish: function(this: any) {

                                if (this.attrs.SourceType) {
                                    // ignore  this field, This is a repetition of the base type field with same name
                                    return;
                                }
                                if (doDebug) {
                                    console.log(
                                        chalk.yellow(" field Name="), w(this.attrs.Name, 40),
                                        chalk.yellow(" field TypeName="), w(this.attrs.TypeName, 40),
                                        chalk.yellow(" field LengthField="), w(this.attrs.LengthField, 40));
                                }
                                resolveType(this.parent.typeDictionary, this.attrs.TypeName);

                                const field: FieldInterfaceOptions = {
                                    name: this.attrs.Name,
                                    fieldType: this.attrs.TypeName
                                };

                                const structuredType: StructuredTypeOptions = this.parent.structuredType;
                                if (field.fieldType === "opc:Bit") {
                                    // do something to collect bits but ignore them as field
                                    structuredType.bitFields = structuredType.bitFields || [];
                                    const length = this.attrs.Length || 1;
                                    structuredType.bitFields.push({ name: field.name, length });
                                    return;
                                }

                                if (this.attrs.LengthField) {
                                    field.isArray = true;
                                    const n = structuredType.fields.length - 1;
                                    structuredType.fields[n] = field;
                                } else {
                                    structuredType.fields.push(field);
                                }
                                if (this.attrs.SwitchField) {

                                    // field is optional and can be omitted
                                    const switchField = this.attrs.SwitchField;

                                    if (this.attrs.SwitchValue) {
                                        // we are in a union
                                        field.switchValue = parseInt(this.attrs.SwitchValue, 10);
                                        if (doDebug) {
                                            console.log("field", field.name, " is part of a union  => ", switchField, " value #", field.switchValue);
                                        }
                                    } else {
                                        field.switchBit = structuredType.bitFields ?
                                            structuredType.bitFields!.findIndex((x) => x.name === switchField) : -2;
                                        if (doDebug) {
                                            console.log("field", field.name, " is optional => ", switchField, "bit #", field.switchBit);
                                        }
                                    }
                                }
                            }
                        }
                    },
                    finish: function(this: any) {
                        this.parent.typeDictionary.structuredTypesRaw[this.attrs.Name] = this.structuredType;
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
        structuredTypesRaw: {},
        enumeratedTypes: {},
        enumeratedTypesRaw: {}
    };

    const parser = new Xml2Json(state0);
    (parser as any).typeDictionary = typeDictionary;
    parser.parseString(xmlString, (err?: Error | null) => {
        // resolve and prepare enumerations
        for (const key in typeDictionary.enumeratedTypesRaw) {
            if (!typeDictionary.enumeratedTypesRaw.hasOwnProperty(key)) {
                continue;
            }
            const enumeratedType = typeDictionary.enumeratedTypesRaw[key];
            prepareEnumeratedType(enumeratedType, typeDictionary);
        }
        // resolve complex types
        for (const key in typeDictionary.structuredTypesRaw) {

            if (!typeDictionary.structuredTypesRaw.hasOwnProperty(key)) {
                continue;
            }
            const structuredType = typeDictionary.structuredTypesRaw[key];
            if (structuredType.name !== key) {
                throw new Error("Invalid name");
            }
            prepareStructureType(structuredType, typeDictionary);
        }
        callback(err!, typeDictionary);
    });
}
