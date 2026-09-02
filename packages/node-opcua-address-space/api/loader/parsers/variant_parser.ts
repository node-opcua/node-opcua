import { coerceBoolean, coerceInt64, coerceUInt64, DataType, type Int64, isValidGuid, type UInt64 } from "node-opcua-basic-types";
import {
    coerceLocalizedText,
    coerceQualifiedName,
    type LocalizedTextOptions,
    type QualifiedNameOptions
} from "node-opcua-data-model";
import type { ExtensionObject } from "node-opcua-extension-object";
import { type NodeId, type NodeIdLike, resolveNodeId } from "node-opcua-nodeid";
import { VariantArrayType, type VariantOptions } from "node-opcua-variant";
import type { IReaderState, ParserLike, ReaderStateParserLike, Xml2Json, XmlAttributes } from "node-opcua-xml2json";
import { XmlExtensionObjectFragment } from "../nodeset_record.js";
import { makeExtensionObjectInnerParser, makeExtensionObjectParser } from "./extension_object_parser.js";
import { type LocalizedTextParserLikeL1, localizedText_parser } from "./localized_text_parser.js";
import { makeNodeIdParser } from "./nodeid_parser.js";
import { makeQualifiedNameParser, type QualifiedNameParserL1 } from "./qualified_name_parser.js";

type IBasicReaderStateParserLike<T> = ReaderStateParserLike & {
    value: T | undefined;
    text: string;
};

function BasicType_parser<T>(dataType: string, parseFunc: (this: { value: T | undefined }, text: string) => T): ParserLike {
    const _parser: Record<string, ReaderStateParserLike> = {};
    const a = {
        init(this: IBasicReaderStateParserLike<T>, _name: string, _attrs: XmlAttributes, _parent: IReaderState, _engine: Xml2Json) {
            this.value = undefined;
        },
        finish(this: IBasicReaderStateParserLike<T>) {
            this.value = parseFunc.call(this, this.text);
        }
    };
    _parser[dataType] = a as ReaderStateParserLike;
    return _parser as ParserLike;
}

function ListOf<T>(
    _setValue: (data: VariantOptions) => void,
    dataType: string,
    parseFunc: (this: { value: T | undefined }, text: string) => T
) {
    return {
        init(this: ListOfTParser<T>) {
            this.listData = [];
        },

        parser: BasicType_parser<T>(dataType, parseFunc),

        finish(this: ListOfTParser<T>) {
            _setValue({
                arrayType: VariantArrayType.Array,
                dataType: (DataType as unknown as Record<string, number>)[dataType] as DataType,
                value: this.listData
            });
        },
        endElement(this: ListOfTParser<T>, _element: string) {
            this.listData.push(this.parser[dataType].value as T);
        }
    };
}

interface Parser {
    parent?: Parser;
    obj?: { nodeId: NodeId };
}

export interface ListOfTParser<T> extends Parser {
    listData: T[];
    parent: Parser;
    parser: {
        [key: string]: ReaderStateParserLike & { value?: T; nodeId?: NodeId | string };
    };
}
function parser2(_setValue: (data: VariantOptions) => void, type: string, p: (text: string) => unknown): ReaderStateParserLike {
    return {
        finish(this: { text: string }) {
            _setValue({
                arrayType: VariantArrayType.Scalar,
                dataType: (DataType as unknown as Record<string, number>)[type] as DataType,
                value: p(this.text)
            });
        }
    };
}
const parseUInt64 = (str: string): UInt64 => coerceUInt64(str);
const parseInt64 = (str: string): Int64 => coerceInt64(str);

/** an element of an ExtensionObject array as the reader leaves it: decoded, or waiting as its XML */
export type ExtensionObjectOrFragment = ExtensionObject | XmlExtensionObjectFragment;

export interface ListOfExtensionObjectParser extends ListOfTParser<ExtensionObjectOrFragment> {
    listExtensionObject: ExtensionObjectOrFragment[];
    parser: {
        ExtensionObject: ParserLike;
    };
}

/**
 * an ExtensionObject value whose XML the reader could not decode holds a placeholder; a value
 * used where only decoded objects can go (a Variant field of a structure) drops it, as before
 */
