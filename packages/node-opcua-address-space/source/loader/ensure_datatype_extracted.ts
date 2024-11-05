import { IAddressSpace, INamespace, UADataType } from "node-opcua-address-space-base";
import {
    convertStructureTypeSchemaToStructureDefinition,
    DataTypeExtractStrategy,
    ExtraDataTypeManager,
    populateDataTypeManager
} from "node-opcua-client-dynamic-extension-object";
import { make_debugLog } from "node-opcua-debug";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import { CallbackT } from "node-opcua-status-code";
import { StructureField } from "node-opcua-types";
import { AddressSpacePrivate } from "../../src/address_space_private";
import { PseudoSession } from "../pseudo_session";
import { constructNamespaceDependency, constructNamespacePriorityTable } from "../../src/nodeset_tools/construct_namespace_dependency";

const debugLog = make_debugLog(__filename);

interface UADataTypePriv extends UADataType {
    $partialDefinition?: StructureField[];
}

function fixDefinition103(addressSpace: IAddressSpace, namespaceArray: string[], dataTypeManager: ExtraDataTypeManager) {
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
            if (dataType.$partialDefinition && dataType.$partialDefinition.length) {
                continue;
            }
            // debugLog(" Exploration", dataType.browseName.toString());
            if (!dataType.$partialDefinition || (dataType.$partialDefinition.length === 0 && s.schema.fields!.length > 0)) {
                const sd = convertStructureTypeSchemaToStructureDefinition(s.schema);
                dataType.$partialDefinition = sd.fields || undefined;
            }
        }
    }
}

export async function ensureDatatypeExtracted(addressSpace: IAddressSpace): Promise<ExtraDataTypeManager> {
    const addressSpacePriv: any = addressSpace as AddressSpacePrivate;
    if (!addressSpacePriv.$$extraDataTypeManager) {
        const dataTypeManager = new ExtraDataTypeManager();

        const namespaceArray = addressSpace.getNamespaceArray().map((n: INamespace) => n.namespaceUri);
        debugLog("INamespace Array = ", namespaceArray.join("\n                   "));
        dataTypeManager.setNamespaceArray(namespaceArray);
        addressSpacePriv.$$extraDataTypeManager = dataTypeManager;

        const factories: DataTypeFactory[] = [getStandardDataTypeFactory()];

        const priorityTable = constructNamespacePriorityTable(addressSpace).priorityTable;

        for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {

            const namespace = addressSpace.getNamespace(namespaceIndex);
         
            if (false) {
                console.log("namespaceIndex = ", namespaceIndex);
                console.log("namespace = ", namespace.namespaceUri);
                console.log("factories = ", factories.map((f) => f.targetNamespace).join(" "));
                 // find dependent namespaces
                let dependency = constructNamespaceDependency(namespace);
                // remove last element that is my namespace
                dependency = dependency.filter((ns) => ns.index !== namespaceIndex);
                const dependFactories = dependency.map((ns) => {
                    const df = factories[ns.index];
                    if (!df) {
                        console.log("namespaceIndex = ", namespaceIndex);
                        console.log("namespace = ", namespace.namespaceUri);
                        console.log("priorityTable", priorityTable);
                        console.log(dependency.map((ns) => `${ns.index} ${ns.namespaceUri}`).join("\n"));
                        throw new Error("Cannot find factory for namespace " + ns.namespaceUri);
                    }
                    return df;
                });
                //            getStandardDataTypeFactory()

                const dataTypeFactory1 = new DataTypeFactory(dependFactories);
            }
            const dataTypeFactory1 = new DataTypeFactory([...factories]);
            dataTypeFactory1.targetNamespace = namespace.namespaceUri;

            factories.push(dataTypeFactory1);
            // xx console.log("factories = ", factories.map((f) => f.targetNamespace).join(" "));

            dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
        }
        // inject simple types

        // now extract structure and enumeration from old form
        const session = new PseudoSession(addressSpace);
        await populateDataTypeManager(session, dataTypeManager, DataTypeExtractStrategy.Auto);

        // turn old <=103 structure to have valid DataTypeDefinition
        fixDefinition103(addressSpace, namespaceArray, dataTypeManager);
    }
    return addressSpacePriv.$$extraDataTypeManager;
}

export function ensureDatatypeExtractedWithCallback(addressSpace: IAddressSpace, callback: CallbackT<ExtraDataTypeManager>): void {
    ensureDatatypeExtracted(addressSpace)
        .then((result: ExtraDataTypeManager) => callback(null, result))
        .catch((err) => callback(err));
}
