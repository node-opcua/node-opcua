import { BasicTypeDefinition } from "node-opcua-factory";
import { NodeId, NodeIdType } from "node-opcua-nodeid";
import { EnumDefinition, StructureDefinition } from "node-opcua-types";
import { lowerFirstLetter } from "node-opcua-utils";
import { DataType } from "node-opcua-variant";
import { ReaderState, ReaderStateParserLike, ParserLike, XmlAttributes } from "node-opcua-xml2json";

function BasicType_parser(dataType: string, parseFunc: (this: any, text: string) => any): ParserLike {
    const r: ReaderStateParserLike = {
        init(this: any, elementName: string, attrs: XmlAttributes) {
            this.value = undefined;
        },
        finish(this: any) {
            this.value = parseFunc.call(this, this.text);
        }
    };
    const _parser: ParserLike = {};
    _parser[dataType] = r;
    return _parser;
}

function ListOf(dataType: string, parseFunc: any) {
    return {
        init(this: any) {
            this.value = [];
        },

        parser: BasicType_parser(dataType, parseFunc),

        finish(this: any) {
            /** empty  */
        },
        endElement(this: any, elementName: string) {
            this.value.push(this.parser[elementName].value);
        }
    };
}

const localizedTextReader: ReaderStateParserLike = {
    init(this: any) {
        this.localizedText = {};
    },
    parser: {
        Locale: {
            finish(this: any) {
                this.parent.localizedText = this.parent.localizedText || {};
                this.parent.localizedText.locale = this.text.trim();
            }
        },
        Text: {
            finish(this: any) {
                this.parent.localizedText = this.parent.localizedText || {};
                this.parent.localizedText.text = this.text.trim();
            }
        }
    },
    finish(this: any) {
        this.value = this.localizedText;
    }
};

const partials: { [key: string]: ReaderStateParserLike } = {
    LocalizedText: localizedTextReader,
    String: {
        finish(this: any) {
            this.value = this.text;
        }
    },

    Boolean: {
        finish(this: any) {
            this.value = this.text.toLowerCase() === "true";
        }
    },

    ByteString: {
        init(this: any) {
            this.value = null;
        },
        finish(this: any) {
            const base64text = this.text;
            const byteString = Buffer.from(base64text, "base64");
            this.value = byteString;
        }
    },

    Float: {
        finish(this: any) {
            this.value = parseFloat(this.text);
        }
    },

    Double: {
        finish(this: any) {
            this.value = parseFloat(this.text);
        }
    },
    Byte: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },
    SByte: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },
    Int8: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },

    Int16: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },
    Int32: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },
    Int64: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },

    UInt8: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },

    UInt16: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },
    UInt32: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },
    UInt64: {
        finish(this: any) {
            this.value = parseInt(this.text, 10);
        }
    },
    DateTime: {
        finish(this: any) {
            // to do check Local or GMT
            this.value = new Date(this.text);
        }
    },
    Variant: {
        finish(this: any) {
            /** to do */
        }
    }
    // ListOfLocalizedText: {
    //     init(this: any) {
    //         this.value = [];
    //     },
    //     parser: { LocalizedText: localizedTextReader },
    //     finish(this: any) {
    //         /** empty  */
    //     },
    //     endElement(this: any /*element*/) {
    //         this.value.push(this.parser.LocalizedText.value);
    //     }
    // },

    // ListOfDouble: ListOf("Double", parseFloat),

    // ListOfFloat: ListOf("Float", parseFloat),

    // ListOfInt32: ListOf("Int32", parseInt),

    // ListOfInt16: ListOf("Int16", parseInt),

    // ListOfInt8: ListOf("Int8", parseInt),

    // ListOfUint32: ListOf("Uint32", parseInt),

    // ListOfUint16: ListOf("Uint16", parseInt),

    // ListOfUint8: ListOf("Uint8", parseInt)
};

interface Field {
    dataType: any;
    description?: string;
    name: string;
    value?: any;
    valueRank?: number; // default is -1 => scalar
}

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
            const a = _makeTypeReader(field.dataType, definitionMap, readerMap);
            const fieldParser = a.parser;
            const fieldTypename = a.name;
            // istanbul ignore next
            if (!fieldParser) {
                throw new Error(" Cannot find reader for dataType " + field.dataType + " fieldTypename=" + fieldTypename);
            }

            if (field.valueRank === undefined || field.valueRank === -1) {
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
                            console.log(" check " + fieldTypename);
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
    } else if (definition instanceof EnumDefinition) {
        console.log(" enum not handled yet", definition);
    } else {
        // basic datatype
        const typeName = DataType[definition.dataType as number] as string;
        const parser = partials[typeName];
        // istanbul ignore next
        if (!parser) {
            throw new Error("missing parse for " + typeName);
        }
        return { name, parser };
    }
    return { name, parser: reader };
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