export function withoutXmlFragments(options: VariantOptions): VariantOptions {
    if (options.dataType !== DataType.ExtensionObject) {
        return options;
    }
    const value = options.value;
    if (value instanceof XmlExtensionObjectFragment) {
        return { ...options, value: null };
    }
    if (Array.isArray(value) && value.some((e) => e instanceof XmlExtensionObjectFragment)) {
        return { ...options, value: value.map((e) => (e instanceof XmlExtensionObjectFragment ? null : e)) };
    }
    return options;
}

/**
 * the reader of a `<Value>` element: `setValue` receives the value as `VariantOptions`, with the
 * ids it holds resolved through `translateNodeId`; an extension object the reader cannot decode
 * on the spot is left in the value as an {@link XmlExtensionObjectFragment}, for the consumer of
 * the record to decode once the data types are known
 */
export function makeVariantReader<T extends ReaderStateParserLike>(
    setValue: (self: T, data: VariantOptions) => void,
    translateNodeId: (nodeId: string) => NodeId
): ReaderStateParserLike {
    let self: T;
    const setValue2 = (data: VariantOptions) => {
        setValue(self, data);
    };
    const reader = {
        init(this: ReaderStateParserLike) {
            /* empty */
            self = this as T;
        },
        parser: {
            QualifiedName: {
                ...makeQualifiedNameParser(translateNodeId).QualifiedName,
                finish(this: QualifiedNameParserL1) {
                    setValue2({
                        dataType: DataType.QualifiedName,
                        value: coerceQualifiedName({ ...this.qualifiedName })
                    });
                }
            },
            LocalizedText: {
                ...localizedText_parser.LocalizedText,
                finish(this: LocalizedTextParserLikeL1) {
                    setValue2({
                        dataType: DataType.LocalizedText,
                        value: coerceLocalizedText({ ...this.localizedText })
                    });
                }
            },
            XmlElement: {
                finish(this: { text: string }) {
                    setValue2({
                        dataType: DataType.XmlElement,
                        value: this.text
                    });
                }
            },
            String: {
                finish(this: { text: string }) {
                    setValue2({
                        dataType: DataType.String,
                        value: this.text
                    });
                }
            },
            Guid: {
                parser: {
                    String: {
                        finish(this: { text: string }) {
                            const guid = this.text;
                            if (!isValidGuid(guid)) {
                                /* ?*/
                            }
                            setValue2({
                                dataType: DataType.Guid,
                                arrayType: VariantArrayType.Scalar,
                                value: this.text
                            });
                        }
                    }
                }
            },
            NodeId: {
                parser: {
                    Identifier: {
                        finish(this: { text: string }) {
                            const nodeId = this.text;
                            setValue2({
                                dataType: DataType.NodeId,
                                arrayType: VariantArrayType.Scalar,
                                value: translateNodeId(resolveNodeId(nodeId).toString())
                            });
                        }
                    }
                }
            },
            Boolean: parser2(setValue2, "Boolean", coerceBoolean),
            Byte: parser2(setValue2, "Byte", parseInt),
            Int16: parser2(setValue2, "Int16", parseInt),
            Int32: parser2(setValue2, "Int32", parseInt),
            Int8: parser2(setValue2, "Int8", parseInt),
            SByte: parser2(setValue2, "SByte", parseInt),
            UInt16: parser2(setValue2, "UInt16", parseInt),
            UInt32: parser2(setValue2, "UInt32", parseInt),
            UInt8: parser2(setValue2, "UInt8", parseInt),

            UInt64: parser2(setValue2, "UInt64", parseUInt64),
            Int64: parser2(setValue2, "Int64", parseInt64),

            ByteString: {
                init(this: { value: Buffer | null; text: string }) {
                    this.value = null;
                },
                finish(this: { value: Buffer | null; text: string }) {
                    const base64text = this.text;
                    const byteString = Buffer.from(base64text, "base64");
                    setValue2({
                        arrayType: VariantArrayType.Scalar,
                        dataType: DataType.ByteString,
                        value: byteString
                    });
                }
            },
            Float: {
                finish(this: { text: string }) {
                    setValue2({
                        dataType: DataType.Float,
                        value: parseFloat(this.text)
                    });
                }
            },

            Double: {
                finish(this: { text: string }) {
                    setValue2({
                        dataType: DataType.Double,
                        value: parseFloat(this.text)
                    });
                }
            },

            ExtensionObject: makeExtensionObjectInnerParser<ListOfExtensionObjectParser>(
                translateNodeId,
                (extensionObject: ExtensionObject) => {
                    setValue2({
                        dataType: DataType.ExtensionObject,
                        value: extensionObject
                    });
                },
                (xmlEncodingNodeId: NodeId, bodyXML: string, _data) => {
                    setValue2({
                        dataType: DataType.ExtensionObject,
                        arrayType: VariantArrayType.Scalar,
                        value: new XmlExtensionObjectFragment(xmlEncodingNodeId, bodyXML)
                    });
                }
            ),

            ListOfExtensionObject: {
                init(this: ListOfExtensionObjectParser) {
                    this.listExtensionObject = [];
                },
                parser: makeExtensionObjectParser<ListOfExtensionObjectParser>(
                    translateNodeId,
                    (extensionObject: ExtensionObject, self) => {
                        self.listExtensionObject.push(extensionObject);
                    },
                    (xmlEncodingNodeId: NodeId, bodyXML: string, self) => {
                        self.listExtensionObject.push(new XmlExtensionObjectFragment(xmlEncodingNodeId, bodyXML));
                    }
                ),
                finish(this: ListOfExtensionObjectParser) {
                    setValue2({
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.ExtensionObject,
                        value: this.listExtensionObject
                    });
                    this.listExtensionObject = [];
                }
            },

            ListOfLocalizedText: {
                init(this: ListOfTParser<LocalizedTextOptions>) {
                    this.listData = [];
                },
                parser: {
                    ...localizedText_parser
                },
                endElement(this: ListOfTParser<QualifiedNameOptions> /*element*/) {
                    this.listData.push(this.parser.LocalizedText.value as QualifiedNameOptions);
                },
                finish(this: ListOfTParser<QualifiedNameOptions>) {
                    setValue2({
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.LocalizedText,
                        value: this.listData
                    });
                }
            },
            ListOfQualifiedName: {
                init(this: ListOfTParser<QualifiedNameOptions>) {
                    this.listData = [];
                },
                parser: makeQualifiedNameParser(translateNodeId),
                endElement(this: ListOfTParser<QualifiedNameOptions> /*element*/) {
                    this.listData.push(this.parser.QualifiedName.value as QualifiedNameOptions);
                },
                finish(this: ListOfTParser<QualifiedNameOptions>) {
                    setValue2({
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.QualifiedName,
                        value: this.listData
                    });
                }
            },
            ListOfNodeId: {
                init(this: ListOfTParser<NodeIdLike>) {
                    this.listData = [];
                },
                parser: makeNodeIdParser(translateNodeId),
                endElement(this: ListOfTParser<NodeIdLike>, _elementName: string) {
                    this.listData.push(this.parser.NodeId.nodeId as NodeIdLike);
                },
                finish(this: ListOfTParser<NodeIdLike>) {
                    setValue2({
                        arrayType: VariantArrayType.Array,
                        dataType: DataType.NodeId,
                        value: this.listData
                    });
                }
            },

            ListOfBoolean: ListOf<boolean>(setValue2, "Boolean", coerceBoolean),

            ListOfByte: ListOf<number>(setValue2, "Byte", parseInt),

            ListOfDouble: ListOf<number>(setValue2, "Double", parseFloat),

            ListOfFloat: ListOf<number>(setValue2, "Float", parseFloat),

            ListOfInt32: ListOf<number>(setValue2, "Int32", parseInt),

            ListOfInt16: ListOf<number>(setValue2, "Int16", parseInt),

            ListOfInt8: ListOf<number>(setValue2, "Int8", parseInt),

            ListOfUInt32: ListOf<number>(setValue2, "UInt32", parseInt),

            ListOfUInt16: ListOf<number>(setValue2, "UInt16", parseInt),

            ListOfUInt8: ListOf<number>(setValue2, "UInt8", parseInt),

            ListOfString: ListOf<string>(setValue2, "String", (value: string) => value),

            ListOfXmlElement: ListOf<string>(setValue2, "XmlElement", (value: string) => value)
        }
    };
    return reader as unknown as ReaderStateParserLike;
}
