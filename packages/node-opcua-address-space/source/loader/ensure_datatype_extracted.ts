import { IAddressSpace, INamespace } from "node-opcua-address-space-base";
import { ExtraDataTypeManager, populateDataTypeManager } from "node-opcua-client-dynamic-extension-object";
import { make_debugLog } from "node-opcua-debug";
import { DataTypeFactory, getStandardDataTypeFactory } from "node-opcua-factory";
import { CallbackT } from "node-opcua-status-code";
import { AddressSpacePrivate } from "../../src/address_space_private";
import { PseudoSession } from "../pseudo_session";


const debugLog = make_debugLog(__filename);

export async function ensureDatatypeExtracted(addressSpace: IAddressSpace): Promise<ExtraDataTypeManager> {
    const addressSpacePriv: any = addressSpace as AddressSpacePrivate;
    if (!addressSpacePriv.$$extraDataTypeManager) {
        const dataTypeManager = new ExtraDataTypeManager();

        const namespaceArray = addressSpace.getNamespaceArray().map((n: INamespace) => n.namespaceUri);
        debugLog("INamespace Array = ", namespaceArray.join("\n                   "));
        dataTypeManager.setNamespaceArray(namespaceArray);
        addressSpacePriv.$$extraDataTypeManager = dataTypeManager;

        for (let namespaceIndex = 1; namespaceIndex < namespaceArray.length; namespaceIndex++) {
            const dataTypeFactory1 = new DataTypeFactory([getStandardDataTypeFactory()]);
            dataTypeManager.registerDataTypeFactory(namespaceIndex, dataTypeFactory1);
        }
        // inject simple types

        // now extract structure and enumeration from old form if
        const session = new PseudoSession(addressSpace);
        await populateDataTypeManager(session, dataTypeManager, true);
    }
    return addressSpacePriv.$$extraDataTypeManager;
}

export function ensureDatatypeExtractedWithCallback(addressSpace: IAddressSpace, callback: CallbackT<ExtraDataTypeManager>): void {
    ensureDatatypeExtracted(addressSpace)
        .then((result: ExtraDataTypeManager) => callback(null, result))
        .catch((err) => callback(err));
}
