/**
 * @module node-opcua-data-access
 */
export { EUInformation } from "node-opcua-types";
/*jslint bitwise: true */
// tslint:disable:no-bitwise

// EngineeringUnit
// Units of measurement for  AnalogItems that represent continuously- variable physical quantities   ( e.g.,
//     length, mass , time, temperature )
// NOTE  This standard defines  Properties  to inform about the unit used for the  DataI tem  value and
// about  the highest   and lowest value likely to be obtained in normal operation

import { EUInformation } from "node-opcua-types";

const defaultUri = "http://www.opcfoundation.org/UA/units/un/cefact";

const schemaEUInformation = EUInformation.schema;
schemaEUInformation.fields[0].defaultValue = defaultUri;
schemaEUInformation.fields[0].documentation =
    "Identifies the organization (company, standards organization) that defines the EUInformation.";
schemaEUInformation.fields[1].documentation = "Identifier for programmatic evaluation. −1 is used if a unitId is not available.";
schemaEUInformation.fields[2].documentation = "The displayName of the engineering  ( for instance 'm/s' )";
schemaEUInformation.fields[3].documentation = "Contains the full name of the engineering unit such as ”hour” or ”meter per second";

// The displayName of the engineering unit is typically the abbreviation of the
// engineering unit, for example ”h” for hour or ”m/s” for meter per second." +
// "description  LocalizedText  Contains the full name of the engineering unit such as ”hour” or ”meter
// http://www.unece.org/fileadmin/DAM/cefact/recommendations/rec20/rec20_rev3_Annex2e.pdf

// To facilitate interoperability, OPC UA specifies how to apply the widely accepted "Codes for Units of Measurement
// (Recommendation N°. 20)” published by the "United Nations Centre for Trade
// Facilitation and Electronic Business” (see UN/CEFACT). It uses and is based on the International System of Units
// (SI Units) but in addition provides a fixed code that can be used for automated evaluation. This recommendation
// has been accepted by many industries on a global basis.
//
// Following is a small excerpt of the published Annex with Code Lists:
// Excerpt from Recommendation N°. 20, Annex 1
// Common Code  Name                     Conversion Factor Symbol
// C81          radian                                           rad
// C25          milliradian                1E-3 rad              mrad
// MMT          millimetre                 1E−3 m                mm
// HMT          hectometre                 1E2  m                 hm
// KTM          kilometre                  1E3  m                 km
// KMQ          kilogram per cubic metre   kg/m3                  kg/m3
// FAH          degree Fahrenheit          5/9 x K                °F
// J23          degree Fahrenheit per hour 1,543 210 x 10− 4 K/s °F/h
// SEC          second [unit of time]
// C26          millisecond                1E-3                  S
// B98          microsecond                1E-6                  S
// Specific columns of this table shall be used to create the EUInformation structure as defined by the following rules:
//
// The Common Code is represented as an alphanumeric variable length of 3 characters. It shall be used for the
// EUInformation.unitId. The following pseudo code specifies the algorithm
// to convert the Common Code into an Int32 as needed for EUInformation.unitId:
export function commonCodeToUInt(code: string): number {
    // CEL =>
    let unitId = 0;
    let c;
    const m = Math.min(4, code.length);
    for (let i = 0; i < m; i++) {
        c = code.charCodeAt(i);
        /* istanbul ignore if*/
        if (c === 0) {
            return unitId;
        }
        unitId *= 256;
        unitId |= c;
    }
    return unitId;
}

export function makeEUInformation(symbol: string, shortName: string, longName: string) {
    return new EUInformation({
        description: { text: longName },
        displayName: { text: shortName },
        unitId: commonCodeToUInt(symbol)
    });
}

