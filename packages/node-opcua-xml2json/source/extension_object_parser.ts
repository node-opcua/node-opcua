import { lowerFirstLetter } from "node-opcua-utils";
import { ReaderState, ReaderStateParserLike, ParserLike, XmlAttributes } from "./xml2json";

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

    ListOfLocalizedText: {
        init(this: any) {
            this.value = [];
        },
        parser: { LocalizedText: localizedTextReader },
        finish(this: any) {
            /** empty  */
        },
        endElement(this: any /*element*/) {
            this.value.push(this.parser.LocalizedText.value);
        }
    },

    ListOfDouble: ListOf("Double", parseFloat),

    ListOfFloat: ListOf("Float", parseFloat),

    ListOfInt32: ListOf("Int32", parseInt),

    ListOfInt16: ListOf("Int16", parseInt),

    ListOfInt8: ListOf("Int8", parseInt),

    ListOfUint32: ListOf("Uint32", parseInt),

    ListOfUint16: ListOf("Uint16", parseInt),

    ListOfUint8: ListOf("Uint8", parseInt)
};

interface Field {
    dataType: any;
    description?: string;
    name: string;
    value?: any;
    valueRank?: number; // default is -1 => scalar
    allowSubtype?: boolean;
}

export interface Definition {
    name: string;
    fields: Field[];
}

export interface DefinitionMap {
    findDefinition(name: string): Definition;
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

function _makeExtensionObjectReader(
    definitionName: string,
    definitionMap: DefinitionMap,
    readerMap: Record<string, ReaderStateParserLike>
): ReaderStateParserLike {
    // is it a basic type ?
    if (Object.prototype.hasOwnProperty.call(partials, definitionName)) {
        return partials[definitionName];
    }

    let reader: ReaderStateParserLike = readerMap[definitionName]!;

    if (reader) {
        return reader;
    }
    const definition = definitionMap.findDefinition(definitionName);
    if (!definition) {
        throw new Error("cannot find definition for " + definitionName);
    }
    reader = {
        finish(this: any) {
            /** empty  */
        },
        parser: {}
    };

    for (const field of definition.fields) {
        const fieldReader = _makeExtensionObjectReader(field.dataType, definitionMap, readerMap);
        if (!fieldReader) {
            throw new Error(" Cannot find reader for dataType " + field.dataType);
        }

        if (field.valueRank === undefined || field.valueRank === -1) {
            const parser = fieldReader;
            if (!parser) {
                throw new Error("??? " + field.dataType + "  " + field.name);
            }
            reader.parser![field.name] = {
                parser: fieldReader.parser,
                // endElement: fieldReader.endElement,
                finish(this: any) {
                    const elName = lowerFirstLetter(field.name);
                    fieldReader.finish!.call(this);
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
            listReader.parser![field.dataType] = fieldReader;
            reader.parser![field.name] = listReader;
        } else {
            throw new Error("Unsupported ValueRank ! " + field.valueRank);
        }
    }
    // xx const parser: ParserLike = {};
    // xx parser[definition.name] = reader;
    readerMap[definitionName] = reader;
    return reader;
}

/**
 * @deprecated ( use makeXmlExtensionObjectReader instead)
 * @param definitionName 
 * @param definitionMap 
 * @param readerMap 
 * @returns 
 */
export function makeExtensionObjectReader(
    definitionName: string,
    definitionMap: DefinitionMap,
    readerMap: Record<string, ReaderStateParserLike>
): ReaderState {
    const reader1: ReaderStateParserLike = {
        parser: {},
        endElement(this: any) {
            //         console.log(this.parser[definitionName].value);
            this._pojo = this.parser[definitionName].value;
        }
    };

    reader1.parser![definitionName] = _makeExtensionObjectReader(definitionName, definitionMap, readerMap);

    return new ReaderState(reader1);
}
