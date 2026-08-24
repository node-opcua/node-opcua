import type { IAddressSpace } from "node-opcua-address-space-base";
import {
    type Byte,
    coerceInt64,
    coerceUInt64,
    type Int16,
    type Int32,
    type Int64,
    type SByte,
    type UInt16,
    type UInt32,
    type UInt64
} from "node-opcua-basic-types";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { coerceNodeId, ExpandedNodeId, type INodeId, type NodeId, NodeIdType } from "node-opcua-nodeid";
import { coerceStatusCode, StatusCodes } from "node-opcua-status-code";
import { EnumDefinition, StructureDefinition } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType, Variant, type VariantOptions } from "node-opcua-variant";
import {
    type IReaderState,
    ReaderState,
    type ReaderStateParser,
    type ReaderStateParserLike,
    type Xml2Json,
    type XmlAttributes
} from "node-opcua-xml2json";
import { localizedText_parser } from "./parsers/localized_text_parser";
import { makeQualifiedNameParser } from "./parsers/qualified_name_parser";
import { makeVariantReader } from "./parsers/variant_parser";

const warningLog = make_warningLog(__filename);
const debugLog = make_debugLog(__filename);

// textual form of an ExpandedNodeId, as found in <ExpandedNodeId><Identifier>...</Identifier></ExpandedNodeId>:
// an optional server index, an optional namespace uri, then a plain nodeId. see OPC UA part 6.
const regexServerIndex = /^svr=([0-9]+);(.*)$/;
const regexNamespaceUri = /^nsu=(.*?);(.*)$/;

function parseExpandedNodeId(text: string): ExpandedNodeId {
    let remaining = text.trim();
    let serverIndex = 0;
    let namespaceUri: string | null = null;

    const serverIndexMatch = remaining.match(regexServerIndex);
    if (serverIndexMatch) {
        serverIndex = parseInt(serverIndexMatch[1], 10);
        remaining = serverIndexMatch[2];
    }
    const namespaceUriMatch = remaining.match(regexNamespaceUri);
    if (namespaceUriMatch) {
        namespaceUri = namespaceUriMatch[1];
        remaining = namespaceUriMatch[2];
    }
    const nodeId = coerceNodeId(remaining);
    return new ExpandedNodeId(nodeId.identifierType, nodeId.value, nodeId.namespace, namespaceUri, serverIndex);
}

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
    parent: Parser<unknown>;
    text: string;
}

// generic loose parser-state shape used by the Xml2Json engine: `this` here is a
// dynamically-populated reader state whose fields (value/parent/text/...) vary by parser,
// see the `this: any` justification in ReaderStateParserLike itself (node-opcua-xml2json).
interface AnyParserState extends ReaderStateParserLike {
    value: unknown;
    parent: AnyParserState;
    text: string;
    name?: string;
    obj?: unknown;
    parser: Record<string, AnyParserState>;
}

// <StatusCode><Code>2153644032</Code></StatusCode>
const statusCode_parser: ReaderStateParserLike = {
    init(this: AnyParserState) {
        this.value = StatusCodes.Good;
    },
    parser: {
        Code: {
            finish(this: AnyParserState) {
                this.parent.value = coerceStatusCode(parseInt(this.text, 10));
            }
        }
    }
};

// a DiagnosticInfo field is stored on the enclosing DiagnosticInfo, which is only
// created when at least one field is present ( <DiagnosticInfo/> stays empty ).
function _diagnosticInfoField(name: string, convert: (text: string) => unknown): ReaderStateParserLike {
    return {
        finish(this: AnyParserState) {
            this.parent.value = this.parent.value || {};
            (this.parent.value as Record<string, unknown>)[name] = convert(this.text);
        }
    };
}

