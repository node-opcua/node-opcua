/**
 * @module node-opcua-schemas
 */
// tslint:disable:object-literal-sort-keys
// tslint:disable:no-empty

import * as chalk from "chalk";

import assert from "node-opcua-assert";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { EnumerationDefinitionSchema, FieldInterfaceOptions, StructuredTypeOptions } from "node-opcua-factory";
import { DataTypeFactory } from "node-opcua-factory";
import { NodeId } from "node-opcua-nodeid";
import { Xml2Json } from "node-opcua-xml2json";

import { getOrCreateStructuredTypeSchema } from "./tools";

const doDebug = checkDebugFlag(__filename);
const debugLog = make_debugLog(__filename);

function w(s: string, l: number): string {
    return s.padEnd(l).substring(0, l);
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
        /** */
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

export interface ITypeDictionary {
    targetNamespace: string;
    imports: string[];
    structuredTypesRaw: StructureTypeRaw[];
    enumeratedTypesRaw: EnumeratedType[];
}

export class TypeDictionary implements ITypeDictionary {
    public targetNamespace = "";
    public imports: string[] = [];
    public structuredTypesRaw: StructureTypeRaw[] = [];
    public enumeratedTypesRaw: EnumeratedType[] = [];
    private structuredTypesRawMap: any = {};
    constructor() {
        /**  */
    }
    public addRaw(structuredType: StructureTypeRaw): void {
        this.structuredTypesRaw.push(structuredType);
        this.structuredTypesRawMap[structuredType.name] = structuredType;
    }
    public getStructuredTypesRawByName(name: string): StructureTypeRaw {
        return this.structuredTypesRawMap[name]! as StructureTypeRaw;
    }
}

/* tslint:disable:object-literal-shorthand */
const state0: any = {
    init: () => {
        const a = 1;
    },
    parser: {
        TypeDictionary: {
            init: function (this: any, name: string, attributes: any) {
                this.typeDictionary = this.engine.typeDictionary as DataTypeFactory;
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
                        // istanbul ignore next
                        if (doDebug) {
                            debugLog("Import NameSpace = ", this.attrs.Namespace, " Location", this.attrs.Location);
                        }
                    }
                },

                EnumeratedType: {
                    init: function (this: any) {
                        this.typescriptDefinition = "";
                        // istanbul ignore next
                        if (doDebug) {
                            debugLog(
                                chalk.cyan("EnumeratedType Name="),
                                w(this.attrs.Name, 40),
                                "LengthInBits=",
                                this.attrs.LengthInBits
                            );
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
                            finish: function (this: any) {
                                this.parent.enumeratedType.documentation = this.text;
                            }
                        },
                        EnumeratedValue: {
                            finish: function (this: any) {
                                // istanbul ignore next
                                if (doDebug) {
                                    debugLog(" EnumeratedValue Name=", w(this.attrs.Name, 40), " Value=", this.attrs.Value);
                                }
                                const key = this.attrs.Name;
                                const value = parseInt(this.attrs.Value, 10);
                                const _enum = this.parent.enumeratedType.enumeratedValues;
                                _enum[(_enum[key] = value)] = key;
                                this.parent.typescriptDefinition += `\n  ${key} = ${value},`;
                            }
                        }
                    },
                    finish: function (this: any) {
                        this.typescriptDefinition += `\n}`;
                        this.parent.typeDictionary.enumeratedTypesRaw[this.attrs.Name] = this.enumeratedType;
                        // istanbul ignore next
                        if (doDebug) {
                            debugLog(" this.typescriptDefinition  = ", this.typescriptDefinition);
                        }
                    }
                },
                StructuredType: {
                    init: function (this: any) {
                        // istanbul ignore next
                        if (doDebug) {
                            debugLog(
                                chalk.cyan("StructureType Name="),
                                chalk.green(this.attrs.Name),
                                " BaseType=",
                                this.attrs.BaseType
                            );
                        }

                        const baseType = this.attrs.BaseType;

                        const base = this.parent.typeDictionary.structuredTypesRawMap[baseType];

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
                            finish: function (this: any) {
                                if (this.attrs.SourceType) {
                                    // ignore  this field, This is a repetition of the base type field with same name
                                    return;
                                }
                                // istanbul ignore next
                                if (doDebug) {
                                    debugLog(
                                        chalk.yellow(" field Name="),
                                        w(this.attrs.Name, 40),
                                        chalk.yellow(" typeName="),
                                        w(this.attrs.TypeName, 40),
                                        this.attrs.LengthField
                                            ? chalk.yellow(" lengthField= ") + w(this.attrs.LengthField, 40)
                                            : "",
                                        this.attrs.SwitchField
                                            ? chalk.yellow(" SwitchField= ") + w(this.attrs.SwitchField, 40)
                                            : "",
                                        this.attrs.SwitchValue !== undefined
                                            ? chalk.yellow(" SwitchValue= ") + w(this.attrs.SwitchValue, 40)
                                            : ""
                                        // chalk.yellow(" lengthField="), w(this.attrs.LengthField, 40)
                                    );
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
                                        // istanbul ignore next
                                        if (doDebug) {
                                            debugLog(
                                                "field",
                                                field.name,
                                                " is part of a union  => ",
                                                switchField,
                                                " value #",
                                                field.switchValue
                                            );
                                        }
                                        // sometimes (like in Milo, baseType attribute is not specified)
                                        if (!this.parent.attrs.baseType) {
                                            this.parent.attrs.baseType = "Union";
                                            this.parent.structuredType.baseType = "Union";
                                        }
                                    } else {
                                        field.switchBit = structuredType.bitFields
                                            ? structuredType.bitFields!.findIndex((x) => x.name === switchField)
                                            : -2;
                                        // istanbul ignore next
                                        if (doDebug) {
                                            debugLog(
                                                "field",
                                                field.name,
                                                " is optional => ",
                                                switchField,
                                                "bit #",
                                                field.switchBit
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    },
                    finish: function (this: any) {
                        assert(this.attrs.Name === this.structuredType.name);
                        this.parent.typeDictionary.addRaw(this.structuredType);
                    }
                }
            }
        }
    }
};

export interface DataTypeAndEncodingId {
    dataTypeNodeId: NodeId;
    binaryEncodingNodeId: NodeId;
    xmlEncodingNodeId: NodeId;
    jsonEncodingNodeId: NodeId;
}
export interface MapDataTypeAndEncodingIdProvider {
    // getDataTypeNodeId(key: string): NodeId;
    getDataTypeAndEncodingId(key: string): DataTypeAndEncodingId | null;
}

export function parseBinaryXSD(
    xmlString: string,
    idProvider: MapDataTypeAndEncodingIdProvider,
    dataTypeFactory: DataTypeFactory,
    callback: (err?: Error | null) => void
): void {
    const parser = new Xml2Json(state0);
    const typeDictionary = new TypeDictionary();
    (parser as any).typeDictionary = typeDictionary;

    parser.parseString(xmlString, (err?: Error | null) => {
        // resolve and prepare enumerations
        for (const key in typeDictionary.enumeratedTypesRaw) {
            if (!Object.prototype.hasOwnProperty.call(typeDictionary.enumeratedTypesRaw, key)) {
                continue;
            }
            const enumeratedType = typeDictionary.enumeratedTypesRaw[key];
            if (Object.keys(enumeratedType.enumeratedValues).length >= 1) {
                const e = new EnumerationDefinitionSchema({
                    lengthInBits: enumeratedType.lengthInBits || 32,
                    enumValues: enumeratedType.enumeratedValues,
                    name: key
                });
                dataTypeFactory.registerEnumeration(e);
            }
        }

        // istanbul ignore next
        if (doDebug) {
            debugLog("------------------------------- Resolving complex Type");
            typeDictionary.structuredTypesRaw.map((x: any) => debugLog(x.name));
        }

        // create area in navigation order
        function createExplorationOrder(): StructureTypeRaw[] {
            const array: StructureTypeRaw[] = [];
            const map: any = {};

            function visitStructure(structuredType: StructureTypeRaw) {
                if (!structuredType) {
                    return;
                }
                if (map[structuredType.name]) {
                    return;
                }
                if (structuredType.baseType) {
                    const base = typeDictionary.getStructuredTypesRawByName(structuredType.baseType);
                    if (base) {
                        visitStructure(base);
                    }
                }
                for (const f of structuredType.fields) {
                    const fieldType = f.fieldType.split(":")[1];
                    const s = typeDictionary.getStructuredTypesRawByName(fieldType);
                    if (s !== structuredType && s) {
                        visitStructure(s);
                    } else {
                        map[fieldType] = "1";
                    }
                }
                if (!map[structuredType.name]) {
                    map[structuredType.name] = 1;
                    array.push(structuredType);
                }
            }

            for (const structuredType of typeDictionary.structuredTypesRaw) {
                visitStructure(structuredType);
            }
            return array;
        }
        // resolve complex types
        const schemaInVisitingOrder = createExplorationOrder();
        for (const structuredType of schemaInVisitingOrder) {
            debugLog("processing ", chalk.cyan(structuredType.name));
            getOrCreateStructuredTypeSchema(structuredType.name, typeDictionary, dataTypeFactory, idProvider);
        }
        callback(err);
    });
}

export async function parseBinaryXSDAsync(
    xmlString: string,
    idProvider: MapDataTypeAndEncodingIdProvider,
    dataTypeFactory: DataTypeFactory
): Promise<void> {
    debugLog("parseBinaryXSDAsync");
    return new Promise((resolve, reject) => {
        parseBinaryXSD(xmlString, idProvider, dataTypeFactory, (err?: Error | null) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}