export interface StandardUnits {
    ampere: EUInformation;
    bar: EUInformation;
    becquerel: EUInformation;
    centimetre: EUInformation;
    cubic_centimetre: EUInformation;
    cubic_centimetre_per_second: EUInformation;
    cubic_metre: EUInformation;
    cubic_metre_per_hour: EUInformation;
    curie: EUInformation;
    curie_per_kilogram: EUInformation;
    degree: EUInformation;
    degree_celsius: EUInformation;
    degree_fahrenheit: EUInformation;
    dots_per_inch: EUInformation;
    electron_volt: EUInformation;
    farad: EUInformation;
    gigabecquerel: EUInformation;
    gram: EUInformation;
    joule: EUInformation;
    kelvin: EUInformation;
    kilo_electron_volt: EUInformation;
    kilobecquerel: EUInformation;
    kilohertz: EUInformation;
    mega_electron_volt: EUInformation;
    megawatt: EUInformation;
    metre: EUInformation;
    microsecond: EUInformation;
    millimetre: EUInformation;
    millisecond: EUInformation;
    newton: EUInformation;
    percent: EUInformation;
    pixel: EUInformation;
    second: EUInformation;
    volt: EUInformation;
    watt: EUInformation;
}

// http://www.unece.org/fileadmin/DAM/cefact/recommendations/rec20/rec20_rev3_Annex2e.pdf
export const standardUnits: StandardUnits = {
    ampere: makeEUInformation("AMP", "A", "ampere"),
    bar: makeEUInformation("BAR", "bar", "bar [unit of pressure] = 1E5 Pa"),
    becquerel: makeEUInformation("BQL", "Bq", "becquerel = 27,027E-12 Ci"),
    centimetre: makeEUInformation("CMT", "cm", "centimetre = 1E-2 m"),
    cubic_centimetre: makeEUInformation("CMQ", "cm^3", "Cubic centimetre = 1E-6 m^3"),
    cubic_centimetre_per_second: makeEUInformation("2J", "cm^3/s", "Cubic centimetre per second"),
    cubic_metre: makeEUInformation("MTQ", "m^3", "Cubic metre"),
    cubic_metre_per_hour: makeEUInformation("MQH", "m^3", "Cubic metre per hours = 2,777 78 x 10⁻⁴ m³/s"),
    curie: makeEUInformation("CUR", "Ci", "Curie = 3,7E-10 Bq"),
    curie_per_kilogram: makeEUInformation("A42", "Ci/kg", "Curie per kilogram = 3,7E-10 Bq/kg"),
    degree: makeEUInformation("DD", "°", "degree [unit of angle]"),
    degree_celsius: makeEUInformation("CEL", "°C", "degree Celsius"),
    degree_fahrenheit: makeEUInformation("FAH", "°F", "degree Fahrenheit 9/5(°C) + 32°"),
    dots_per_inch: makeEUInformation("E39", "dpi", "dot per inch"),
    electron_volt: makeEUInformation("A53", "eV", "electron volt"),
    farad: makeEUInformation("FAR", "F", "Farad = kg⁻¹ x m⁻² x s⁴ x     A²"),
    gigabecquerel: makeEUInformation("GBQ", "GBq", "Giga becquerel = 1E9 Bq"),
    gram: makeEUInformation("GRM", "g", "gramme 1E-3 kg"),
    joule: makeEUInformation("JOU", "J", "Joule"),
    kelvin: makeEUInformation("KEL", "K", "degree Kelvin"),
    kilo_electron_volt: makeEUInformation("B29", "keV", "kilo electron volt"),
    kilobecquerel: makeEUInformation("2Q", "kBq", "kilo becquerel = 1E3 Bq"),
    kilohertz: makeEUInformation("KHZ", "kHz", "kilo hertz = 1E3 Hertz"),
    mega_electron_volt: makeEUInformation("B71", "MeV", "mega electron volt"),
    megawatt: makeEUInformation("MAW", "MW", "Mega Watt"),
    metre: makeEUInformation("MTR", "m", "metre"),
    microsecond: makeEUInformation("B98", "μs", "microsecond =1E-6 second"),
    millimetre: makeEUInformation("MMT", "mm", "millimetre = 1E-3 metre"),
    millisecond: makeEUInformation("C26", "ms", "millisecond =1E-3 second"),
    newton: makeEUInformation("NEW", "N", "Newton (kg x m)/s² "),
    percent: makeEUInformation("P1", "%", "Percent, a unit of proportion equal to 0.01. "),
    pixel: makeEUInformation("E37", "", "pixel:  unit of count defining the number of pixels (pixel: picture element)"),
    second: makeEUInformation("SEC", "s", "second"),
    volt: makeEUInformation("VLT", "V", "Volt"),
    watt: makeEUInformation("WTT", "W", "Watt")
    // to be continued
};
