import type { IAddressSpace, INamespace, UADataType } from "node-opcua-address-space-base";
import {
    convertStructureTypeSchemaToStructureDefinition,
    DataTypeExtractStrategy,
    ExtraDataTypeManager,
    populateDataTypeManager
} from "node-opcua-client-dynamic-extension-object";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import type { CallbackT } from "node-opcua-status-code";
import type { StructureField } from "node-opcua-types";
import type { AddressSpacePrivate } from "../../impl/address_space_private.js";
import {
    constructNamespaceDependency,
    constructNamespacePriorityTable
} from "../../impl/nodeset_tools/construct_namespace_dependency.js";
import { PseudoSession } from "../pseudo_session.js";

const debugLog = make_debugLog("ensure_datatype_extracted");
const doDebug = checkDebugFlag("ensure_datatype_extracted");

interface UADataTypePriv extends UADataType {
    $partialDefinition?: StructureField[];
}

interface AddressSpacePrivateWithDataTypeManager extends AddressSpacePrivate {
    $$extraDataTypeManager?: ExtraDataTypeManager;
}

function fixDefinition103(addressSpace: IAddressSpace, namespaceArray: string[], dataTypeManager: ExtraDataTypeManager): void {
    // fix datatype _getDefinition();
    for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
        const df = dataTypeManager.getDataTypeFactory(namespaceIndex);
        for (const s of df.getStructureIterator()) {
            const dataType = addressSpace.findDataType(s.schema.dataTypeNodeId) as UADataTypePriv;
            if (!s.constructor) {
                continue;
            }
            if (!dataType) {
                continue;
            }
            if (dataType.$partialDefinition?.length) {
                continue;
            }
            // debugLog(" Exploration", dataType.browseName.toString());
            if (!dataType.$partialDefinition || (dataType.$partialDefinition.length === 0 && s.schema.fields?.length > 0)) {
                const sd = convertStructureTypeSchemaToStructureDefinition(s.schema);
                dataType.$partialDefinition = sd.fields || undefined;
            }
        }
    }
}

export async function ensureDatatypeExtracted(addressSpace: IAddressSpace): Promise<ExtraDataTypeManager> {
    const addressSpacePriv = addressSpace as AddressSpacePrivateWithDataTypeManager;

    if (!addressSpacePriv.$$extraDataTypeManager) {
        const dataTypeManager = new ExtraDataTypeManager();

        const namespaceArray = addressSpace.getNamespaceArray().map((n: INamespace) => n.namespaceUri);

        doDebug && debugLog("INamespace Array = ", namespaceArray.join("\n                   "));

        dataTypeManager.setNamespaceArray(namespaceArray);

        addressSpacePriv.$$extraDataTypeManager = dataTypeManager;

        const factories: DataTypeFactory[] = [getStandardDataTypeFactory()];

        const priorityTable = constructNamespacePriorityTable(addressSpace).priorityTable;

        for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
            const namespace = addressSpace.getNamespace(namespaceIndex);

            if (doDebug) {
                debugLog("namespaceIndex = ", namespaceIndex);
                debugLog("namespace = ", namespace.namespaceUri);
                debugLog("factories = ", factories.map((f) => f.targetNamespace).join(" "));
                // find dependent namespaces
                let dependency = constructNamespaceDependency(namespace);
                // remove last element that is my namespace
                dependency = dependency.filter((ns) => ns.index !== namespaceIndex);
                const dependFactories = dependency.map((ns) => {
                    const df = factories[ns.index];
                    if (!df) {
                        debugLog("namespaceIndex = ", namespaceIndex);
                        debugLog("namespace = ", namespace.namespaceUri);
                        debugLog("priorityTable", priorityTable);
                        debugLog(dependency.map((ns) => `${ns.index} ${ns.namespaceUri}`).join("\n"));
                        throw new Error(`Cannot find factory for namespace ${ns.namespaceUri}`);
                    }
                    return df;
                });
                //            getStandardDataTypeFactory()

                const _dataTypeFactory1 = new DataTypeFactory(dependFactories);
            }
            const dataTypeFactory1 = new DataTypeFactory([...factories]);
            dataTypeFactory1.targetNamespace = namespace.namespaceUri;

            factories.push(dataTypeFactory1);

            dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
        }
        // inject simple types

        // now extract structure and enumeration from old form
        const session = new PseudoSession(addressSpace);

        await populateDataTypeManager(session, dataTypeManager, DataTypeExtractStrategy.Auto);

        // turn old <=103 structure to have valid DataTypeDefinition
        fixDefinition103(addressSpace, namespaceArray, dataTypeManager);
    }
    return addressSpacePriv.$$extraDataTypeManager as ExtraDataTypeManager;
}

export function ensureDatatypeExtractedWithCallback(addressSpace: IAddressSpace, callback: CallbackT<ExtraDataTypeManager>): void {
    ensureDatatypeExtracted(addressSpace)
        .then((result: ExtraDataTypeManager) => callback(null, result))
        .catch((err) => callback(err));
}
