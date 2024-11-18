import { coerceBoolean, coerceInt64, coerceUInt64, DataType, Int64, isValidGuid, UInt64 } from "node-opcua-basic-types";
import { IAddressSpace, UAVariable, UAVariableType } from "node-opcua-address-space-base";
import { coerceLocalizedText, coerceQualifiedName, LocalizedTextOptions, NodeClass, QualifiedNameOptions } from "node-opcua-data-model";
import { ExtensionObject } from "node-opcua-extension-object";
import { resolveNodeId, NodeIdLike, NodeId } from "node-opcua-nodeid";
import { VariantArrayType, VariantOptions } from "node-opcua-variant";
import { assert } from "node-opcua-assert";
import { ParserLike, ReaderStateParserLike, XmlAttributes } from "node-opcua-xml2json";
import { make_debugLog } from "node-opcua-debug";

import { localizedText_parser } from "./localized_text_parser";
import { makeQualifiedNameParser } from "./qualified_name_parser";
import {
    createXMLExtensionObjectDecodingTask,
    makeExtensionObjectInnerParser,
    makeExtensionObjectParser,
} from "./extension_object_parser";
import { makeNodeIdParser } from "./nodeid_parser";

const debugLog = make_debugLog(__dirname);

export type Task = (addressSpace2: IAddressSpace) => Promise<void>;

type IBasicReaderStateParserLike<T> = ReaderStateParserLike & {
    value: T | undefined;
    text: string;
};
function BasicType_parser<T>(dataType: string, parseFunc: (this: { value: T | undefined }, text: string) => any): ParserLike {
    const _parser: Record<string, ReaderStateParserLike> = {};
    const a = {
        init(this: IBasicReaderStateParserLike<T>, name: string, attrs: XmlAttributes, parent: any, endElement: any) {
            this.value = undefined;
        },
        finish(this: IBasicReaderStateParserLike<T>) {
            this.value = parseFunc.call(this, this.text);
        }
    }
    _parser[dataType] = a as ReaderStateParserLike;
    return _parser as ParserLike;
}




function ListOf<T>(_setValue: (data: VariantOptions) => void, dataType: string, parseFunc: any) {
    return {
        init(this: ListOfTParser<T>) {
            this.listData = [];
        },

        parser: BasicType_parser<T>(dataType, parseFunc),

        finish(this: ListOfTParser<T>) {
            _setValue({
                arrayType: VariantArrayType.Array,
                dataType: (DataType as any)[dataType],
                value: this.listData
            });
        },
        endElement(this: ListOfTParser<T>, element: string) {
            this.listData.push(this.parser[dataType].value);
        }
    };
}


interface Parser {
    parent: Parser | any;
}



function installExtensionObjectListInitializationPostTask(
    postTasks2_AssignedExtensionObjectToDataValue: Task[],
    element: ListOfExtensionObjectParser) {



    let listExtensionObject = element.listExtensionObject;
    let nodeId = element.parent.parent.obj.nodeId;
    assert(nodeId, "expecting a nodeid");
    const task = async (addressSpace2: IAddressSpace) => {
        const node = addressSpace2.findNode(nodeId)!;
        if (!node) {
            debugLog("Cannot find node with nodeId " + nodeId + ". may be the node was marked as deprecated");
        } else if (node.nodeClass === NodeClass.Variable) {
            const v = node as UAVariable;
            assert(v.getBasicDataType() === DataType.ExtensionObject, "expecting an extension object");
            v.bindExtensionObject(listExtensionObject as ExtensionObject[], { createMissingProp: false });
        } else if (node.nodeClass === NodeClass.VariableType) {
            // no need to bind a variable type
            const v = node as UAVariableType;
            (v as any) /*fix me*/.value.value = listExtensionObject;
        }
        listExtensionObject.slice(0);
        (listExtensionObject as any) = undefined;
        (nodeId as any) = undefined;
    };
    postTasks2_AssignedExtensionObjectToDataValue.push(task);
}




export interface ListOfTParser<T> extends Parser {
    listData: T[];
    parent: Parser;
    parser: {
        [key: string]: Parser | any;
    };
}
function parser2<T>(_setValue: (data: VariantOptions) => void, type: string, p: (a: any) => any): any {
    return {
        finish(this: T & { text: string }) {
            _setValue({
                arrayType: VariantArrayType.Scalar,
                dataType: (DataType as any)[type],
                value: p(this.text)
            });
        }
    };
}
const parseUInt64 = (str: string): UInt64 => coerceUInt64(str);
const parseInt64 = (str: string): Int64 => coerceInt64(str);




export interface ListOfExtensionObjectParser extends ListOfTParser<ExtensionObject> {
    isDeferred: boolean;
    listExtensionObject: (ExtensionObject | null)[];
    listExtensionObjectXML: { xmlEncodingNodeId: NodeId; bodyXML: string }[];
    parser: {
        ExtensionObject: ParserLike;
    };
}



