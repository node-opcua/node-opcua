/**
 * US-9.2 study: what does readValue's clone cost for large arrays?
 * run from packages/node-opcua-address-space:
 *   node --experimental-strip-types --no-warnings benchmark/bench_read_value.ts
 */
import { performance } from "node:perf_hooks";
import { nodesets } from "node-opcua-nodesets";
import { DataType, VariantArrayType } from "node-opcua-variant";
import { AddressSpace, type UAVariable } from "../dist/api/index.js";
import { generateAddressSpace } from "../distNodeJS/index.js";

async function main() {
    const addressSpace = AddressSpace.create();
    await generateAddressSpace(addressSpace, [nodesets.standard]);
    const namespace = addressSpace.registerNamespace("urn:bench-read");
    const sizes = [1, 100, 10_000, 100_000, 1_000_000];
    for (const size of sizes) {
        for (const kind of ["Float64Array", "string[]"]) {
            const isTyped = kind === "Float64Array";
            const value = isTyped ? new Float64Array(size).fill(1.5) : Array.from({ length: size }, (_, i) => `s${i}`);
            const v = namespace.addVariable({
                browseName: `V_${kind}_${size}`,
                organizedBy: addressSpace.rootFolder.objects,
                dataType: isTyped ? "Double" : "String",
                valueRank: 1,
                arrayDimensions: [size],
                value: { dataType: isTyped ? DataType.Double : DataType.String, arrayType: VariantArrayType.Array, value }
            }) as UAVariable;
            const reads = Math.max(20, Math.min(20000, Math.floor(2_000_000 / size)));
            let best = Number.POSITIVE_INFINITY;
            for (let run = 0; run < 5; run++) {
                const t0 = performance.now();
                for (let i = 0; i < reads; i++) {
                    v.readValue();
                }
                best = Math.min(best, (performance.now() - t0) / reads);
            }
            const bytes = isTyped ? size * 8 : size * 4;
            console.log(
                `${kind.padEnd(12)} ${String(size).padStart(9)} elements: readValue ${(best * 1000).toFixed(1).padStart(9)} us` +
                    `  (${(bytes / 1048576).toFixed(1)} MB copied per read)`
            );
        }
    }
    addressSpace.dispose();
}
main().catch((e) => {
    console.error(e);
    process.exit(1);
});
