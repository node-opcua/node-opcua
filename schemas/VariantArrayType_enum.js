import { registerEnumeration } from "lib/misc/factories";

const VariantArrayType_Schema = {
    name:"VariantArrayType",
    enumValues: {
        Scalar: 0x00,
        Array:  0x01,
        Matrix:  0x02
    }
};

export const VariantArrayType = registerEnumeration(VariantArrayType_Schema);