export function makeVariantReader<T extends ReaderStateParserLike>(
    setValue: (self: T, data: VariantOptions) => void,
    setDeferredValue: (self: T, data: VariantOptions, deferedTask: () => ExtensionObject | ExtensionObject[] | null) => void,
    postExtensionObjectDecoding: (task: (addressSpace: IAddressSpace) => Promise<void>) => void,
    translateNodeId: (nodeId: string) => NodeId,
): ReaderStateParserLike {

    let self: T;
    const setValue2 = (data: VariantOptions) => {
        setValue(self, data);
    }
    const reader = {
        init(this: ReaderStateParserLike) {
            /* empty */
            self = this as T;
        },
        parser: {
            QualifiedName: {
                ...makeQualifiedNameParser(translateNodeId).QualifiedName,
                finish(this: any) {
                    setValue2({
                        dataType: DataType.QualifiedName,
                        value: coerceQualifiedName({...this.qualifiedName})
                    });
                }
            },
            LocalizedText: {
                ...localizedText_parser.LocalizedText,
                finish(this: any) {
                    setValue2({
                        dataType: DataType.LocalizedText,
                        value: coerceLocalizedText({...this.localizedText})
                    });
                }
            },
            XmlElement: {
                finish(this: any) {
                    setValue2({
                        dataType: DataType.XmlElement,
                        value: this.text
                    });
                }
            },
            String: {
                finish(this: any) {
                    setValue2({
                        dataType: DataType.String,
                        value: this.text
                    });
                }
            },
            Guid: {
                parser: {
                    String: {
                        finish(this: any) {
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
                        finish(this: any) {
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
                init(this: any) {
                    this.value = null;
                },
                finish(this: any) {
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
                finish(this: any) {
                    setValue2({
                        dataType: DataType.Float,
                        value: parseFloat(this.text)
                    });
                }
            },

            Double: {
                finish(this: any) {
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
                (xmlEncodingNodeId: NodeId, bodyXML: string, data) => {

                    let _capturedExtensionObject: ExtensionObject | ExtensionObject[] | null = null;
                    // extension object creation will be postponed
                    const task0 = createXMLExtensionObjectDecodingTask(
                        translateNodeId,
                        xmlEncodingNodeId,
                        bodyXML,
                        (extensionObject: ExtensionObject) => {
                            _capturedExtensionObject = extensionObject;
                        });
                    postExtensionObjectDecoding(task0);
                    setDeferredValue(self, {
                        dataType: DataType.ExtensionObject,
                        arrayType: VariantArrayType.Scalar,
                        value: null
                    }, () => _capturedExtensionObject);
                }
            ),

            ListOfExtensionObject: {
                init(this: ListOfExtensionObjectParser) {
                    this.listExtensionObject = [];
                    this.listExtensionObjectXML = [];
                    this.isDeferred = false;
                },
                parser: makeExtensionObjectParser<ListOfExtensionObjectParser>(
                    translateNodeId,
                    (extensionOject: ExtensionObject, self) => {
                        // const self = reader.parser!.ListOfExtensionObject as ListOfExtensionObjectParser;
                        self.listExtensionObject.push(extensionOject);
                    },
                    (xmlEncodingNodeId: NodeId, bodyXML: string, self) => {
                        // constœ self = reader.parser!.ListOfExtensionObject as ListOfExtensionObjectParser;
                        self.isDeferred = true;
                        self.listExtensionObjectXML.push({ xmlEncodingNodeId, bodyXML });
                        // extension object creation will be postponed
                        self.listExtensionObject.push(null);
                        const index = self.listExtensionObject.length - 1;
                        assert(index >= 0);
                        let listExtensionObject = self.listExtensionObject;
                        const task0 = createXMLExtensionObjectDecodingTask(
                            translateNodeId,
                            xmlEncodingNodeId,
                            bodyXML,
                            (extensionObject: ExtensionObject) => {
                                listExtensionObject[index] = extensionObject;
                            });
                        postExtensionObjectDecoding(task0);
                    }
                ),
                finish(this: ListOfExtensionObjectParser) {
                    if (!this.isDeferred) {
                        setValue2({
                            arrayType: VariantArrayType.Array,
                            dataType: DataType.ExtensionObject,
                            value: this.listExtensionObject
                        });
                    } else {
                        // postpone the creation of the extension object
                        const listExtensionObject: ExtensionObject[] = this.listExtensionObject as any;
                        setDeferredValue(self,
                            {
                                arrayType: VariantArrayType.Array,
                                dataType: DataType.ExtensionObject,
                                value: null
                            },
                            () => listExtensionObject,
                        );
                        this.listExtensionObject = [];
                    }
                },
            },

            ListOfLocalizedText: {
                init(this: ListOfTParser<LocalizedTextOptions>) {
                    this.listData = [];
                },
                parser: {
                    ...localizedText_parser
                },
                endElement(this: ListOfTParser<QualifiedNameOptions> /*element*/) {
                    this.listData.push(this.parser.LocalizedText.value);
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
                    this.listData.push(this.parser.QualifiedName.value);
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
                endElement(this: ListOfTParser<NodeIdLike>, elementName: string) {
                    this.listData.push(this.parser.NodeId.nodeId);
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

            ListOfXmlElement: ListOf<string>(setValue2, "XmlElement", (value: string) => value),

        }
    };
    return reader as any as ReaderStateParserLike;
}
