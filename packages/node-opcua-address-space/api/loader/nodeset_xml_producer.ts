/**
 * @module node-opcua-address-space
 *
 * The XML producer: the reader states of a NodeSet2 document, emitting one {@link NodesetRecord}
 * per node instead of creating the node. Ids stay in the file's own namespace table; aliases are
 * resolved here, so no record refers to an alias by name.
 */

import type { RequiredModel } from "node-opcua-address-space-base";
import { coerceBoolean, coerceByte, coerceInt32 } from "node-opcua-basic-types";
import { DataTypeIds } from "node-opcua-constants";
import { NodeClass, type QualifiedName, stringToQualifiedName } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { _definitionParser, ReaderState, type ReaderStateParserLike, Xml2Json, type XmlAttributes } from "node-opcua-xml2json";
import {
    type NodesetDefinitionField,
    type NodesetHeaderRecord,
    type NodesetModelRecord,
    type NodesetNodeRecord,
    type NodesetRecord,
    type NodesetRecordWithBytes,
    type NodesetReferenceRecord,
    type NodesetRolePermissionRecord,
    recordBytes
} from "./nodeset_record.js";
import { makeVariantReader } from "./parsers/variant_parser.js";

function stringToUInt32Array(str: string | undefined): number[] | null {
    return str ? str.split(",").map((value: string) => parseInt(value, 10)) : null;
}

/** a document fed piece by piece; `write` and `end` return the records the piece completed */
export interface XmlNodesetRecordReader {
    write(chunk: string): NodesetRecord[];
    end(): NodesetRecord[];
}

// the reader states carry their own fields on `this`; the xml2json engine binds them dynamically
// biome-ignore lint/suspicious/noExplicitAny: xml2json parser callback with dynamic this binding
type State = any;

interface NodeState {
    obj: NodesetNodeRecord;
}

