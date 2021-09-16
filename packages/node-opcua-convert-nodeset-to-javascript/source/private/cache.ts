import * as path from "path";
import assert from "node-opcua-assert";
import { AttributeIds, NodeClass, QualifiedName } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { DataTypeDefinition, EnumDefinition } from "node-opcua-types";
import { kebabCase } from "case-anything";
import { Options } from "../options";
import { getBrowseName, getDefinition } from "./utils";

export interface Import {
    name: string;
    module: string;
    namespace: number;
}
interface CacheInterfaceNamespace {
    namespaceUri: string;
    sourceFolder: string;
    module: string;
    symbols: { [key: string]: number };
}
interface CacheInterface {
    namespace: CacheInterfaceNamespace[];
    requestedSymbols: RequestedSymbol;
}
export interface RequestedSubSymbol {
    subSymbols: { [key: string]: number };
}
interface RequestedSymbol {
    namespace: {
        symbols: { [key: string]: RequestedSubSymbol };
    }[];
}

export class Cache implements CacheInterface {
    namespace: CacheInterfaceNamespace[] = [];
    requestedSymbols: RequestedSymbol = { namespace: [] };
    requestedBasicTypes: { [key: string]: number } = {};
    imports: { [key: string]: { [key: string]: number } } = {};
    public constructor() {
        this.imports = {
            "node-opcua-address-space-base": {
                UAObject: 1,
                UAVariable: 1,
                UAVariableT: 1,
                UAMethod: 1,
                UADataType: 1,
                UAProperty: 1,
            },
            "node-opcua-variant": {
                DataType: 1,
                Variant: 1
            },
            "node-opcua-data-model": {
                LocalizedText: 1,
                QualifiedName: 1,
                DiagnosticInfo: 1
            },
            "node-opcua-data-access": {
                EUInformation: 1
            },
            "node-opcua-nodeid": {
                NodeId: 1,
                ExpandedNodeId: 1
            },
            "node-opcua-status-code": {
                StatusCode: 1,
                StatusCodes: 1
            },
            "node-opcua-basic-types": {
                Int64: 1,
                UInt64: 1,
                UInt32: 1,
                Int32: 1,
                UInt16: 1,
                Int16: 1,
                Byte: 1,
                SByte: 1,
                UAString: 1,
                DateTime: 1,
                Guid: 1
            },
            "node-opcua-data-value": {
                DataValue: 1
            },
            "node-opcua-types": {
                EnumValueType: 1
            }
        };
    }
    resetRequire(): void {
        this.requestedSymbols = { namespace: [] };
        this.requestedBasicTypes = {};
    }

    referenceBasicType(basicType: string): string {
        this.requestedBasicTypes[basicType] = (this.requestedBasicTypes[basicType] || 0) + 1;
        return basicType;
    }

    _reference(namespaceIndex: number, typeName: string, mainTypeName?: string): void {
        if (namespaceIndex <= 0 && this.imports["node-opcua-address-space-base"][typeName]) {
            this.referenceBasicType(typeName);
            return;
        }
        {
            const sourceFolder = this.namespace[namespaceIndex]?.sourceFolder;
            if (!sourceFolder) {
                throw new Error("Cannot find namespace  " + namespaceIndex);
            }
        }
        const symbols = (this.namespace[namespaceIndex].symbols = this.namespace[namespaceIndex].symbols || {});
        symbols[typeName] = (symbols[typeName] || 0) + 1;

        const ns = this.requestedSymbols.namespace[namespaceIndex] || { symbols: {} };
        this.requestedSymbols.namespace[namespaceIndex] = ns;

        ns.symbols = ns.symbols || {};

        if (!mainTypeName) {
            mainTypeName = typeName;
        }
        const subs = (ns.symbols[mainTypeName] = ns.symbols[mainTypeName] || { subSymbols: {} });
        subs.subSymbols[typeName] = (subs.subSymbols[typeName] || 0) + 1;
    }

    ensureImported(i: Import): void {
        if (i.namespace < 0) {
            this.referenceBasicType(i.name);
        } else {
            this._reference(i.namespace, i.name, i.module);
        }
    }
}


function getSourceFolderForNamespace(browseName: QualifiedName, options: Options, cache: Cache2) {
    const ns = browseName.namespaceIndex;
    const n = cache.namespaceArray[ns].split("/").filter((s: string) => s.length !== 0);
    const nn = n[n.length - 1];
    const module = options.prefix + kebabCase(nn);
    const namespaceFolder = path.join(options.baseFolder, module);
    const sourceFolder = path.join(namespaceFolder);
    return { sourceFolder, module };
}

export async function referenceExtensionObject(session: IBasicSession, extensionObjectDataType: NodeId): Promise<Import> {
    const browseName = await getBrowseName(session, extensionObjectDataType);
    const definition = await getDefinition(session, extensionObjectDataType);
    const dataTypeNameImport = makeTypeNameNew(NodeClass.DataType, definition, browseName);
    return dataTypeNameImport;
}

export class Cache2 extends Cache {
    public namespaceArray: string[] = [];
}

export async function constructCache(session: IBasicSession, options: Options): Promise<Cache2> {
    const cache = new Cache2();

    cache.namespaceArray = cache.namespaceArray.length
        ? cache.namespaceArray
        : (
              await session.read({
                  nodeId: resolveNodeId("Server_NamespaceArray"),
                  attributeId: AttributeIds.Value
              })
          ).value.value;

    for (let namespaceIndex = 0; namespaceIndex < cache.namespaceArray.length; namespaceIndex++) {
        const namespaceUri = cache.namespaceArray[namespaceIndex];
        const { sourceFolder, module } = getSourceFolderForNamespace(
            new QualifiedName({ name: namespaceUri, namespaceIndex }),
            options,
            cache
        );
        cache.namespace.push({
            namespaceUri,
            sourceFolder,
            module,
            symbols: {}
        });
    }
    return cache;
}

function makeBasicTypeImport(name: string): Import {
    return { name, module: "BasicType", namespace: -1 };
}
export function makeTypeNameNew(nodeClass: NodeClass, definition: DataTypeDefinition | null, browseName: QualifiedName, suffix?: string): Import {
    assert(browseName && !!browseName.name, "expecting a class name here");

    const typeName = browseName.name!.toString();
    if (typeName === "EUInformation") {
        return makeBasicTypeImport("EUInformation");
    } else if (typeName === "Enumeration") {
        return makeBasicTypeImport("Enumeration");
    } else if (typeName === "BaseObjectType") {
        return makeBasicTypeImport("UAObject");
    } else if (typeName === "BaseVariableType") {
        return makeBasicTypeImport("UAVariableT");
    } else if (typeName === "BaseDataType") {
        return makeBasicTypeImport("UADataType");
    } else {
        let name = "";
        switch (nodeClass) {
            case NodeClass.Method:
                return makeBasicTypeImport("UAMethod");
            case NodeClass.Variable:
            case NodeClass.Object:
            case NodeClass.VariableType:
            case NodeClass.ObjectType:
                name = `UA${typeName.replace(/Type$/, "")}` + (suffix || "");
                break;
            case NodeClass.DataType:
                if (definition instanceof EnumDefinition) {
                    name = `Enum${typeName.replace(/(DataType|Enumeration|Type)$/, "")}`;
                } else {
                    name = `DT${typeName.replace(/(DataType|Enumeration|Type)$/, "")}`;
                }
                break;
        }
        if (name === "") {
            throw new Error("Internal Error " + NodeClass[nodeClass] + " " + typeName + "browseName = " + browseName.toString());
        }
        return { name, module: name, namespace: browseName.namespaceIndex };
    }
}
