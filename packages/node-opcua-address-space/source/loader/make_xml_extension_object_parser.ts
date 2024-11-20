import { IAddressSpace } from "node-opcua-address-space-base";
import { Byte, coerceInt64, coerceUInt64, Int16, Int32, Int64, SByte, UAString, UInt16, UInt32, UInt64 } from "node-opcua-basic-types";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { coerceNodeId, INodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { EnumDefinition, StructureDefinition } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType, VariantOptions, Variant } from "node-opcua-variant";
import { ReaderState, ReaderStateParserLike, ParserLike, XmlAttributes, IReaderState, Xml2Json, ReaderStateParser } from "node-opcua-xml2json";
import { localizedText_parser } from "./parsers/localized_text_parser";
import { makeQualifiedNameParser } from "./parsers/qualified_name_parser";
import { makeVariantReader } from "./parsers/variant_parser";

const warningLog = make_warningLog(__filename);
const debugLog = make_debugLog(__filename);

function clamp(value: number, minValue: number, maxValue: number) {
    if (value < minValue) {
        warningLog(`invalid value range : ${value} < ${minValue} but should be [${minValue} , ${maxValue}]`);
        return minValue;
    }
    if (value > maxValue) {
        warningLog(`invalid value range : ${value} > ${maxValue} but should be [${minValue} , ${maxValue}]`);
        return maxValue;
    }
    return value;
}

interface Parser<T> extends ReaderStateParserLike {
    value: T | null;
    parent: any;
    text: string;
}
const partials = {
    LocalizedText: localizedText_parser.LocalizedText,
    QualifiedName: makeQualifiedNameParser((nodeId: string) => coerceNodeId(nodeId)).QualifiedName,
    String: <Parser<string>>{
        finish(this: Parser<string>) {
            this.value = this.text;
        }
    },
    Guid: {
        parser: {
            String: <Parser<string>>{
                finish(this: Parser<string>) {
                    this.parent.value = this.text;
                }
            }
        }
    },

    Boolean: <Parser<boolean>>{
        finish(this: Parser<boolean>) {
            this.value = this.text.toLowerCase() === "true" ? true : false;
        }
    },

    ByteString: <Parser<Buffer>>{
        init(this: Parser<Buffer>, name: string, attrs: XmlAttributes, parent: IReaderState, engine: Xml2Json) {
            this.value = null;
        },
        finish(this: Parser<Buffer>) {
            const base64text = this.text;
            const byteString = Buffer.from(base64text, "base64");
            this.value = byteString;
        }
    },

    Float: <Parser<number>> {
        finish(this: Parser<number>) {
            this.value = parseFloat(this.text);
        }
    },

    Double: <Parser<number>> {
        finish(this: Parser<number>) {
            this.value = parseFloat(this.text);
        }
    },
    Byte: <Parser<Byte>>  {
        finish(this: Parser<Byte>) {
            this.value = clamp(parseInt(this.text, 10), 0, 255);
        }
    },
    SByte: <Parser<SByte>> {
        finish(this: Parser<SByte>) {
            this.value = clamp(parseInt(this.text, 10), -128, 127);
        }
    },
    Int8: <Parser<SByte>>  {
        finish(this: Parser<SByte>) {
            this.value = clamp(parseInt(this.text, 10), -128, 127);
        }
    },

    Int16: <Parser<Int16>> {
        finish(this: Parser<Int16>) {
            this.value = clamp(parseInt(this.text, 10), -32768, 32767);
        }
    },
    Int32: <Parser<Int32>>  {
        finish(this: Parser<Int32>) {
            this.value = clamp(parseInt(this.text, 10), -2147483648, 2147483647);
        }
    },
    Int64: <Parser<Int64>>  {
        finish(this: Parser<Int64>) {
            this.value = coerceInt64(parseInt(this.text, 10));
        }
    },

    UInt8: <Parser<Byte>>  {
        finish(this: Parser<Byte>) {
            this.value = clamp(parseInt(this.text, 10), 0, 255);
        }
    },

    UInt16: <Parser<UInt16>>   {
        finish(this: Parser<UInt16>) {
            this.value = clamp(parseInt(this.text, 10), 0, 65535);
        }
    },

    UInt32: <Parser<UInt32>>{
        finish(this: Parser<UInt32>) {
            this.value = clamp(parseInt(this.text, 10), 0, 4294967295);
        }
    },

    UInt64: <Parser<UInt64>>{
        finish(this: Parser<UInt64>) {
            this.value = coerceUInt64(parseInt(this.text, 10));
        }
    },

    DateTime: <Parser<Date>>{
        finish(this: Parser<Date>) {
            // to do check Local or GMT
            this.value = new Date(this.text);
        }
    },

    Variant: {
        finish(this: any) {
            /** to do */
            warningLog(" Missing  Implemntation contact sterfive.com!");
        }
    },

    NodeId: <Parser<NodeId>> {
        finish(this: Parser<NodeId>) {
            // to do check Local or GMT
            this.value = coerceNodeId(this.text);
        }
    }
};

export interface TypeInfo1 {
    name: string;
    definition: StructureDefinition;
}
export interface TypeInfo2 {
    name: string;
    definition: EnumDefinition;
}
export interface TypeInfo3 {
    name: string;
    definition: { dataType: DataType };
}
export type TypeInfo = TypeInfo1 | TypeInfo2 | TypeInfo3;

export interface DefinitionMap2 {
    findDefinition(dataTypeNodeId: NodeId): TypeInfo;
}

function _clone(a: any): any {
    if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") {
        return a;
    }
    if (a instanceof Buffer) {
        return Buffer.from(a);
    }
    if (a instanceof Date) {
        return new Date(a);
    }
    if (a instanceof Array) {
        return a.map((x) => _clone(x));
    }
    return { ...a };
}

