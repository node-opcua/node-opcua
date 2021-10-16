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

export function makeEUInformation(symbol: string, shortName: string, longName: string): EUInformation {
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
    byte: EUInformation;
    centimetre: EUInformation;
    cubic_centimetre: EUInformation;
    cubic_centimetre_per_second: EUInformation;
    cubic_metre: EUInformation;
    cubic_metre_per_hour: EUInformation;
    cubic_meter_per_minute: EUInformation;
    curie: EUInformation;
    curie_per_kilogram: EUInformation;
    degree: EUInformation;
    degree_celsius: EUInformation;
    degree_fahrenheit: EUInformation;
    dots_per_inch: EUInformation;
    electron_volt: EUInformation;
    farad: EUInformation;
    gigabecquerel: EUInformation;
    gigabyte: EUInformation;
    gram: EUInformation;
    hectopascal: EUInformation;
    hertz: EUInformation;
    joule: EUInformation;
    kelvin: EUInformation;
    kilo_electron_volt: EUInformation;
    kilobecquerel: EUInformation;
    kilobyte: EUInformation;
    kilohertz: EUInformation;
    kilogram: EUInformation;
    kilogram_force: EUInformation;
    kilogram_per_second: EUInformation;
    kilogram_per_squared_centimeter: EUInformation;
    kilometre_per_hour: EUInformation;
    kilopascal: EUInformation;
    kilowatt: EUInformation;
    mega_electron_volt: EUInformation;
    megabyte: EUInformation;
    megahertz: EUInformation;
    megapascal: EUInformation;
    megawatt: EUInformation;
    megawatt_per_minute: EUInformation;
    metre: EUInformation;
    metre_per_second: EUInformation;
    metre_per_second_squared: EUInformation;
    microsecond: EUInformation;
    mile_per_hour: EUInformation;
    millibar: EUInformation;
    millimetre: EUInformation;
    millipascal: EUInformation;
    millisecond: EUInformation;
    minute: EUInformation;
    minute_angle: EUInformation;
    newton: EUInformation;
    pascal: EUInformation;
    part_per_million: EUInformation;
    percent: EUInformation;
    pixel: EUInformation;
    revolutions_per_minute: EUInformation;
    revolutions_per_second: EUInformation;
    second: EUInformation;
    terabyte: EUInformation;
    volt: EUInformation;
    watt: EUInformation;
}

