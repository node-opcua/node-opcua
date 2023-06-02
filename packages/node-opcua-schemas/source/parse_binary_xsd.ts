/**
 * @module node-opcua-schemas
 */
// tslint:disable:object-literal-sort-keys
// tslint:disable:no-empty

import chalk from "chalk";

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

export interface EnumeratedType {
    name: string;
    documentation?: string;
    enumeratedValues: any;
    lengthInBits?: number;
}

export interface StructureTypeRaw {
    name: string;
    baseType: string;
    base?: StructureTypeRaw;
    fields: any[];
}

export interface ITypeDictionary {
    targetNamespace: string;
    defaultByteOrder: string;
    imports: string[];
}

export class InternalTypeDictionary implements ITypeDictionary {
    public targetNamespace = "";
    public defaultByteOrder = "";
    public imports: string[] = [];

    private structuredTypesRaw: Record<string, StructureTypeRaw> = {};
    private enumeratedTypesRaw: Record<string, EnumeratedType> = {};

    // tns: "http://opcfoundation.org/a/b"
    public _namespaces: Record<string, string> = {};

    constructor() {
        /**  */
    }
    public addEnumeration(name: string, e: EnumeratedType): void {
        this.enumeratedTypesRaw[name] = e;
    }
    public getEnumerations(): EnumeratedType[] {
        return Object.values(this.enumeratedTypesRaw);
    }
    public getStructures(): StructureTypeRaw[] {
        return Object.values(this.structuredTypesRaw);
    }
    public addStructureRaw(structuredType: StructureTypeRaw): void {
        this.structuredTypesRaw[structuredType.name] = structuredType;
    }
    public getStructuredTypesRawByName(name: string): StructureTypeRaw {
        name = name.split(":")[1] || name;
        return this.structuredTypesRaw[name]! as StructureTypeRaw;
    }
}

interface _IParser {
    attrs: any;
    text?: string;
}
interface ITypeDefinitionParser extends _IParser {
    typeDictionary: InternalTypeDictionary;
    engine: { typeDictionary: InternalTypeDictionary };
}
interface IEnumeratedTypeParser extends _IParser {
    typescriptDefinition: string;
    enumeratedType: EnumeratedType;
    parent: { typeDictionary: InternalTypeDictionary };
}
interface IEnumeratedTypeDocumentParser extends _IParser {
    parent: IEnumeratedTypeParser;
}

