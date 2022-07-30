import { Byte, coerceInt64, coerceUInt64, Int16, Int32, Int64, SByte, UAString, UInt16, UInt32, UInt64 } from "node-opcua-basic-types";
import { LocalizedTextOptions } from "node-opcua-data-model";
import { make_debugLog, make_warningLog } from "node-opcua-debug";
import { coerceNodeId, NodeId, NodeIdType } from "node-opcua-nodeid";
import { EnumDefinition, StructureDefinition } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import { ReaderState, ReaderStateParserLike, ParserLike, XmlAttributes } from "node-opcua-xml2json";

const warningLog = make_warningLog(__filename);
const debugLog = make_debugLog(__filename);

export interface QualifiedNameOptions {
    namespaceIndex?: UInt16;
    name?: UAString;
}
interface QualifiedNameParserChild {
    parent: {
        qualifiedName: QualifiedNameOptions;
    };
    text: string;
}
interface QualifiedNameParser {
    value: QualifiedNameOptions;
    qualifiedName: QualifiedNameOptions;
    text: string;
}

const qualifiedNameReader: ReaderStateParserLike = {
    init(this: QualifiedNameParser) {
        this.qualifiedName = {};
        this.value = {};
    },
    parser: {
        Name: {
            finish(this: QualifiedNameParserChild) {
                this.parent.qualifiedName.name = this.text.trim();
            }
        },
        NamespaceIndex: {
            finish(this: QualifiedNameParserChild) {
                const ns = parseInt(this.text, 10);
                this.parent.qualifiedName.namespaceIndex = ns;
            }
        }
    },
    finish(this: QualifiedNameParser) {
        this.value = this.qualifiedName;
        this.value.name = "qdqsdqs";
    }
};

interface LocalizedTextParser {
    localizedText: LocalizedTextOptions;
    value: LocalizedTextOptions;
}
interface LocalizedTextChildParser {
    parent: LocalizedTextParser;
    text: string;
}
const localizedTextReader: ReaderStateParserLike = {
    init(this: LocalizedTextParser) {
        this.localizedText = {};
    },
    parser: {
        Locale: {
            finish(this: LocalizedTextChildParser) {
                this.parent.localizedText = this.parent.localizedText || {};
                this.parent.localizedText.locale = this.text.trim();
            }
        },
        Text: {
            finish(this: LocalizedTextChildParser) {
                this.parent.localizedText = this.parent.localizedText || {};
                this.parent.localizedText.text = this.text.trim();
            }
        }
    },
    finish(this: LocalizedTextParser) {
        this.value = this.localizedText;
    }
};

function clamp(value: number, minValue: number, maxValue: number) {
    if (value< minValue) {
        warningLog(`invalid value range : ${value} < ${minValue} but should be [${minValue} , ${maxValue}]`);
        return minValue;
    }
    if (value > maxValue) {
        warningLog(`invalid value range : ${value} > ${maxValue} but should be [${minValue} , ${maxValue}]`);
        return maxValue;
    }
    return value;
}

