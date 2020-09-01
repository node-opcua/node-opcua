import { Variant } from "./variant";
import { DataType } from "./DataType_enum";

// TODO
/**
 * cast the variant value to match the type required by the variable
 * - the method will throw if no conversion is possible
 * - the original variant will not be modified if it already has the required type
 * - the variant will be modified accordingly to match the required type
 *
 * | ....    | Byte | UInt16 | UInt32 | UInt64 | Boolean | SByte | Int16 | Int32  | Int64 | Float | Double | String | anything else |
 * | ------- | ---- | ------ | ------ | ------ | ------- | ----- | ----- | ------ | ----- | ----- | ------ | ------ | ------------- |
 * | Byte    |   -  | OK     | OK     | OK     | F=0;T<>0| <128  | OK    | OK     | OK    | OK    | OK     |        |               |
 * | UInt16  |<=255 | -      | OK     | OK     | F=0;T<>0| <128  |<2^15-1| OK     | OK    | OK    | OK     |        |               |
 * | UInt32  |<=255 |<2^16   | -      | OK     | F=0;T<>0| <128  |<2^15-1| <2^31-1| OK    | OK    | OK     |        |               |
 * | UInt64  |<=255 |<2^16   |<2^31   | -      | F=0;T<>0| <128  |<2^15-1| <2^31-1| OK    | OK(*) | OK(*)  |        |               |
 * | Boolean | x    |F=0;T=1 |F=0;T=1 | F=0;T=1| -       |F=0;T=1|F=0;T=1|F=0;T=1 |F=0;T=1|F=0;T=1|F=0;T=1 |        |               |
 * | SByte   |>=0   | >=0    | >=0    | >=0    | F=0;T<>0| -     | OK    | OK     | OK    | OK    | OK     |        |               |
 * | Int16   |a<x<b | >=0    | OK     | OK     | F=0;T<>0|<128   | -     | OK     | OK    | OK    | OK     |        |               |
 * | Int32   |a<x<b |a<x<b   | >=0    | OK     | F=0;T<>0|<128   |       | -      | OK    | OK    | OK     |        |               |
 * | Int64   |a<x<b |a<x<b   | a<x<b  | >=0    | F=0;T<>0|<128   | -     |        | -     | OK    | OK     |        |               |
 * | Float   |err   |err     | err    | err    | F=0;T<>0| err   | err   | err    | err   | -     | OK     |        |               |
 * | Double  |err   |err     | err    | err    | F=0;T<>0| err   | err   | err    | err   | *     | -      |        |               |
 * | String  |err   |err     | err    | err    | err     | err   | err   | err    | err   | err   | err    | -      |               |
 */
/*
export function castVariant(variant: Variant, targetDataType: DataType): Variant {
    if (targetDataType !== variant.dataType) {
        switch (targetDataType) {
            case DataType.SByte:
            case DataType.Int16:
            case DataType.Int32:
            case DataType.Int64:
            case DataType.Byte:
            case DataType.Int16:
            case DataType.UInt32:
            case DataType.UInt32:
            case DataType.UInt64:
            case DataType.Double:
            case DataType.Float:
                switch (variant.dataType) {
                    case DataType.SByte:
                    case DataType.Int16:
                    case DataType.Int32:
                    case DataType.Int64:
                    case DataType.Byte:
                    case DataType.UInt16:
                    case DataType.UInt32:
                    case DataType.UInt64:
                    case DataType.Double:
                    case DataType.Float:
                        variant.dataType = targetDataType;
                        break;
                }
                break;
        }
    }

    return variant;
}
*/