interface IEnumeratedTypeEnumeratedValueParser extends _IParser {
    parent: IEnumeratedTypeParser;
}
interface IStructureTypeParser extends _IParser {
    structuredType: Omit<StructuredTypeOptions, "dataTypeFactory">;
    parent: { typeDictionary: InternalTypeDictionary };
}
interface IImportParser extends _IParser {
    parent: { typeDictionary: InternalTypeDictionary };
}
interface IStructureTypeFieldParser extends _IParser {
    parent: IStructureTypeParser;
}
/* tslint:disable:object-literal-shorthand */
const state0: any = {
    init: () => {
        const a = 1;
    },
    parser: {
        TypeDictionary: {
            init: function (this: ITypeDefinitionParser, name: string, attributes: Record<string, string>) {
                this.typeDictionary = this.engine.typeDictionary;
                this.typeDictionary.defaultByteOrder = attributes.DefaultByteOrder;
                this.typeDictionary.targetNamespace = attributes.TargetNamespace;

                for (const [k, v] of Object.entries(attributes)) {
                    if (k.match(/xmlns:/)) {
                        const ns = k.split(":")[1];
                        this.typeDictionary._namespaces[ns] = v;
                        this.typeDictionary._namespaces[v] = ns;
                    }
                }
            },
            parser: {
                Import: {
                    init: function (this: IImportParser, name: string, attributes: any) {
                        this.parent.typeDictionary.imports.push(attributes.Namespace);
                    },
                    finish: function (this: IImportParser) {
                        // _register_namespace_uri(this.text);
                        // istanbul ignore next
                        if (doDebug) {
                            debugLog("Import NameSpace = ", this.attrs.Namespace, " Location", this.attrs.Location);
                        }
                    }
                },

                EnumeratedType: {
                    init: function (this: IEnumeratedTypeParser) {
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
                            finish: function (this: IEnumeratedTypeDocumentParser) {
                                this.parent.enumeratedType.documentation = this.text;
                            }
                        },
                        EnumeratedValue: {
                            finish: function (this: IEnumeratedTypeEnumeratedValueParser) {
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
                    finish: function (this: IEnumeratedTypeParser) {
                        this.typescriptDefinition += `\n}`;
                        this.parent.typeDictionary.addEnumeration(this.attrs.Name, this.enumeratedType);
                        // istanbul ignore next
                        if (doDebug) {
                            debugLog(" this.typescriptDefinition  = ", this.typescriptDefinition);
                        }
                    }
                },
                StructuredType: {
                    init: function (this: IStructureTypeParser) {
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

                        const structuredType: Omit<StructuredTypeOptions, "dataTypeFactory"> = {
                            name: this.attrs.Name,
                            baseType,
                            fields: []
                        };
                        this.structuredType = structuredType;
                    },
                    parser: {
                        Field: {
                            finish: function (this: IStructureTypeFieldParser) {
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

                                const field: FieldInterfaceOptions = {
                                    name: this.attrs.Name,
                                    fieldType: this.attrs.TypeName
                                };

                                const structuredType = this.parent.structuredType;
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
                    finish: function (this: IStructureTypeParser) {
                        assert(this.attrs.Name === this.structuredType.name);
                        this.parent.typeDictionary.addStructureRaw(this.structuredType);
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
interface WithTypeDictionary extends Xml2Json {
    typeDictionary: InternalTypeDictionary;
}
export function parseBinaryXSD(
    xmlString: string,
    idProvider: MapDataTypeAndEncodingIdProvider,
    dataTypeFactory: DataTypeFactory,
    callback: (err?: Error | null) => void
): void {
    const parser = new Xml2Json(state0) as WithTypeDictionary;
    const typeDictionary = new InternalTypeDictionary();
    parser.typeDictionary = typeDictionary;
    if (!xmlString || xmlString.length === 0) {
        return callback();
    }
    parser.parseString(xmlString, (err?: Error | null) => {
        // resolve and prepare enumerations
        for (const enumeratedType of typeDictionary.getEnumerations()) {
            if (Object.keys(enumeratedType.enumeratedValues).length >= 1) {
                const e = new EnumerationDefinitionSchema(NodeId.nullNodeId, {
                    lengthInBits: enumeratedType.lengthInBits || 32,
                    enumValues: enumeratedType.enumeratedValues,
                    name: enumeratedType.name
                });
                dataTypeFactory.registerEnumeration(e);
            }
        }

        // istanbul ignore next
        if (doDebug) {
            debugLog("------------------------------- Resolving complex Type");
            typeDictionary.getStructures().map((x: any) => debugLog(x.name));
        }

        // create area in navigation order
        function createExplorationOrder(): StructureTypeRaw[] {
            const array: StructureTypeRaw[] = [];
            const _map: Record<string, string> = {};
            function alreadyVisited(name: string) {
                name = name.split(":")[1] || name;
                return !!_map[name];
            }
            function markAsVisited(name: string) {
                name = name.split(":")[1] || name;
                _map[name] = "1";
            }
            function visitStructure(structuredType: StructureTypeRaw) {
                if (!structuredType || structuredType.name === "ua:ExtensionObject") {
                    return;
                }
                if (alreadyVisited(structuredType.name)) {
                    return;
                }
                markAsVisited(structuredType.name);
                if (structuredType.baseType && structuredType.baseType !== "ua:ExtensionObject") {
                    const base = typeDictionary.getStructuredTypesRawByName(structuredType.baseType);
                    if (base && base.baseType) {
                        doDebug && debugLog("  investigating  base", chalk.cyan(base.name));
                        visitStructure(base);
                    }
                }
                for (const f of structuredType.fields) {
                    const s = typeDictionary.getStructuredTypesRawByName(f.fieldType);
                    if (s !== structuredType && s) {
                        visitStructure(s);
                    } else {
                        markAsVisited(f.fieldType);
                    }
                }
                doDebug && debugLog("processing ", chalk.cyan(structuredType.name));
                array.push(structuredType);
            }

            for (const structuredType of typeDictionary.getStructures()) {
                visitStructure(structuredType);
            }
            return array;
        }
        // resolve complex types
        const schemaInVisitingOrder = createExplorationOrder();
        for (const structuredType of schemaInVisitingOrder) {
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
