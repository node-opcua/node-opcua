import { resolveDynamicExtensionObject } from "node-opcua-client-dynamic-extension-object";
import { Variant } from "node-opcua-variant";
import { AddressSpace, PseudoSession, ensureDatatypeExtracted } from "..";

export async function resolveOpaqueOnAddressSpace(addressSpace: AddressSpace, variants: (Variant | null) | (Variant | null)[]) {
    if (!variants) {
        return;
    }
    const session = new PseudoSession(addressSpace);
    const extraDataTypeManager = await ensureDatatypeExtracted(addressSpace);
    if (variants instanceof Variant) {
        await resolveDynamicExtensionObject(session, variants, extraDataTypeManager);
        return;
    }
    // resolve opaque data structure from inputArguments
    for (const variant of variants) {
        if (variant) {
            await resolveDynamicExtensionObject(session, variant, extraDataTypeManager);
        }
    }
}
