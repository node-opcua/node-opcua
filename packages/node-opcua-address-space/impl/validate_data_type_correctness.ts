import chalk from "chalk";
import type { IAddressSpace, UADataType } from "node-opcua-address-space-base";
import { assert } from "node-opcua-assert";
import { DataType } from "node-opcua-basic-types";
import { checkDebugFlag, make_debugLog } from "node-opcua-debug";
import { makeNodeId, type NodeId } from "node-opcua-nodeid";

const debugLog = make_debugLog("validate_data_type_correctness");
const doDebug = checkDebugFlag("validate_data_type_correctness");

function _dataType_toUADataType(addressSpace: IAddressSpace, dataType: DataType): UADataType {
    assert(addressSpace);
    assert(dataType !== DataType.Null);

    // Resolved by NodeId rather than by name: a built-in type's enum value is its
    // ns=0 identifier, whereas the DataType enum's names do not all match the
    // nodeset's browse names. DataType[24] is "Variant" but node i=24 is
    // "BaseDataType", and DataType[22] is "ExtensionObject" but node i=22 is
    // "Structure" - so a by-name lookup threw for any Variant-encoded value, and
    // the escaping exception surfaced to the client as BadInternalError. (The
    // ExtensionObject case is caught by an earlier branch and never reached here.)
    const dataTypeNode =
        addressSpace.findDataType(makeNodeId(dataType as number, 0)) ?? addressSpace.findDataType(DataType[dataType]);
    /* c8 ignore next */
    if (!dataTypeNode) {
        throw new Error(` Cannot find DataType ${DataType[dataType]} in address Space`);
    }
    return dataTypeNode as UADataType;
}

const validDataTypeForEnumValue = [DataType.Int32];
// , DataType.UInt32, DataType.Int64, DataType.UInt64];

/*=
 *
 * @param addressSpace
 * @param dataTypeNodeId : the nodeId matching the dataType of the destination variable.
 * @param variantDataType: the dataType of the variant to write to the destination variable
 * @param nodeId
 * @return {boolean} true if the variant dataType is compatible with the Variable DataType
 */
export function validateDataTypeCorrectness(
    addressSpace: IAddressSpace,
    dataTypeNodeId: NodeId,
    variantDataType: DataType,
    allowNulls: boolean,
    context?: { toString(): string }
): boolean {
    if (variantDataType === DataType.Null && allowNulls) {
        return true;
    }
    if (variantDataType === DataType.Null && !allowNulls) {
        return false;
    }
    let builtInType: DataType;
    let builtInUADataType: UADataType;

    const destUADataType = addressSpace.findDataType(dataTypeNodeId);

    // c8 ignore next
    if (!destUADataType) {
        throw new Error(`Cannot find UADataType ${dataTypeNodeId.toString()} in address Space`);
    }

    if (variantDataType === DataType.ExtensionObject) {
        const structure = addressSpace.findDataType("Structure");
        // c8 ignore next
        if (!structure) {
            throw new Error("Cannot find Structure DataType node in standard address space");
        }
        if (destUADataType.isSubtypeOf(structure)) {
            return true;
        }
        return false;
    }

    if (destUADataType.isAbstract) {
        builtInUADataType = destUADataType;
    } else {
        builtInType = addressSpace.findCorrespondingBasicDataType(destUADataType);
        if (builtInType === DataType.ExtensionObject) {
            // it should have been trapped earlier
            return false;
        }
        const foundDataType = addressSpace.findDataType(builtInType);
        /* c8 ignore next */
        if (!foundDataType) {
            throw new Error(`Cannot find DataType ${DataType[builtInType]} in address Space`);
        }
        builtInUADataType = foundDataType;
    }

    const enumerationUADataType = addressSpace.findDataType("Enumeration");
    // c8 ignore next
    if (!enumerationUADataType) {
        throw new Error("cannot find Enumeration DataType node in standard address space");
    }
    if (destUADataType.isSubtypeOf(enumerationUADataType)) {
        // c8 ignore next
        if (doDebug) {
            debugLog("destUADataType.", destUADataType.browseName.toString(), destUADataType.nodeId.toString());
            debugLog(
                "enumerationUADataType.",
                enumerationUADataType.browseName.toString(),
                enumerationUADataType.nodeId.toString()
            );
        }

        return validDataTypeForEnumValue.indexOf(variantDataType) >= 0;
    }

    // The value supplied for the attribute is not of the same type as the  value.
    const variantUADataType = _dataType_toUADataType(addressSpace, variantDataType);

    let dest_isSubTypeOf_variant = variantUADataType.isSubtypeOf(builtInUADataType);

    // A family such as Image (-> ImageBMP/ImageGIF/ImageJPG/ImagePNG) is abstract, so the
    // check above compares against Image itself; but none of its members have their own
    // built-in encoding, so a Variant for one of them is always stamped with Image's own
    // built-in ancestor (ByteString) - a supertype of Image, not a subtype of it, and the
    // check above always fails for it. Accept a variant that matches that resolved ancestor.
    if (!dest_isSubTypeOf_variant && destUADataType.isAbstract) {
        const resolvedBuiltInType = addressSpace.findCorrespondingBasicDataType(destUADataType);
        dest_isSubTypeOf_variant = resolvedBuiltInType !== DataType.Null && resolvedBuiltInType === variantDataType;
    }

    // c8 ignore next
    if (doDebug) {
        if (dest_isSubTypeOf_variant) {
            /* c8 ignore next*/
            debugLog(chalk.green(" ---------- Type match !!! "), " on ", context?.toString());
        } else {
            /* c8 ignore next*/
            debugLog(chalk.red(" ---------- Type mismatch "), " on ", context?.toString());
        }
        debugLog(chalk.cyan(" Variable data Type is    = "), destUADataType.browseName.toString());
        debugLog(chalk.cyan(" which matches basic Type = "), builtInUADataType.browseName.toString());
        debugLog(chalk.yellow("        Actual   dataType = "), variantUADataType.browseName.toString());
    }

    return dest_isSubTypeOf_variant;
}
