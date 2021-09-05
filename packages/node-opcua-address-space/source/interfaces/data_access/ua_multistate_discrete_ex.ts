/**
 * @module node-opcua-address-space
 */
import { DataType, Variant } from "node-opcua-variant";

/**
 * @see https://reference.opcfoundation.org/v104/Core/docs/Part8/5.3.3/#5.3.3.3
 */

/**
 * @module node-opcua-address-space.DataAccess
 */
import { StatusCode } from "node-opcua-status-code";
import { UAMultiStateDiscrete_Base } from "node-opcua-nodeset-ua";
import { UAVariableT } from "node-opcua-address-space-base";

export { UAMultiStateDiscrete } from "node-opcua-nodeset-ua";

export interface UAMultiStateDiscreteEx<T, DT extends DataType> extends UAVariableT<T, DT>, UAMultiStateDiscrete_Base<T, DT> {
    //------------ helpers ------------------
    getValue(): number;
    getValueAsString(): string;
    getIndex(value: string): number;
    setValue(value: string | number): void;
    checkVariantCompatibility(value: Variant): StatusCode;
}
