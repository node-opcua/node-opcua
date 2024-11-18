import assert from "assert";
import { IAddressSpace } from "node-opcua-address-space-base";
import { ExtensionObject } from "node-opcua-extension-object";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { InternalFragmentClonerReaderState, ParserLike, ReaderStateParser, ReaderStateParserLike } from "node-opcua-xml2json";
import { decodeXmlExtensionObject } from "../decode_xml_extension_object";
import { coerceLocalizedText, LocalizedText, LocalizedTextOptions } from "node-opcua-data-model";
import { Argument, EnumValueType, EUInformation, EUInformationOptions } from "node-opcua-types";
import { localizedText_parser } from "./localized_text_parser";
import { coerceInt64 } from "node-opcua-basic-types";
import { make_debugLog } from "node-opcua-debug";
import { Range } from "node-opcua-data-access";


const debugLog = make_debugLog("ExtensionObjectParser");
const errorLog = make_debugLog("ExtensionObjectParser");
const doDebug = false;
export type Task = (addressSpace: IAddressSpace) => Promise<void>;

interface PostExtensionObjectData {
    postponedExtensionObject: ExtensionObject | null;
}

// #region Argument parser
type ArgumentParser = ParserLike & { argument: Argument };
type ArgumentParserL2 = { parent: ArgumentParser } & { text: string };
type ArgumentParserL2L = { parent: ArgumentParser } & { localizedText: LocalizedTextOptions };
type ArgumentParserL3 = { parent: ArgumentParserL2 } & { text: string };

const makeArgumentParser = (_translateNodeId: (nodeId: string) => NodeId) => ({
    Argument: {
        init(this: ArgumentParser) {
            this.argument = new Argument({});
        },
        parser: {
            Name: {
                finish(this: ArgumentParserL2) {
                    this.parent.argument.name = this.text.trim();
                }
            },

            DataType: {
                parser: {
                    Identifier: {
                        finish(this: ArgumentParserL3) {
                            this.parent.parent.argument.dataType = _translateNodeId(resolveNodeId(this.text.trim()).toString());
                        }
                    }
                }
            },
            ValueRank: {
                finish(this: ArgumentParserL2) {
                    this.parent.argument.valueRank = parseInt(this.text.trim(), 10);
                }
            },

            ArrayDimensions: {
                finish(this: ArgumentParserL2) {
                    // xx  this.parent.argument.arrayDimensions =[];
                }
            },
            Description: {
                ...localizedText_parser.LocalizedText,
                finish(this: ArgumentParserL2L) {
                    this.parent.argument.description = coerceLocalizedText({ ...this.localizedText })!;
                }
            }
        },
        finish(this: any) {
            // xx this.argument = new Argument(this.argument);
        }
    }
});
// #endregion

// #region Range parser
type RangeParser = ParserLike & { range: Range };
type RangeParserL2 = ParserLike & { parent: RangeParser, text: string };

const Range_parser = {
    Range: {
        init(this: RangeParser) {
            this.range = new Range({});
        },
        parser: {
            Low: {
                finish(this: RangeParserL2) {
                    this.parent.range.low = parseFloat(this.text);
                }
            },

            High: {
                finish(this: RangeParserL2) {
                    this.parent.range.high = parseFloat(this.text);
                }
            }
        }
    }
};
//#endregion

// #region EUInformation parser

type EUInformationParser = ReaderStateParserLike & {
    euInformation: EUInformationOptions;
    parser: any
};
type EUInformationParserLevel2 = { parent: EUInformationParser } & { text: string };
type EUInformationParserLevel2L = { parent: EUInformationParser } & { localizedText: LocalizedTextOptions };

