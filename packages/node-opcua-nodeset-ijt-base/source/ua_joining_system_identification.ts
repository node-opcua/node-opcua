// ----- this file has been automatically generated - do not edit
import { UAProperty } from "node-opcua-address-space-base"
import { DataType, VariantOptions } from "node-opcua-variant"
import { LocalizedText, QualifiedName } from "node-opcua-data-model"
import { UAString } from "node-opcua-basic-types"
import { UAFunctionalGroup, UAFunctionalGroup_Base } from "node-opcua-nodeset-di/source/ua_functional_group"
/**
 * It provides identification parameters of the
 * joining system.
 *
 * |                |                                                            |
 * |----------------|------------------------------------------------------------|
 * |namespace       |http://opcfoundation.org/UA/IJT/Base/                       |
 * |nodeClass       |ObjectType                                                  |
 * |typedDefinition |JoiningSystemIdentificationType i=1029                      |
 * |isAbstract      |false                                                       |
 */
export interface UAJoiningSystemIdentification_Base extends UAFunctionalGroup_Base {
    /**
     * defaultInstanceBrowseName
     * The default BrowseName for instances of the type.
     */
    defaultInstanceBrowseName: UAProperty<QualifiedName, DataType.QualifiedName>;
    /**
     * $description
     * Description is the description of the system
     * which could be written by the customer to
     * identify the system. It could be the purpose of
     * the system in the assembly line.
     */
    "$description"?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * integratorName
     * IntegratorName is the name of the system
     * integrator.
     */
    integratorName?: UAProperty<UAString, DataType.String>;
    /**
     * joiningTechnology
     * JoiningTechnology is a human readable text to
     * identify the joining technology of the joining
     * system.
     */
    joiningTechnology?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * location
     * Location is the location of the given system in
     * the given plant or factory in text format.
     */
    location?: UAProperty<UAString, DataType.String>;
    /**
     * manufacturer
     * Manufacturer provides a human-readable, localized
     * name of the joining system manufacturer.
     */
    manufacturer?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * manufacturerUri
     * ManufacturerUri provides a unique identifier for
     * this company. This identifier should be a fully
     * qualified domain name; however, it may be a GUID
     * or similar construct that ensures global
     * uniqueness.
     */
    manufacturerUri?: UAProperty<UAString, DataType.String>;
    /**
     * model
     * Model provides the type of the joining system.
     * Examples: Fixtured System, Handheld System, etc.
     */
    model?: UAProperty<LocalizedText, DataType.LocalizedText>;
    /**
     * name
     * Name is the name of the joining system. It can
     * also be the standard browse name of the instance
     * of JoiningSystemType.
     */
    name: UAProperty<UAString, DataType.String>;
    /**
     * productInstanceUri
     * ProductInstanceUri is a globally unique resource
     * identifier provided by the manufacturer.
     */
    productInstanceUri?: UAProperty<UAString, DataType.String>;
    /**
     * systemId
     * SystemId is the system integrator specific
     * identifier for the system. It represents a
     * reference to the manufacturer ERP system.
     */
    systemId?: UAProperty<UAString, DataType.String>;
}
export interface UAJoiningSystemIdentification extends UAFunctionalGroup, UAJoiningSystemIdentification_Base {
}