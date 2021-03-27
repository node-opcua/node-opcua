import { AttributeIds, NodeClass, QualifiedName } from "node-opcua-data-model";
import { NodeId, resolveNodeId } from "node-opcua-nodeid";
import { IBasicSession } from "node-opcua-pseudo-session";
import { EnumDefinition } from "node-opcua-types";
import { getBrowseName, getDescription } from "./utils";

interface CacheInterface {
    namespace: {
        namespaceUri: string;
        filename: string;
        symbols: { [key: string]: number };
    }[];
    requestedSymbols: RequestedSymbol;
}
interface RequestedSymbol {
    namespace: {
        symbols: { [key: string]: number };
    }[];
}

export class Cache implements CacheInterface {
    namespace: {
        namespaceUri: string;
        filename: string;
        symbols: { [key: string]: number };
    }[] = [];
    requestedSymbols: RequestedSymbol = { namespace: [] };
    requestedBasicTypes: { [key: string]: number } = {};
    imports: { [key: string]: { [key: string]: number } } = {};
    public constructor() {
        this.imports = {
            "node-opcua-address-space": {
                UAObject: 1,
                UAVariable: 1,
                UAVariableT: 1,
                UAMethod: 1,
                UADataType: 1
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
                Guid: 1,
            }
        };
    }
    resetRequire() {
        this.requestedSymbols = { namespace: [] };
        this.requestedBasicTypes = {};
    }
    referenceUA(type: string) {
        this.requestedBasicTypes[type] = (this.requestedBasicTypes[type] || 0) + 1;
    }
    referenceBasicType(basicType: string): string {
        this.referenceUA(basicType);
        return basicType;
    }
    async referenceExtensionObject(session: IBasicSession, extensionObjectDataType: NodeId): Promise<string> {
        const browseName = await getBrowseName(session, extensionObjectDataType);
        const description = await getDescription(session, extensionObjectDataType);
        const dataTypeName = makeTypeName(NodeClass.DataType, description, browseName, true, this);
        return dataTypeName;
    }
    reference(namespaceIndex: number, t: string) {
        const filename = this.namespace[namespaceIndex]?.filename;
        if (!filename) {
            throw new Error("Cannot find namespace  " + namespaceIndex);
        }
        this.namespace[namespaceIndex].symbols = this.namespace[namespaceIndex].symbols || {};

        this.namespace[namespaceIndex].symbols[t] = (this.namespace[namespaceIndex].symbols[t] || 0) + 1;

        this.requestedSymbols.namespace[namespaceIndex] = this.requestedSymbols.namespace[namespaceIndex] || { namespace: [] };
        this.requestedSymbols.namespace[namespaceIndex].symbols = this.requestedSymbols.namespace[namespaceIndex].symbols || {};
        this.requestedSymbols.namespace[namespaceIndex].symbols[t] =
            (this.requestedSymbols.namespace[namespaceIndex].symbols[t] || 0) + 1;
    }
    importType(namespaceIndex: number, typeName: string): void {
        this.reference(namespaceIndex, typeName);
    }
}

function getTypescriptFile(browseName: QualifiedName, cache: Cache2) {
    const ns = browseName.namespaceIndex;
    const n = cache.namespaceArray[ns].split("/").filter((s: string) => s.length !== 0);
    const nn = n[n.length - 1];
    return "_type-" + nn;
}

export class Cache2 extends Cache {
    public outputFolder: string = "../tmp/";
    public namespaceArray: string[] = [];
}

export async function constructCache(session: IBasicSession): Promise<Cache2> {
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
        const filename = getTypescriptFile(new QualifiedName({ name: namespaceUri, namespaceIndex }), cache);
        cache.namespace.push({
            namespaceUri,
            filename,
            symbols: {}
        });
    }
    return cache;
}
export function makeTypeName(
    nodeClass: NodeClass,
    description: any,
    browseName: QualifiedName,
    doDeclare: boolean,
    cache: Cache
): string {
    let typeName = browseName.name!.toString();
    if (typeName === "Enumeration") {
        typeName = "Enumeration";
        cache.referenceUA("Enumeration");
        return "Enumeration";
    } else  if (typeName === "BaseObjectType") {
        typeName = "Object";
        cache.referenceUA("UAObject");
        return "UAObject";
    } else if (typeName === "BaseVariableType") {
        typeName = "VariableT";
        cache.referenceUA("UAVariableT");
        return "UAVariableT";
    } else if (typeName === "BaseDataType") {
        typeName = "Data";
        cache.referenceUA("UADataType");
        return "UADataType";
    } else {
        let name = "";
        switch (nodeClass) {
            case NodeClass.Variable:
            case NodeClass.Object:
            case NodeClass.VariableType:
            case NodeClass.ObjectType:
                name = `UA${typeName.replace(/Type$/, "")}`;
                break;
            case NodeClass.DataType:
                if (description instanceof EnumDefinition) {
                    name = `${typeName.replace(/(DataType|Enumeration|Type)$/, "")}`;
                } else {
                    name = `DT${typeName.replace(/(DataType|Enumeration|Type)$/, "")}`;
                }
                break;
        }
        if (doDeclare) {
            cache.importType(browseName.namespaceIndex, name);
        }
        if (name === "") {
            throw new Error("Internal Error "+ NodeClass[nodeClass] + " " + typeName);
        }
        return name;
    }
}