// http://www.unece.org/fileadmin/DAM/cefact/recommendations/rec20/rec20_rev3_Annex2e.pdf
export const standardUnits: StandardUnits = {
    // pressure
    bar: makeEUInformation("BAR", "bar", "bar [unit of pressure] = 1E5 Pa"),
    hectopascal: makeEUInformation("A97", "hPa", "hectopascal [unit of pressure] = 1E2 Pa"),
    millibar: makeEUInformation("MBR", "mbar", "millibar [unit of pressure] = 1E2 Pa"),
    pascal: makeEUInformation("PAL", "Pa", "pascal [unit of pressure]"),
    kilogram_per_squared_centimeter: makeEUInformation("D5", "kg/cm²", "kilogram per square centimetre"),
    megapascal: makeEUInformation("MPA", "MPa", "1 megapascal =  10⁶ pascal [unit of pressure]"),

    // time/duration
    microsecond: makeEUInformation("B98", "μs", "microsecond =1E-6 second"),
    millisecond: makeEUInformation("C26", "ms", "millisecond =1E-3 second"),
    second: makeEUInformation("SEC", "s", "second"),
    // distance
    centimetre: makeEUInformation("CMT", "cm", "centimetre = 1E-2 m"),
    metre: makeEUInformation("MTR", "m", "metre"),
    millimetre: makeEUInformation("MMT", "mm", "millimetre = 1E-3 metre"),
    // volume
    cubic_centimetre: makeEUInformation("CMQ", "cm³", "Cubic centimetre = 1E-6 m³"),
    cubic_metre: makeEUInformation("MTQ", "m³", "Cubic metre"),
    // temperature
    degree_celsius: makeEUInformation("CEL", "°C", "degree Celsius"),
    degree_fahrenheit: makeEUInformation("FAH", "°F", "degree Fahrenheit 9/5(°C) + 32°"),
    kelvin: makeEUInformation("KEL", "K", "degree Kelvin"),

    // weight
    gram: makeEUInformation("GRM", "g", "gramme 1E-3 kg"),
    kilogram: makeEUInformation("KGM", "kg", "A unit of mass equal to one thousand grams"),
    // speed
    metre_per_second: makeEUInformation("MTS", "m/s", "meter per second"),
    mile_per_hour: makeEUInformation("HM", "mile/h", "mile per hour = 2 0,447 04 m/s"),
    kilometre_per_hour: makeEUInformation("KMH", "km/h", "kilometre per hour = 0,277 778 m/s"),

    // acceleration
    metre_per_second_squared: makeEUInformation("MSK", "m/s²", "meter per second square"),
    // frequency
    kilohertz: makeEUInformation("KHZ", "kHz", "kilo hertz = 1E3 Hertz"),
    hertz: makeEUInformation("HTZ", "Hz", "Hertz"),
    megahertz: makeEUInformation("MHZ", "MHz", "megahertz"),
    revolutions_per_minute: makeEUInformation("RPM", "r/min", "revolutions per minute 1,047198 rad/(60 x s)"),
    revolutions_per_second: makeEUInformation("RPS", "r/s", "revolutions per minute 1,047198 rad/s"),
    // force
    newton: makeEUInformation("NEW", "N", "Newton (kg x m)/s² "),
    kilogram_force: makeEUInformation("B37", "kgf", "kilogram-force 1 kgf = 9.80665 N"),
    // power
    kilowatt: makeEUInformation("KWT", "kW", "kilowatt  1kW = 10³ W"),
    megawatt: makeEUInformation("MAW", "MW", "Mega Watt"),
    watt: makeEUInformation("WTT", "W", "Watt"),
    // rate of flow
    cubic_centimetre_per_second: makeEUInformation("2J", "cm³/s", "Cubic centimetre per second"),
    cubic_metre_per_hour: makeEUInformation("MQH", "m³/h", "Cubic metre per hours = 2,777 78 x 10⁻⁴ m³/s"),
    cubic_meter_per_minute: makeEUInformation("G53", "m³/min", "m³/min	cubic metre per minute"),
    // angle
    degree: makeEUInformation("DD", "°", "degree [unit of angle]"),

    //
    ampere: makeEUInformation("AMP", "A", "ampere"),
    becquerel: makeEUInformation("BQL", "Bq", "becquerel = 27,027E-12 Ci"),

    curie: makeEUInformation("CUR", "Ci", "Curie = 3,7E-10 Bq"),
    curie_per_kilogram: makeEUInformation("A42", "Ci/kg", "Curie per kilogram = 3,7E-10 Bq/kg"),

    dots_per_inch: makeEUInformation("E39", "dpi", "dot per inch"),
    electron_volt: makeEUInformation("A53", "eV", "electron volt"),
    farad: makeEUInformation("FAR", "F", "Farad = kg⁻¹ x m⁻² x s⁴ x     A²"),
    gigabecquerel: makeEUInformation("GBQ", "GBq", "Giga becquerel = 1E9 Bq"),
    joule: makeEUInformation("JOU", "J", "Joule"),
    kilo_electron_volt: makeEUInformation("B29", "keV", "kilo electron volt"),
    kilogram_per_second: makeEUInformation("KGS", "kg/s", "kilogram per second"),
    kilopascal: makeEUInformation("KPA", "kPa", "1 kilopascal = 10³ Pa"),
    millipascal: makeEUInformation("74", "mPa", "1 millipascal = 10⁻³ Pa"),
    kilobecquerel: makeEUInformation("2Q", "kBq", "kilo becquerel = 1E3 Bq"),
    mega_electron_volt: makeEUInformation("B71", "MeV", "mega electron volt"),
    megawatt_per_minute: makeEUInformation(
        "Q35",
        "MW/min",
        "A unit of power defining the total amount of bulk energy transferred or consumer per minute."
    ),
    percent: makeEUInformation("P1", "%", "Percent, a unit of proportion equal to 0.01. "),
    pixel: makeEUInformation("E37", "", "pixel:  unit of count defining the number of pixels (pixel: picture element)"),
    volt: makeEUInformation("VLT", "V", "Volt"),

    byte: makeEUInformation("AD", "byte", "byte = A unit of information equal to 8 bits."),
    kilobyte: makeEUInformation("2P", "kbyte", "kilobyte = A unit of information equal to 10³ (1000) bytes."),
    megabyte: makeEUInformation("4L", "Mbyte", "megabyte = A unit of information equal to 10⁶ (1000000) bytes."),
    gigabyte: makeEUInformation("E34", "Gbyte", "gigabyte = A unit of information equal to 10⁹ bytes."),
    terabyte: makeEUInformation("E35", "Tbyte", "terabyte = A unit of information equal to 10¹² bytes."),
    minute: makeEUInformation("MIN", "min", " minute (unit of time) 1min = 60 s"),
    minute_angle: makeEUInformation("D61", "'", "minute [unit of angle]"),
    part_per_million: makeEUInformation("59", "ppm", "A unit of proportion equal to 10⁻⁶.")
    // to be continued
};