const EUInformation_parser: ParserLike = {
    EUInformation: <EUInformationParser>{
        init(this: EUInformationParser, name, attrs, parent, engine) {
            this.euInformation = new EUInformation({});
        },
        parser: {
            NamespaceUri: {
                finish(this: EUInformationParserLevel2) {
                    this.parent.euInformation.namespaceUri = this.text;
                }
            },
            UnitId: {
                finish(this: EUInformationParserLevel2) {
                    this.parent.euInformation.unitId = parseInt(this.text, 10);
                }
            },

            DisplayName: {
                ...localizedText_parser.LocalizedText,
                finish(this: EUInformationParserLevel2L) {
                    this.parent.euInformation.displayName = coerceLocalizedText({ ...this.localizedText });
                }
            },

            Description: {
                ...localizedText_parser.LocalizedText,
                finish(this: EUInformationParserLevel2L) {
                    this.parent.euInformation.description = coerceLocalizedText({ ...this.localizedText });
                }
            }
        },
        finish(this: EUInformationParser) {
            this.euInformation = new EUInformation(this.euInformation);
        }
    }
};
// #endregion

// #region EnumValueType parser
type EnumValueParser = ReaderStateParserLike & {
    enumValueType: EnumValueType;
    parser: {
        Value: ReaderStateParserLike,
        DisplayName: ReaderStateParserLike,
        Description: ReaderStateParserLike
    }
};
type EnumValueParserL2 = ReaderStateParserLike & { parent: EnumValueParser } & { text: string };
type EnumValueParserL2L = { parent: EnumValueParser } & { localizedText: LocalizedTextOptions };

const enumValueType_parser = {
    EnumValueType: {
        init(this: EnumValueParser) {  
            this.enumValueType = new EnumValueType({
                description: undefined,
                displayName: undefined,
                value: coerceInt64(-1)
            });
        },
        parser: {
            Value: {
                // note: Value may be missing, in this case value shall be set to -1(64)
                finish(this: EnumValueParserL2) {
                    // Low part
                    this.parent.enumValueType.value = coerceInt64(parseInt(this.text, 10));
                }
            },

            DisplayName: {
                ...localizedText_parser.LocalizedText,
                finish(this: EnumValueParserL2L) {
                    this.parent.enumValueType.displayName = new LocalizedText({...this.localizedText});
                }
            },

            Description: {
                ...localizedText_parser.LocalizedText,
                finish(this: EnumValueParserL2L) {
                    this.parent.enumValueType.description = new LocalizedText({...this.localizedText});
                }
            }
        },
        finish(this: EnumValueParser) {
            this.enumValueType = new EnumValueType(this.enumValueType);
        }
    }
};
// #endregion



export interface ExtensionObjectTypeIdParser {
    parent: ExtensionObjectParser;
}

export interface ExtensionObjectTypeIdIdentifierParser {
    text: string;
    parent: ExtensionObjectTypeIdParser;
}

export interface ExtensionObjectParserInner {
    typeDefinitionId: NodeId;
}
type ExtensionObjectParser = ExtensionObjectParserInner & any;
export interface ExtensionObjectBodyParser {

    parent: ExtensionObjectParser;
    _cloneFragment: InternalFragmentClonerReaderState;
    engine: any;
    parser: {
        Argument: ArgumentParser,
        EUInformation: EUInformationParser,
        EnumValueType: EnumValueParser,
        Range: RangeParser
    };
}

export function makeExtensionObjectInnerParser<T>(
    translateNodeId: (nodeId: string) => NodeId,
    setExtensionObject: (extensionObject: ExtensionObject) => void,
    setExtensionObjectPojo: (typeDefinition: NodeId, xmlData: string, data: T) => void,
): ReaderStateParserLike {
    const a = makeExtensionObjectParser(translateNodeId, setExtensionObject, setExtensionObjectPojo);
    return a.ExtensionObject;
};