// <DiagnosticInfo><SymbolicId>1</SymbolicId>...<InnerDiagnosticInfo>...</InnerDiagnosticInfo></DiagnosticInfo>
const diagnosticInfo_parser: ReaderStateParserLike = {
    init(this: AnyParserState) {
        this.value = undefined;
    },
    parser: {
        SymbolicId: _diagnosticInfoField("symbolicId", (text) => parseInt(text, 10)),
        NamespaceUri: _diagnosticInfoField("namespaceUri", (text) => parseInt(text, 10)),
        Locale: _diagnosticInfoField("locale", (text) => parseInt(text, 10)),
        LocalizedText: _diagnosticInfoField("localizedText", (text) => parseInt(text, 10)),
        AdditionalInfo: _diagnosticInfoField("additionalInfo", (text) => text),
        InnerStatusCode: {
            ...statusCode_parser,
            finish(this: AnyParserState) {
                this.parent.value = this.parent.value || {};
                (this.parent.value as Record<string, unknown>).innerStatusCode = this.value;
            }
        }
    }
};
// InnerDiagnosticInfo is a DiagnosticInfo in turn: the parser is registered after the
// fact so that it can refer to the reader being built.
if (!diagnosticInfo_parser.parser) {
    throw new Error("internal error: diagnosticInfo_parser.parser must be defined");
}
diagnosticInfo_parser.parser.InnerDiagnosticInfo = {
    ...diagnosticInfo_parser,
    finish(this: AnyParserState) {
        this.parent.value = this.parent.value || {};
        (this.parent.value as Record<string, unknown>).innerDiagnosticInfo = this.value;
    }
};
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
            this.value = this.text.toLowerCase() === "true";
        }
    },

    ByteString: <Parser<Buffer>>{
        init(this: Parser<Buffer>, _name: string, _attrs: XmlAttributes, _parent: IReaderState, _engine: Xml2Json) {
            this.value = null;
        },
        finish(this: Parser<Buffer>) {
            const base64text = this.text;
            const byteString = Buffer.from(base64text, "base64");
            this.value = byteString;
        }
    },

    Float: <Parser<number>>{
        finish(this: Parser<number>) {
            this.value = parseFloat(this.text);
        }
    },

    Double: <Parser<number>>{
        finish(this: Parser<number>) {
            this.value = parseFloat(this.text);
        }
    },
    Byte: <Parser<Byte>>{
        finish(this: Parser<Byte>) {
            this.value = clamp(parseInt(this.text, 10), 0, 255);
        }
    },
    SByte: <Parser<SByte>>{
        finish(this: Parser<SByte>) {
            this.value = clamp(parseInt(this.text, 10), -128, 127);
        }
    },
    Int8: <Parser<SByte>>{
        finish(this: Parser<SByte>) {
            this.value = clamp(parseInt(this.text, 10), -128, 127);
        }
    },

    Int16: <Parser<Int16>>{
        finish(this: Parser<Int16>) {
            this.value = clamp(parseInt(this.text, 10), -32768, 32767);
        }
    },
    Int32: <Parser<Int32>>{
        finish(this: Parser<Int32>) {
            this.value = clamp(parseInt(this.text, 10), -2147483648, 2147483647);
        }
    },
    Int64: <Parser<Int64>>{
        finish(this: Parser<Int64>) {
            this.value = coerceInt64(parseInt(this.text, 10));
        }
    },

    UInt8: <Parser<Byte>>{
        finish(this: Parser<Byte>) {
            this.value = clamp(parseInt(this.text, 10), 0, 255);
        }
    },

    UInt16: <Parser<UInt16>>{
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
        finish(this: AnyParserState) {
            /** to do */
            warningLog(" Missing  Implemntation contact sterfive.com!");
        }
    },

    NodeId: <Parser<NodeId>>{
        finish(this: Parser<NodeId>) {
            // to do check Local or GMT
            this.value = coerceNodeId(this.text);
        }
    },

    StatusCode: statusCode_parser,

    DiagnosticInfo: diagnosticInfo_parser,

    // <ExpandedNodeId><Identifier>svr=1;nsu=http://acme.com/UA/;i=42</Identifier></ExpandedNodeId>
    ExpandedNodeId: <Parser<ExpandedNodeId>>{
        finish(this: Parser<ExpandedNodeId>) {
            this.value = parseExpandedNodeId(this.text);
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

function _clone(a: unknown): unknown {
    if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") {
        return a;
    }
    if (Buffer.isBuffer(a)) {
        return Buffer.from(a);
    }
    if (a instanceof Date) {
        return new Date(a);
    }
    if (Array.isArray(a)) {
        return a.map((x) => _clone(x));
    }
    return { ...(a as Record<string, unknown>) };
}

function _makeTypeReader(
    dataTypeNodeId1: NodeId,
    definitionMap: DefinitionMap2,
    readerMap: Map<string, ReaderStateParserLike>,
    translateNodeId: (nodeId: string) => NodeId
): { name: string; reader: ReaderStateParserLike } {
    const n = dataTypeNodeId1 as INodeId;
    if (n.identifierType === NodeIdType.NUMERIC && n.namespace === 0 && n.value === 0) {
        // a generic Extension Object
        return { name: "Variant", reader: partials.Variant };
    }

    if (n.namespace === 0 && n.identifierType === NodeIdType.NUMERIC && n.value < DataType.ExtensionObject) {
        const name = DataType[n.value as number] as string;
        const reader = partials[name as keyof typeof partials] as ReaderStateParserLike;
        return { name, reader };
    }

    const { name, definition } = definitionMap.findDefinition(n);

    const dataTypeName = name;

    let reader: ReaderStateParserLike | undefined = readerMap.get(dataTypeName);

    if (reader) {
        return { name, reader };
    }

    reader = {
        init(this: AnyParserState) {
            // the same reader instance is used for every element of that data type: the value must be
            // reset here, or the element being read would inherit the fields of the previously read one
            // ( or of the enclosing one, when the structure refers to itself ).
            this.value = undefined;
        },
        finish(this: AnyParserState) {
            /** empty  */
        },
        parser: {
            /** empty  */
        }
    };
    // `reader.parser` is guaranteed defined: it was just set as a literal above, and the
    // ReaderStateParserLike interface only declares it optional for other unrelated call sites.
    const readerParser = reader.parser;
    if (!readerParser) {
        throw new Error("internal error: reader.parser must be defined");
    }

    if (definition instanceof StructureDefinition) {
        // the reader must be registered *before* its fields are explored: a structure may refer to
        // itself, directly or through one of its fields, and the recursion below would never end.
        // `reader` and `reader.parser` keep their identity while being filled, so a nested reference
        // that picks the reader up from the map ends up pointing at the completed reader.
        readerMap.set(dataTypeName, reader);

        for (const field of definition.fields || []) {
            const typeReader = _makeTypeReader(field.dataType, definitionMap, readerMap, translateNodeId);
            const fieldParser = typeReader.reader;
            const fieldTypename = typeReader.name;
            // c8 ignore next
            if (!fieldParser) {
                throw new Error(` Cannot find reader for dataType ${field.dataType} fieldTypename=${fieldTypename}`);
            }

            if (field.valueRank === undefined || field.valueRank === -1) {
                // scalar
                const parser = fieldParser;
                if (!parser) {
                    throw new Error(`??? ${field.dataType}  ${field.name}`);
                }

                readerParser[field.name || ""] = {
                    parser: fieldParser.parser,
                    // the field reader borrows the partial's sub-parsers: it must borrow its init
                    // too, or the state those sub-parsers write into is never set up.
                    init(this: AnyParserState, elementName: string, attrs: XmlAttributes, parent: IReaderState, engine: Xml2Json) {
                        if (fieldParser.init) {
                            fieldParser.init.call(this, elementName, attrs, parent, engine);
                        }
                    },
                    // endElement: fieldReader.endElement,
                    finish(this: AnyParserState) {
                        const elName = lowerFirstLetter(field.name || "");
                        if (fieldParser.finish) {
                            fieldParser.finish.call(this);
                        } else {
                            debugLog(`xxx check ${fieldTypename}`);
                        }
                        this.parent.value = this.parent.value || Object.create(null);
                        (this.parent.value as Record<string, unknown>)[elName] = _clone(this.value);
                    }
                };
            } else if (field.valueRank === 1) {
                const listReader: ReaderStateParserLike = {
                    init(this: AnyParserState) {
                        this.value = [];
                    },
                    parser: {
                        /** empty */
                    },
                    finish(this: AnyParserState) {
                        const elName = lowerFirstLetter(this.name || "");
                        this.parent.value = this.parent.value || Object.create(null);
                        (this.parent.value as Record<string, unknown>)[elName] = this.value;
                        this.value = undefined;
                    },
                    startElement(_name: string, _attrs: XmlAttributes) {
                        // empty
                    },
                    endElement(this: AnyParserState, element: string) {
                        (this.value as unknown[]).push(_clone(this.parser[element].value));
                    }
                };
                const listReaderParser = listReader.parser;
                if (!listReaderParser) {
                    throw new Error("internal error: listReader.parser must be defined");
                }
                listReaderParser[fieldTypename] = fieldParser;
                readerParser[field.name || ""] = listReader;
            } else {
                throw new Error("Unsupported ValueRank !");
            }
        }
        return { name, reader };
    } else if (definition instanceof EnumDefinition) {
        const turnToInt = (value: string) => {
            // Green_100
            return parseInt(value.split("_")[1], 10);
        };
        return {
            name,
            reader: {
                finish(this: AnyParserState) {
                    this.value = turnToInt(this.text);
                }
            }
        };
    } else if (definition?.dataType === DataType.Variant) {
        // <Value><String>Foo</String></Value>
        let variantOptions: VariantOptions = Object.create(null);

        const variantReader = makeVariantReader(
            (_self, data: VariantOptions) => (variantOptions = data),
            /*setDeferredValue: */ (_self, _data, _deferedTask) => {
                // to do
            },
            /* postExtensionObjectDecoding:*/ (_task: (addressSpace: IAddressSpace) => Promise<void>) => {
                // to do
            },
            translateNodeId
        );
        return {
            name,
            reader: {
                init(this: AnyParserState, _name: string, _attrs: XmlAttributes, _parent: IReaderState, _engine: Xml2Json) {
                    this.obj = {};
                },
                ...variantReader,
                finish(this: AnyParserState) {
                    this.value = new Variant(variantOptions);
                }
            }
        };
    } else {
        // basic datatype
        const typeName: string = DataType[definition.dataType];
        const reader = partials[typeName as keyof typeof partials] as ReaderStateParserLike;
        // c8 ignore next
        if (!reader) {
            throw new Error(`missing parse for ${typeName}`);
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

    // c8 ignore next
    if (!(definition instanceof StructureDefinition)) {
        throw new Error("Expecting StructureDefinition");
    }
    //
    interface Reader1State extends IReaderState {
        _pojo?: unknown;
        parser: Record<string, AnyParserState>;
    }
    const reader1 = {
        parser: {} as Record<string, AnyParserState>,
        endElement(this: Reader1State) {
            this._pojo = this.parser[name].value;
        }
    };
    const { reader } = _makeTypeReader(dataTypeNodeId, definitionMap, readerMap, translateNodeId);
    const reader1Parser = reader1.parser;
    if (!reader1Parser) {
        throw new Error("internal error: reader1.parser must be defined");
    }
    reader1Parser[name] = reader as unknown as AnyParserState;

    return new ReaderState(reader1 as unknown as ReaderStateParser);
}
