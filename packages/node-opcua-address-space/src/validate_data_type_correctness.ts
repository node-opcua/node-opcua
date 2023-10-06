import chalk from "chalk";
import { assert } from "node-opcua-assert";
import { IAddressSpace, UADataType } from "node-opcua-address-space-base";
import { DataType } from "node-opcua-basic-types";
import { make_debugLog, make_warningLog, checkDebugFlag, make_errorLog } from "node-opcua-debug";
import { NodeId } from "node-opcua-nodeid";

const debugLog = make_debugLog(__filename);
const doDebug = checkDebugFlag(__filename);

function _dataType_toUADataType(addressSpace: IAddressSpace, dataType: DataType): UADataType {
    assert(addressSpace);
    assert(dataType !== DataType.Null);

    const dataTypeNode = addressSpace.findDataType(DataType[dataType]);
    /* istanbul ignore next */
    if (!dataTypeNode) {
        throw new Error(" Cannot find DataType " + DataType[dataType] + " in address Space");
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

    const destUADataType = addressSpace.findDataType(dataTypeNodeId)!;

    // istanbul ignore next
    if (!destUADataType) {
        throw new Error("Cannot find UADataType " + dataTypeNodeId.toString() + " in address Space");
    }

    if (variantDataType === DataType.ExtensionObject) {
        const structure = addressSpace.findDataType("Structure")!;
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
        builtInUADataType = addressSpace.findDataType(builtInType)!;
    }

    const enumerationUADataType = addressSpace.findDataType("Enumeration");
    // istanbul ignore next
    if (!enumerationUADataType) {
        throw new Error("cannot find Enumeration DataType node in standard address space");
    }
    if (destUADataType.isSubtypeOf(enumerationUADataType)) {
        // istanbul ignore next
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

    const dest_isSubTypeOf_variant = variantUADataType.isSubtypeOf(builtInUADataType);

    // istanbul ignore next
    if (doDebug) {
        if (dest_isSubTypeOf_variant) {
            /* istanbul ignore next*/
            debugLog(chalk.green(" ---------- Type match !!! "), " on ", context?.toString());
        } else {
            /* istanbul ignore next*/
            debugLog(chalk.red(" ---------- Type mismatch "), " on ", context?.toString());
        }
        debugLog(chalk.cyan(" Variable data Type is    = "), destUADataType.browseName.toString());
        debugLog(chalk.cyan(" which matches basic Type = "), builtInUADataType.browseName.toString());
        debugLog(chalk.yellow("        Actual   dataType = "), variantUADataType.browseName.toString());
    }

    return dest_isSubTypeOf_variant;
}
