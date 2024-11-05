// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType } from "node-opcua-variant"
import { LocalizedText } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UABaseInterface, UABaseInterface_Base } from "node-opcua-nodeset-ua/source/ua_base_interface"
/**
 * The IJoiningAdditionalInformationType provides
 * additional parameters for Identification of a
 * given asset.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |IJoiningAdditionalInformationType i=1017                    |
 * |isAbstract      |true                                                        |
 */
export interface UAIJoiningAdditionalInformation_Base extends UABaseInterface_Base {
    /**
     * $description
     * Description is the system specific description of
     * the asset.
     */
    "$description"?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * joiningTechnology
     * JoiningTechnology is a human readable text to
     * identify the joining technology.
     */
    joiningTechnology?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * supplierCode
     * SupplierCode is the SAP or ERP Supplier Code of
     * the asset.
     */
    supplierCode?: UAProperty<UAString, DataType.String>;
}
export interface UAIJoiningAdditionalInformation extends UABaseInterface, UAIJoiningAdditionalInformation_Base {
}