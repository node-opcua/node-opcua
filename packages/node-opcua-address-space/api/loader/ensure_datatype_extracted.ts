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
        addressSpacePriv.$$extraDataTypeManager = new ExtraDataTypeManager();
    }
    const dataTypeManager = addressSpacePriv.$$extraDataTypeManager;

    const namespaceArray = addressSpace.getNamespaceArray().map((n: INamespace) => n.namespaceUri);

    doDebug && debugLog("INamespace Array = ", namespaceArray.join("\n                   "));

    dataTypeManager.setNamespaceArray(namespaceArray);

    const factories: DataTypeFactory[] = [getStandardDataTypeFactory()];

    // A namespace with no factory is one this call has not seen yet: the first call sees them
    // all, and a later one sees a namespace registered since, or one emptied by
    // `deleteNamespace` and populated again - `deleteNamespace` drops that namespace's factory
    // precisely so that its structures are extracted afresh rather than colliding with the
    // schemas of the previous load. When every namespace already has one there is nothing to
    // extract and this returns as fast as it always did.
    let hasNewFactory = false;

    for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
        const namespace = addressSpace.getNamespace(namespaceIndex);

        if (dataTypeManager.hasDataTypeFactory(namespaceIndex)) {
            factories.push(dataTypeManager.getDataTypeFactory(namespaceIndex));
            continue;
        }

        // NOTE: a DataTypeFactory chains POSITIONALLY — to every factory built
        // before it, not to the namespaces it actually depends on. That over-couples
        // namespaces, and it matters now that `deleteNamespace` exists: dropping a
        // namespace leaves everything loaded after it holding a discarded factory,
        // so the factory, its schemas and its ExtensionObject constructors stay
        // alive. A consumer that registers its own namespace BEFORE its dependencies
        // is chained through by every one of them, and leaks a factory per reload.
        //
        // The dependency-correct computation exists below, under `if (doDebug)`,
        // with its result assigned to a variable nobody reads. Using it is NOT a
        // drop-in: `constructNamespaceDependency` walks values and throws on an
        // ExtensionObject with a null schema (`construct_namespace_dependency.ts`,
        // `exploreExtensionObject`). Being debug-only, it has never had to survive
        // the hot path — calling it on every load breaks server writes with
        // `TypeError: Cannot read properties of null (reading 'schema')`.
        //
        // So the fix is two changes, not one: harden that walk, then switch the
        // chain. Deliberately left for its own change, with its own tests, rather
        // than smuggled into this one.
        if (doDebug) {
            const priorityTable = constructNamespacePriorityTable(addressSpace).priorityTable;
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
        hasNewFactory = true;
    }

    if (hasNewFactory) {
        // inject simple types

        // now extract structure and enumeration from old form
        const session = new PseudoSession(addressSpace);

        // the extraction skips a dataType whose factory already knows it, so the namespaces that
        // were extracted by an earlier call are walked but not rebuilt
        await populateDataTypeManager(session, dataTypeManager, DataTypeExtractStrategy.Auto);

        // turn old <=103 structure to have valid DataTypeDefinition
        fixDefinition103(addressSpace, namespaceArray, dataTypeManager);
    }
    return dataTypeManager;
}

export function ensureDatatypeExtractedWithCallback(addressSpace: IAddressSpace, callback: CallbackT<ExtraDataTypeManager>): void {
    ensureDatatypeExtracted(addressSpace)
        .then((result: ExtraDataTypeManager) => callback(null, result))
        .catch((err) => callback(err));
}
