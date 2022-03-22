import { resolveDynamicExtensionObject } from "node-opcua-client-dynamic-extension-object";
import { Variant } from "node-opcua-variant";
import { IAddressSpace } from "node-opcua-address-space-base";
import { PseudoSession } from "../pseudo_session";
import { ensureDatatypeExtracted } from "../loader/ensure_datatype_extracted";

export async function resolveOpaqueOnAddressSpace(
    addressSpace: IAddressSpace,
    variants: (Variant | null) | (Variant | null)[]
): Promise<void> {
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
