// EngineeringUnit
// Units of measurement for  AnalogItems that represent continuously- variable physical quantities   ( e.g.,
//     length, mass , time, temperature )
// NOTE  This standard defines  Properties  to inform about the unit used for the  DataI tem  value and about  the highest   and
// lowest value likely to be obtained in normal operation


var defaultUri = "http://www.opcfoundation.org/UA/units/un/cefact";
var EUInformation_Schema = {
    name: "EUInformation",
    fields: [
        {
            name: "namespaceUri",
            fieldType: "String",
            defaultValue: defaultUri,
            documentation: "Identifies the organization (company, standards organization) that defines the EUInformation."
        },
        {
            name: "unitId",
            fieldType: "Int32",
            documentation: "Identifier for programmatic evaluation. −1 is used if a unitId is not available."
        },

        // The displayName of the engineering unit is typically the abbreviation of the
        // engineering unit, for example ”h” for hour or ”m/s” for meter per second." +
        // "description  LocalizedText  Contains the full name of the engineering unit such as ”hour” or ”meter
        {
            name: "displayName",
            fieldType: "LocalizedText",
            documentation: "The displayName of the engineering  ( for instance 'm/s' )"
        },
        {
            name: "description",
            fieldType: "LocalizedText",
            documentation: "Contains the full name of the engineering unit such as ”hour” or ”meter per second"
        }

    ]
};
exports.EUInformation_Schema = EUInformation_Schema;
