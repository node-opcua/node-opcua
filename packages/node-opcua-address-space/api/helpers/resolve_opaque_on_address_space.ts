import type { IAddressSpace } from "node-opcua-address-space-base";
import { resolveDynamicExtensionObject } from "node-opcua-client-dynamic-extension-object";
import { DataType, Variant } from "node-opcua-variant";
import { ensureDatatypeExtracted } from "../loader/ensure_datatype_extracted.js";
import { PseudoSession } from "../pseudo_session.js";

/**
 * true when the variant may hold an opaque structure to resolve: only an ExtensionObject, or a
 * Variant nested in one, can. Any other value is left as it is by resolveDynamicExtensionObject,
 * so a Write of a number or a string needs neither a PseudoSession nor the DataType extraction.
 */
export function mayHoldOpaqueStructure(variant: Variant | null | undefined): boolean {
    return !!variant && (variant.dataType === DataType.ExtensionObject || variant.dataType === DataType.Variant);
}

export async function resolveOpaqueOnAddressSpace(
    addressSpace: IAddressSpace,
    variants: (Variant | null) | (Variant | null)[]
): Promise<void> {
    if (!variants) {
        return;
    }
    if (variants instanceof Variant ? !mayHoldOpaqueStructure(variants) : !variants.some(mayHoldOpaqueStructure)) {
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