function _makeTypeReader(
    dataTypeNodeId1: NodeId,
    definitionMap: DefinitionMap2,
    readerMap: Map<string, ReaderStateParserLike>,
    translateNodeId: (nodeId: string) => NodeId
): { name: string; reader: ReaderStateParser } {
    const n = dataTypeNodeId1 as INodeId;
    if (n.identifierType === NodeIdType.NUMERIC && n.namespace === 0 && n.value === 0) {
        // a generic Extension Object
        return { name: "Variant", reader: partials["Variant"] };
    }

    if (
        n.namespace === 0 &&
        n.identifierType === NodeIdType.NUMERIC &&
        n.value < DataType.ExtensionObject
    ) {
        const name = DataType[n.value as number] as string;
        const reader = partials[name as keyof typeof partials] as ReaderStateParser;
        return { name, reader };
    }

    const { name, definition } = definitionMap.findDefinition(n);

    const dataTypeName = name;

    let reader: ReaderStateParserLike = readerMap.get(dataTypeName)!;

    if (reader) {
        return { name, reader: reader.parser! };
    }

    reader = {
        finish(this: any) {
            /** empty  */
        },
        parser: {
            /** empty  */
        }
    };

    if (definition instanceof StructureDefinition) {
        for (const field of definition.fields || []) {
            const typeReader = _makeTypeReader(field.dataType, definitionMap, readerMap, translateNodeId);
            const fieldParser = typeReader.reader;
            const fieldTypename = typeReader.name;
            // istanbul ignore next
            if (!fieldParser) {
                throw new Error(" Cannot find reader for dataType " + field.dataType + " fieldTypename=" + fieldTypename);
            }

            if (field.valueRank === undefined || field.valueRank === -1) {
                // scalar
                const parser = fieldParser;
                if (!parser) {
                    throw new Error("??? " + field.dataType + "  " + field.name);
                }

                reader.parser![field.name!] = {
                    parser: fieldParser.parser,
                    // endElement: fieldReader.endElement,
                    finish(this: any) {
                        const elName = lowerFirstLetter(field.name!);
                        if (fieldParser.finish) {
                            fieldParser.finish.call(this);
                        } else {
                            debugLog("xxx check " + fieldTypename);
                        }
                        this.parent.value = this.parent.value || Object.create(null);
                        this.parent.value[elName] = _clone(this.value);
                    }
                };
            } else if (field.valueRank === 1) {
                const listReader: ReaderStateParserLike = {
                    init(this: any) {
                        this.value = [];
                    },
                    parser: { /** empty */},
                    finish(this: any) {
                        const elName = lowerFirstLetter(this.name);
                        this.parent.value = this.parent.value || Object.create(null);
                        this.parent.value[elName] = this.value;
                        this.value = undefined;
                    },
                    startElement(name: string, attrs: XmlAttributes) {
                        // empty
                    },
                    endElement(element: string) {
                        this.value.push(_clone(this.parser[element].value));
                    }
                };
                listReader.parser![fieldTypename] = fieldParser;
                reader.parser![field.name!] = listReader;
            } else {
                throw new Error("Unsupported ValueRank !");
            }
        }
        readerMap.set(dataTypeName,reader);
        return { name, reader };
    } else if (definition instanceof EnumDefinition) {
        const turnToInt = (value: any) => {
            // Green_100
            return parseInt(value.split("_")[1], 10);
        };
        return {
            name,
            reader: {
                finish(this: any) {
                    this.value = turnToInt(this.text);
                }
            }
        };
    } else if (definition?.dataType == DataType.Variant) {
        // <Value><String>Foo</String></Value>
        type Task = (addressSpace: any) => Promise<void>;

        let variantOptions: VariantOptions = Object.create(null);

        const variantReader = makeVariantReader(
            (self, data: VariantOptions) => variantOptions = data,
            /*setDeferredValue: */(self,data, deferedTask) => {
                // to do
            },
            /* postExtensionObjectDecoding:*/(task: (addressSpace: IAddressSpace) => Promise<void>) => {
                // to do
            },
            translateNodeId,
        );
        return {
            name,
            reader: {
                init(this: any , name: string, attrs: XmlAttributes, parent: IReaderState, engine: Xml2Json) {
                    this.obj = {};
                },
                ...variantReader,
                finish(this: any & { value: Variant }) {
                    this.value = new Variant(variantOptions);
                }
            }
        };
    } else {
        // basic datatype
        const typeName: string = DataType[definition.dataType];
        const reader = partials[typeName as keyof typeof partials] as ReaderStateParser;
        // istanbul ignore next
        if (!reader) {
            throw new Error("missing parse for " + typeName);
        }
        return { name, reader };
    }
}

export function makeXmlExtensionObjectReader(
    dataTypeNodeId: NodeId,
    definitionMap: DefinitionMap2,
    readerMap: Map<string, ReaderStateParserLike>,
    translateNodeId: (nodeId: string) => NodeId
): ReaderState {
    const { name, definition } = definitionMap.findDefinition(dataTypeNodeId);

    // istanbul ignore next
    if (!(definition instanceof StructureDefinition)) {
        throw new Error("Expecting StructureDefinition");
    }
    //
    const reader1: ReaderStateParser = {
        parser: {},
        endElement(this: any) {
            this._pojo = this.parser[name].value;
        }
    };
    const { reader } = _makeTypeReader(dataTypeNodeId, definitionMap, readerMap, translateNodeId);
    reader1.parser![name] = reader as ReaderStateParserLike;

    return new ReaderState(reader1);
}
