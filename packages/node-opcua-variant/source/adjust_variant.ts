import assert from "node-opcua-assert";
import { Variant } from "./variant";
import { DataType } from "./DataType_enum";
import { VariantArrayType } from "./VariantArrayType_enum";

export function adjustVariant(variant: Variant, valueRank: number, targetDataType: DataType): Variant {
    if (targetDataType === DataType.Byte && valueRank === 1 /* Array */) {
        if (variant.arrayType === VariantArrayType.Scalar && variant.dataType === DataType.ByteString) {
            // Byte
            variant.arrayType = VariantArrayType.Array;
            variant.dataType = DataType.Byte;
            assert(variant.dataType === DataType.Byte);
            assert(!variant.value || variant.value instanceof Buffer);
        }
    }
    if (targetDataType === DataType.ByteString && valueRank === -1 /* Scalar*/) {
        if (variant.arrayType === VariantArrayType.Array && variant.dataType === DataType.Byte) {
            // Byte
            variant.arrayType = VariantArrayType.Scalar;
            variant.dataType = DataType.ByteString;
            assert(variant.dataType === DataType.ByteString);
            assert(!variant.value || variant.value instanceof Buffer);
        }
    }
    return variant;
}
