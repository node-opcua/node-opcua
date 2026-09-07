/**
 * @module node-opcua-address-space
 *
 * Reading the header of a NodeSet2 XML document: its `NamespaceUris` and its `Models`, and
 * nothing else.
 *
 * This is the dependency pre-pass. Before any document is loaded the loader has to know what each
 * one defines and what each one needs, so that it can sort them; it does that by reading every
 * source no further than the end of its header, which on the standard nodeset is a few hundred
 * bytes of a four megabyte file.
 *
 * It lives apart from the loader because the built-in XML format needs it too, and a format
 * cannot import the loader that drives it.
 */

import { getMinOPCUADate } from "node-opcua-date-time";
import { checkDebugFlag } from "node-opcua-debug";
import { type ReaderStateParser, type ReaderStateParserLike, Xml2Json, type XmlAttributes } from "node-opcua-xml2json";
import type { NodesetModel, NodesetModelInfo } from "./nodeset_format.js";

const doDebug = checkDebugFlag("generateAddressSpaceRaw");

type Model = NodesetModel;
type NodesetInfo = NodesetModelInfo;

/** the `NamespaceUris` and `Models` a NodeSet2 header declares */
export async function parseDependencies(xmlData: string): Promise<NodesetInfo> {
    const namespaceUris: string[] = [];

    const models: Model[] = [];
    let currentModel: Model | undefined;
    const state0: ReaderStateParser = {
        parser: {
            UANodeSet: {
                parser: {
                    NamespaceUris: {
                        parser: {
                            Uri: <ReaderStateParserLike & { text: string }>{
                                finish(this: ReaderStateParserLike & { text: string }) {
                                    namespaceUris.push(this.text);
                                }
                            }
                        }
                    },
                    Models: {
                        parser: {
                            Model: {
                                init(_elementName: string, attrs: XmlAttributes) {
                                    const modelUri = attrs.ModelUri;
                                    const version = attrs.Version;
                                    const publicationDate = new Date(Date.parse(attrs.PublicationDate));
                                    currentModel = {
                                        modelUri,
                                        version,
                                        publicationDate,
                                        requiredModel: []
                                    };
                                    doDebug && console.log(`currentModel = ${JSON.stringify(currentModel)}`);
                                    models.push(currentModel);
                                },
                                parser: {
                                    RequiredModel: {
                                        init(_elementName: string, attrs: XmlAttributes) {
                                            const modelUri = attrs.ModelUri;
                                            const version = attrs.Version;
                                            const publicationDate = new Date(Date.parse(attrs.PublicationDate));

                                            if (!currentModel) {
                                                throw new Error("Internal Error");
                                            }
                                            currentModel.requiredModel.push({
                                                modelUri,
                                                version,
                                                publicationDate
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    const parser = new Xml2Json(state0);
    parser.parseString(xmlData);
    if (models.length === 0 && namespaceUris.length >= 1) {
        models.push({
            modelUri: namespaceUris[0],
            version: "1",
            publicationDate: getMinOPCUADate(),
            requiredModel: []
        });
    }
    return { models, namespaceUris: namespaceUris };
}

/**
 * the header of a NodeSet2 file (`NamespaceUris`, `Models`) precedes the aliases and the nodes: the
 * dependency pre-pass has read enough once both closers were seen, or once the body has begun
 */
const BODY_START =
    /<(Aliases|Extensions|UAObject|UAVariable|UADataType|UAReferenceType|UAObjectType|UAVariableType|UAMethod|UAView)[\s/>]/;
export function headerComplete(text: string): boolean {
    return (text.includes("</Models>") && text.includes("</NamespaceUris>")) || BODY_START.test(text);
}

/** the `<UANodeSet ...>` opener up to the end of `</Models>` or `</NamespaceUris>`, whichever comes last */
export function sliceHeader(xmlData: string, name: string): string {
    const indexStart = xmlData.match(/<UANodeSet/m)?.index;
    const i1 = (xmlData.match(/<\/Models>/m)?.index || 0) + "</Models>".length;
    const i2 = (xmlData.match(/<\/NamespaceUris>/m)?.index || 0) + "</NamespaceUris>".length;
    const indexEnd = Math.max(i1, i2);
    if (indexStart === undefined) {
        throw new Error(`nodeset source ${name}: no <UANodeSet> element found`);
    }
    return xmlData.substring(indexStart, indexEnd);
}