interface Parser<T> {
    value: T | null;
    parent: any;
    text: string;
}
const partials: { [key: string]: ReaderStateParserLike } = {
    LocalizedText: localizedTextReader,
    QualifiedName: qualifiedNameReader,
    String: {
        finish(this: Parser<string>) {
            this.value = this.text;
        }
    },
    Guid: {
        parser: {
            String: {
                finish(this: Parser<string>) {
                    this.parent.value = this.text;
                }
            }
        }
    },

    Boolean: {
        finish(this: Parser<boolean>) {
            this.value = this.text.toLowerCase() === "true" ? true : false;
        }
    },

    ByteString: {
        init(this: Parser<Buffer>) {
            this.value = null;
        },
        finish(this: any) {
            const base64text = this.text;
            const byteString = Buffer.from(base64text, "base64");
            this.value = byteString;
        }
    },

    Float: {
        finish(this: Parser<number>) {
            this.value = parseFloat(this.text);
        }
    },

    Double: {
        finish(this: Parser<number>) {
            this.value = parseFloat(this.text);
        }
    },
    Byte: {
        finish(this: Parser<Byte>) {
            this.value = clamp(parseInt(this.text, 10), 0, 255);
        }
    },
    SByte: {
        finish(this: Parser<SByte>) {
            this.value = clamp(parseInt(this.text, 10), -128, 127);
        }
    },
    Int8: {
        finish(this: Parser<SByte>) {
            this.value = clamp(parseInt(this.text, 10), -128, 127);
        }
    },

    Int16: {
        finish(this: Parser<Int16>) {
            this.value = clamp(parseInt(this.text, 10), -32768, 32767);
        }
    },
    Int32: {
        finish(this: Parser<Int32>) {
            this.value = clamp(parseInt(this.text, 10), -2147483648, 2147483647);
        }
    },
    Int64: {
        finish(this: Parser<Int64>) {
            this.value = coerceInt64(parseInt(this.text, 10));
        }
    },

    UInt8: {
        finish(this: Parser<Byte>) {
            this.value = clamp(parseInt(this.text, 10), 0, 255);
        }
    },

    UInt16: {
        finish(this: Parser<UInt16>) {
            this.value = clamp(parseInt(this.text, 10), 0, 65535);
        }
    },

    UInt32: {
        finish(this: Parser<UInt32>) {
            this.value = clamp(parseInt(this.text, 10), 0, 4294967295);
        }
    },

    UInt64: {
        finish(this: Parser<UInt64>) {
            this.value = coerceUInt64(parseInt(this.text, 10));
        }
    },

    DateTime: {
        finish(this: Parser<Date>) {
            // to do check Local or GMT
            this.value = new Date(this.text);
        }
    },

    Variant: {
        finish(this: any) {
            /** to do */
            console.log(" Missing  Implemntation contact sterfive.com!");
        }
    },

    NodeId: {
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
    dataTypeNodeId: NodeId,
    definitionMap: DefinitionMap2,
    readerMap: Record<string, ReaderStateParserLike>
): { name: string; parser: ReaderStateParserLike } {
    if (dataTypeNodeId.namespace === 0 && dataTypeNodeId.value === 0) {
        // a generic Extension Object
        return { name: "Variant", parser: partials["Variant"] };
    }
    if (
        dataTypeNodeId.namespace === 0 &&
        dataTypeNodeId.identifierType === NodeIdType.NUMERIC &&
        dataTypeNodeId.value < DataType.ExtensionObject
    ) {
        const name = DataType[dataTypeNodeId.value as number] as string;
        const parser = partials[name];
        return { name, parser };
    }

    const { name, definition } = definitionMap.findDefinition(dataTypeNodeId);
    const dataTypeName = name;

    // console.log("NAME = ", dataTypeNodeId.toString(), name, definition);

    let reader: ReaderStateParserLike = readerMap[dataTypeName]!;

    if (reader) {
        return { name, parser: reader.parser! };
    }

    reader = {
        finish(this: any) {
            /** empty  */
        },
        parser: {}
    };

    if (definition instanceof StructureDefinition) {
        for (const field of definition.fields || []) {
            const typeReader = _makeTypeReader(field.dataType, definitionMap, readerMap);
            const fieldParser = typeReader.parser;
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
                        this.parent.value = this.parent.value || {};
                        this.parent.value[elName] = _clone(this.value);
                    }
                };
            } else if (field.valueRank === 1) {
                const listReader: ReaderStateParserLike = {
                    init(this: any) {
                        this.value = [];
                    },
                    parser: {},
                    finish(this: any) {
                        const elName = lowerFirstLetter(this.name);
                        this.parent.value = this.parent.value || {};
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
        // xx const parser: ParserLike = {};
        // xx parser[definition.name] = reader;
        readerMap[dataTypeName] = reader;
        return { name, parser: reader };
    } else if (definition instanceof EnumDefinition) {
        //  console.log("xxxx enum found !", definition.toString());
        const turnToInt = (value: any) => {
            // Green_100
            return parseInt(value.split("_")[1], 10);
        };
        return {
            name,
            parser: {
                finish(this: any) {
                    this.value = turnToInt(this.text);
                }
            }
        };
    } else {
        // basic datatype
        const typeName: string = DataType[definition.dataType];
        const parser = partials[typeName];
        // istanbul ignore next
        if (!parser) {
            throw new Error("missing parse for " + typeName);
        }
        return { name, parser };
    }
}

export function makeXmlExtensionObjectReader(
    dataTypeNodeId: NodeId,
    definitionMap: DefinitionMap2,
    readerMap: Record<string, ReaderStateParserLike>
): ReaderState {
    const { name, definition } = definitionMap.findDefinition(dataTypeNodeId);

    // istanbul ignore next
    if (!(definition instanceof StructureDefinition)) {
        throw new Error("Expecting StructureDefinition");
    }
    //
    const reader1: ReaderStateParserLike = {
        parser: {},
        endElement(this: any) {
            this._pojo = this.parser[name].value;
        }
    };
    const { parser } = _makeTypeReader(dataTypeNodeId, definitionMap, readerMap);
    reader1.parser![name] = parser;

    return new ReaderState(reader1);
}