export function makeExtensionObjectParser<T>(
    translateNodeId: (nodeId: string) => NodeId,
    setExtensionObject: (extensionObject: ExtensionObject, data: T) => void,
    setExtensionObjectPojo: (typeDefinition: NodeId, xmlData: string, data: T) => void,
): ParserLike {
    return {
        ExtensionObject: <ExtensionObjectParser>{
            init(this: ExtensionObjectParser) {
                this.typeDefinitionId = NodeId.nullNodeId;
            },
            parser: {
                TypeId: {
                    parser: {
                        Identifier: {
                            finish(this: ExtensionObjectTypeIdIdentifierParser) {
                                const typeDefinitionId = this.text.trim();
                                this.parent.parent.typeDefinitionId = translateNodeId(typeDefinitionId);
                            }
                        }
                    }
                },

                // Body2: new FragmentClonerParser(),

                Body: {
                    parser: {
                        Argument: makeArgumentParser(translateNodeId).Argument,
                        EUInformation: EUInformation_parser.EUInformation,
                        EnumValueType: enumValueType_parser.EnumValueType,
                        Range: Range_parser.Range
                    },
                    startElement(this: ExtensionObjectBodyParser, elementName: string, attrs: any) {
                        if (!Object.prototype.hasOwnProperty.call(this.parser, elementName)) {
                            // treat it as a opaque XML bloc for the time being
                            // until we find the definition of this object, so we know how to interpret the fields
                            this._cloneFragment = new InternalFragmentClonerReaderState();
                            this.engine!._promote(this._cloneFragment, this.engine!.currentLevel, elementName, attrs);
                        }
                    },
                    finish(this: ExtensionObjectBodyParser) {

                        const data = this.parent.parent as T;
                        const typeDefinitionId = this.parent.typeDefinitionId;
                        // typeDefinitionId is also the "Default XML" encoding nodeId !
                        switch (typeDefinitionId.toString()) {
                            case "i=7616": // EnumValueType
                            case "ns=0;i=7616":
                                const extensionObject = this.parser.EnumValueType.enumValueType;
                                assert(extensionObject !== null && typeof extensionObject === "object");
                                assert(extensionObject instanceof ExtensionObject);
                                setExtensionObject(extensionObject, data);
                                break;
                            case "i=297": // Arguments
                            case "ns=0;i=297": {
                                const extensionObject = this.parser.Argument.argument;
                                assert(extensionObject !== null && typeof extensionObject === "object");
                                assert(extensionObject instanceof ExtensionObject);
                                setExtensionObject(extensionObject, data);
                            } break;
                            case "i=888":// EUInformation
                            case "ns=0;i=888": {
                                const extensionObject = this.parser.EUInformation.euInformation;
                                assert(extensionObject !== null && typeof extensionObject === "object");
                                assert(extensionObject instanceof ExtensionObject);
                                setExtensionObject(extensionObject, data);
                            } break;
                            case "i=885": // Range
                            case "ns=0;i=885": {
                                const extensionObject = this.parser.Range.range;
                                assert(extensionObject !== null && typeof extensionObject === "object");
                                assert(extensionObject instanceof ExtensionObject);
                                setExtensionObject(extensionObject, data);
                            } break;
                            default: {
                                // istanbul ignore next
                                if (!this._cloneFragment) {
                                    // the XML file is probably not exposing standard UA extension object correctly.
                                    // this has been seen in some generated xml files using the dataType nodeId instead of the default encoding
                                    // nodeid
                                    errorLog(
                                        "[NODE-OPCUA-E12] standard OPCUA Extension object from (namespace=0) has a invalid TypeId",
                                        typeDefinitionId.toString()
                                    );
                                    break;
                                }
                                const bodyXML = this._cloneFragment!.value;
                                this._cloneFragment!.value = null;

                                // the "Default Xml" encoding  nodeId
                                const xmlEncodingNodeId = typeDefinitionId;
                                if (typeDefinitionId.isEmpty()) {
                                    debugLog("xmlEncodingNodeId is empty for " + typeDefinitionId.toString());
                                    break;
                                }
                                setExtensionObjectPojo(xmlEncodingNodeId, bodyXML, data);
                                break;
                            }
                        }
                    }
                }
            },
            finish(this: ExtensionObjectParser) {
                /* empty */
            }
        }
    }
};


export function createXMLExtensionObjectDecodingTask(
    translateNodeId: (nodeId:string) => NodeId,
    xmlEncodingNodeId: NodeId, bodyXML: string,
    withDecoded: (extensionObject: ExtensionObject) => void,
) {

    const capturedXmlBody = bodyXML;

    const task = async (addressSpace2: IAddressSpace) => {
        const extensionObject: ExtensionObject | null = decodeXmlExtensionObject(
            addressSpace2,
            xmlEncodingNodeId,
            capturedXmlBody,
            translateNodeId
        );
        withDecoded(extensionObject!);
    };
    return task;
}