export function makeXmlNodesetRecordReader(): XmlNodesetRecordReader {
    let pending: NodesetRecord[] = [];
    let namespaceUris: string[] = [];
    const models: NodesetModelRecord[] = [];
    const aliases: Record<string, NodeId> = Object.create(null);
    let headerEmitted = false;
    // every id string of the file resolved once: "i=47" alone appears tens of thousands of times
    const ids = new Map<string, NodeId>();

    function nodeIdOf(text: string): NodeId {
        const alias = aliases[text];
        if (alias) {
            return alias;
        }
        let nodeId = ids.get(text);
        if (!nodeId) {
            nodeId = resolveNodeId(text);
            ids.set(text, nodeId);
        }
        return nodeId;
    }
    const nodeIdOrNull = (text: string | undefined): NodeId | null => (text ? nodeIdOf(text) : null);
    const qualifiedNameOf = (text: string): QualifiedName => stringToQualifiedName(text);
    const releaseStatusOf = (attrs: XmlAttributes): "Draft" | "Deprecated" | undefined =>
        attrs.ReleaseStatus === "Draft" ? "Draft" : attrs.ReleaseStatus === "Deprecated" ? "Deprecated" : undefined;

    function emitHeader() {
        if (headerEmitted) {
            return;
        }
        headerEmitted = true;
        const header: NodesetHeaderRecord = { kind: "header", namespaceUris, models: models.slice(), aliases: { ...aliases } };
        pending.push(header);
    }

    /** the fields every node class shares, from the element's attributes */
    function baseRecord(nodeClass: NodeClass, attrs: XmlAttributes): NodesetNodeRecord {
        emitHeader();
        const record: NodesetNodeRecord = {
            kind: "node",
            nodeClass,
            nodeId: attrs.NodeId ? nodeIdOf(attrs.NodeId) : NodeId.nullNodeId,
            browseName: qualifiedNameOf(attrs.BrowseName),
            references: []
        };
        const releaseStatus = releaseStatusOf(attrs);
        if (releaseStatus) record.releaseStatus = releaseStatus;
        if (attrs.AccessRestrictions !== undefined && attrs.AccessRestrictions !== "")
            record.accessRestrictions = attrs.AccessRestrictions;
        if (attrs.HasNoPermissions !== undefined) record.hasNoPermissions = coerceBoolean(attrs.HasNoPermissions);
        return record;
    }

    const state_Alias = {
        finish(this: State) {
            aliases[this.attrs.Alias] = resolveNodeId(this.text);
        }
    };

    const references_parser = {
        init(this: State) {
            this.array = (this.parent as NodeState).obj.references;
        },
        parser: {
            Reference: {
                finish(this: State) {
                    const reference: NodesetReferenceRecord = {
                        isForward: this.attrs.IsForward === undefined ? true : this.attrs.IsForward !== "false",
                        nodeId: nodeIdOf(this.text),
                        referenceType: nodeIdOf(this.attrs.ReferenceType)
                    };
                    this.parent.array.push(reference);
                }
            }
        }
    };

    const role_permissions_parser = {
        init(this: State) {
            this.array = [] as NodesetRolePermissionRecord[];
            (this.parent as NodeState).obj.rolePermissions = this.array;
        },
        parser: {
            RolePermission: {
                finish(this: State) {
                    this.parent.array.push({
                        roleId: nodeIdOf(this.text.trim()),
                        permissions: parseInt(this.attrs.Permissions || "0", 10)
                    });
                }
            }
        }
    };

    const displayName_parser = {
        finish(this: State) {
            (this.parent as NodeState).obj.displayName = this.text;
        }
    };
    const description_parser = {
        finish(this: State) {
            (this.parent as NodeState).obj.description = this.text;
        }
    };
    const common_parser = {
        DisplayName: displayName_parser,
        Description: description_parser,
        References: references_parser,
        RolePermissions: role_permissions_parser
    };
    const emit = {
        finish(this: NodeState) {
            pending.push(this.obj);
        }
    };

    const state_UAObject = {
        init(this: NodeState, _name: string, attrs: XmlAttributes) {
            this.obj = baseRecord(NodeClass.Object, attrs);
            this.obj.isAbstract = coerceBoolean(attrs.IsAbstract);
            this.obj.eventNotifier = coerceByte(attrs.EventNotifier) || 0;
            if (attrs.SymbolicName) this.obj.symbolicName = attrs.SymbolicName;
        },
        ...emit,
        parser: common_parser
    };

    const state_UAObjectType = {
        init(this: NodeState, _name: string, attrs: XmlAttributes) {
            this.obj = baseRecord(NodeClass.ObjectType, attrs);
            this.obj.isAbstract = coerceBoolean(attrs.IsAbstract);
            this.obj.eventNotifier = coerceByte(attrs.EventNotifier) || 0;
        },
        ...emit,
        parser: common_parser
    };

    const state_UAReferenceType = {
        init(this: NodeState, _name: string, attrs: XmlAttributes) {
            this.obj = baseRecord(NodeClass.ReferenceType, attrs);
            this.obj.isAbstract = coerceBoolean(attrs.IsAbstract);
        },
        ...emit,
        parser: {
            ...common_parser,
            InverseName: {
                finish(this: State) {
                    (this.parent as NodeState).obj.inverseName = this.text;
                }
            }
        }
    };

    const state_UADataType = {
        init(this: State, _name: string, attrs: XmlAttributes) {
            this.obj = baseRecord(NodeClass.DataType, attrs);
            this.obj.isAbstract = coerceBoolean(attrs.IsAbstract) || false;
            if (attrs.SymbolicName !== undefined) this.obj.symbolicName = attrs.SymbolicName;
            this.definitionFields = [];
            this.definitionName = undefined;
        },
        finish(this: State) {
            const fields = this.definitionFields as Array<Record<string, unknown>>;
            if (fields.length > 0 || this.definitionName !== undefined) {
                // the definition reader leaves raw strings; the record carries what the node needs
                const converted: NodesetDefinitionField[] = fields.map((raw) => {
                    const field: Record<string, unknown> = { ...raw };
                    if (field.description) field.description = { text: field.description };
                    if (field.displayName) field.displayName = { text: field.displayName };
                    field.dataType = field.dataType ? nodeIdOf(field.dataType as string) : resolveNodeId(DataTypeIds.BaseDataType);
                    if (field.allowSubTypes) field.allowSubTypes = coerceBoolean(field.allowSubTypes as string | boolean);
                    return field as unknown as NodesetDefinitionField;
                });
                (this.obj as NodesetNodeRecord).definition = { name: this.definitionName, fields: converted };
            }
            pending.push(this.obj);
        },
        parser: {
            ...common_parser,
            Definition: _definitionParser
        }
    };

    function variableRecord(nodeClass: NodeClass, attrs: XmlAttributes): NodesetNodeRecord {
        const record = baseRecord(nodeClass, attrs);
        const valueRank = attrs.ValueRank === undefined ? -1 : coerceInt32(attrs.ValueRank);
        record.parentNodeId = nodeIdOrNull(attrs.ParentNodeId);
        record.dataType = nodeIdOrNull(attrs.DataType);
        record.valueRank = valueRank;
        record.arrayDimensions = valueRank <= 0 ? null : stringToUInt32Array(attrs.ArrayDimensions);
        record.minimumSamplingInterval = attrs.MinimumSamplingInterval ? parseInt(attrs.MinimumSamplingInterval, 10) : 0;
        return record;
    }
    const value_parser = makeVariantReader<State>((self: State, data) => {
        (self.parent as NodeState).obj.value = data;
    }, nodeIdOf);

    const state_UAVariable = {
        init(this: NodeState, _name: string, attrs: XmlAttributes) {
            this.obj = variableRecord(NodeClass.Variable, attrs);
            this.obj.historizing = coerceBoolean(attrs.Historizing);
            if (attrs.AccessLevel !== undefined) this.obj.accessLevel = attrs.AccessLevel;
            if (attrs.UserAccessLevel !== undefined) this.obj.userAccessLevel = attrs.UserAccessLevel;
        },
        ...emit,
        parser: { ...common_parser, Value: value_parser }
    };

    const state_UAVariableType = {
        init(this: NodeState, _name: string, attrs: XmlAttributes) {
            this.obj = variableRecord(NodeClass.VariableType, attrs);
            this.obj.isAbstract = coerceBoolean(attrs.IsAbstract);
        },
        ...emit,
        parser: { ...common_parser, Value: value_parser }
    };

    const state_UAMethod = {
        init(this: NodeState, _name: string, attrs: XmlAttributes) {
            this.obj = baseRecord(NodeClass.Method, attrs);
            this.obj.parentNodeId = nodeIdOrNull(attrs.ParentNodeId);
            this.obj.methodDeclarationId = nodeIdOrNull(attrs.MethodDeclarationId);
        },
        ...emit,
        parser: {
            DisplayName: displayName_parser,
            References: references_parser,
            RolePermissions: role_permissions_parser
        }
    };

    const state_UAView = {
        init(this: NodeState, _name: string, attrs: XmlAttributes) {
            this.obj = baseRecord(NodeClass.View, attrs);
            if (attrs.ContainsNoLoops !== undefined) this.obj.containsNoLoops = coerceBoolean(attrs.ContainsNoLoops);
            this.obj.eventNotifier = coerceByte(attrs.EventNotifier) || 0;
        },
        ...emit,
        parser: common_parser
    };

    const state_ModelTableEntry = new ReaderState({
        init(this: State) {
            this._requiredModels = [] as RequiredModel[];
        },
        parser: {
            RequiredModel: {
                init(this: State, _name: string, attrs: XmlAttributes) {
                    this.parent._requiredModels.push({
                        modelUri: attrs.ModelUri,
                        version: attrs.Version,
                        publicationDate: new Date(Date.parse(attrs.PublicationDate))
                    });
                }
            }
        },
        finish(this: State) {
            const model: NodesetModelRecord = {
                modelUri: this.attrs.ModelUri,
                version: this.attrs.Version,
                publicationDate: this.attrs.PublicationDate ? new Date(Date.parse(this.attrs.PublicationDate)) : undefined,
                requiredModels: this._requiredModels
            };
            if (this.attrs.SymbolicName !== undefined) model.symbolicName = this.attrs.SymbolicName;
            if (this.attrs.AccessRestrictions !== undefined) model.accessRestrictions = this.attrs.AccessRestrictions;
            models.push(model);
        }
    });

    const state_0: ReaderStateParserLike = {
        parser: {
            Aliases: { parser: { Alias: state_Alias } },
            NamespaceUris: {
                init() {
                    namespaceUris = [];
                },
                parser: {
                    Uri: {
                        finish(this: State) {
                            namespaceUris.push(this.text);
                        }
                    }
                }
            },
            Models: { parser: { Model: state_ModelTableEntry } },
            UADataType: state_UADataType,
            UAMethod: state_UAMethod,
            UAObject: state_UAObject,
            UAObjectType: state_UAObjectType,
            UAReferenceType: state_UAReferenceType,
            UAVariable: state_UAVariable,
            UAVariableType: state_UAVariableType,
            UAView: state_UAView
        }
    };

    const parser = new Xml2Json(state_0);
    parser.begin();
    // the bytes of chunks that completed no record wait for the next record
    let carriedBytes = 0;

    function take(): NodesetRecord[] {
        const out = pending;
        pending = [];
        if (out.length > 0) {
            (out[out.length - 1] as NodesetRecordWithBytes)[recordBytes] = carriedBytes;
            carriedBytes = 0;
        }
        return out;
    }

    return {
        write(chunk: string): NodesetRecord[] {
            carriedBytes += chunk.length;
            parser.write(chunk);
            return take();
        },
        end(): NodesetRecord[] {
            parser.end();
            emitHeader();
            return take();
        }
    };
}

/** the records of a NodeSet2 document delivered as text chunks */
export async function* xmlNodesetRecords(chunks: AsyncIterable<string> | Iterable<string>): AsyncGenerator<NodesetRecord> {
    const reader = makeXmlNodesetRecordReader();
    for await (const chunk of chunks) {
        const records = reader.write(chunk);
        for (const record of records) {
            yield record;
        }
    }
    for (const record of reader.end()) {
        yield record;
    }
}
