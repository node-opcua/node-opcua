/**
 * @module node-opcua-address-space.DataAccess
 */
import { DataType } from "node-opcua-variant";

import {
    Property,
    UAMultiStateValueDiscrete as UAMultiStateValueDiscretePublic,

} from "../../source/address_space_ts";
import { UAVariable } from "../ua_variable";

export interface UAMultiStateValueDiscrete {
    enumValues: Property<"EnumValueType">;
    valueAsText: Property<DataType.String>;

}

export class UAMultiStateValueDiscrete extends UAVariable implements UAMultiStateValueDiscretePublic {

}
