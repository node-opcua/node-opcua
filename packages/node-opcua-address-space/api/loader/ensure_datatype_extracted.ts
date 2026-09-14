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

        if (doDebug) {
            debugLog("namespaceIndex = ", namespaceIndex);
            debugLog("namespace = ", namespace.namespaceUri);
            debugLog("factories = ", factories.map((f) => f.targetNamespace).join(" "));
            debugLog("priorityTable", constructNamespacePriorityTable(addressSpace).priorityTable);
        }

        // Chain this factory to the namespaces this one DEPENDS ON, rather than to
        // every namespace that happens to have been loaded before it.
        //
        // The positional form — `new DataTypeFactory([...factories])` — made each
        // namespace hold a reference to every earlier one. That was harmless while
        // nothing could be unloaded, and stops being harmless now that
        // `deleteNamespace` exists: dropping a namespace leaves everything loaded
        // after it chained to a discarded factory, and nothing clears that
        // reference, so the factory, its schemas and its ExtensionObject
        // constructors stay alive. A model whose own namespace is registered before
        // its dependencies — index 1, as the modeler does it — would be chained
        // through by every companion spec, and leak one factory per reload.
        //
        // The computation is not new: it was already here, under `if (doDebug)`,
        // with its result assigned to a variable nobody read. This is that
        // computation, used. `constructNamespaceDependency` always reports
        // namespace 0, so the standard factory stays in every chain.
        const dependency = constructNamespaceDependency(namespace).filter((ns) => ns.index !== namespaceIndex);
        const dependFactories: DataTypeFactory[] = [];
        for (const ns of dependency) {
            const df = factories[ns.index];
            if (!df) {
                // A declared dependency whose factory does not exist yet, which can
                // happen when namespaces arrive out of dependency order. Fall back
                // to the positional chain rather than fail: that is what shipped for
                // years, so it cannot resolve less than it used to.
                doDebug &&
                    debugLog(
                        `ensureDatatypeExtracted: no factory yet for namespace ${ns.index} (${ns.namespaceUri}), ` +
                            `keeping the positional chain for ${namespace.namespaceUri}`
                    );
                dependFactories.length = 0;
                break;
            }
            dependFactories.push(df);
        }
        const dataTypeFactory1 = new DataTypeFactory(dependFactories.length > 0 ? dependFactories : [...factories]);
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
