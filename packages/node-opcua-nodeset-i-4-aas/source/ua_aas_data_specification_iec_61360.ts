import type { UAProperty } from "node-opcua-address-space-base";
import type { UAString } from "node-opcua-basic-types";
import type { LocalizedText } from "node-opcua-data-model";
import type { DataType } from "node-opcua-variant";

import type { EnumAASCategory } from "./enum_aas_category.js";
import type { EnumAASDataTypeIEC61360 } from "./enum_aas_data_type_iec_61360.js";
import type { EnumAASLevelType } from "./enum_aas_level_type.js";
import type { UAAASAdministrativeInformation } from "./ua_aas_administrative_information.js";
import type { UAAASDataSpecification, UAAASDataSpecification_Base } from "./ua_aas_data_specification.js";
import type { UAAASIdentifier } from "./ua_aas_identifier.js";
import type { UAAASReference } from "./ua_aas_reference.js";
import type { UAValueList } from "./ua_value_list.js";

// ----- this file has been automatically generated - do not edit

/**
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/I4AAS/                          |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |AASDataSpecificationIEC61360Type i=1028                     |
 * |isAbstract      |false                                                       |
 */
export interface UAAASDataSpecificationIEC61360_Base extends UAAASDataSpecification_Base {
    administration: UAAASAdministrativeInformation;
    category?: UAProperty<EnumAASCategory, DataType.Int32>;
    dataType?: UAProperty<EnumAASDataTypeIEC61360, DataType.Int32>;
    defaultInstanceBrowseName: UAProperty<UAString, DataType.String>;
    definition?: UAProperty<LocalizedText, DataType.LocalizedText>;
    identification: UAAASIdentifier;
    levelType?: UAProperty<EnumAASLevelType, DataType.Int32>;
    preferredName: UAProperty<LocalizedText, DataType.LocalizedText>;
    shortName?: UAProperty<LocalizedText, DataType.LocalizedText>;
    sourceOfDefinition?: UAProperty<UAString, DataType.String>;
    symbol?: UAProperty<UAString, DataType.String>;
    unit?: UAProperty<UAString, DataType.String>;
    unitId?: UAAASReference;
    value?: UAProperty<any, any>;
    valueFormat?: UAProperty<UAString, DataType.String>;
    valueId?: UAAASReference;
    valueList?: UAValueList;
}
export interface UAAASDataSpecificationIEC61360 extends UAAASDataSpecification, UAAASDataSpecificationIEC61360_Base {}