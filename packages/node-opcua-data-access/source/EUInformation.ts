/**
 * @module node-opcua-data-access
 */
export { EUInformation } from "node-opcua-types";

/*jslint bitwise: true */

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
    const m = Math.min(4, code.length);
    for (let i = 0; i < m; i++) {
        const c = code.charCodeAt(i);
        /* c8 ignore next*/
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
    one: EUInformation;
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

// https://unece.org/sites/default/files/2021-06/rec20_Rev17e-2021.xlsx
//
// displayName/description below are the OPC Foundation's own UNECE-code -> EUInformation
// mapping table (http://www.opcfoundation.org/UA/EngineeringUnits/UNECE/UNECE_to_OPCUA.csv),
// which is what the CTT's "Base Info Engineering Units" 001/004 test cases validate every
// EUInformation against (see tools/check-unece-table.ts and test/test_EUInformation.ts). Do
// not "improve" these strings with conversion factors or descriptive suffixes: the CTT does
// an exact string compare (a handful of unitIds accept two historic spellings besides the
// table value - see tools/check-unece-table.ts - none of the entries below are among them,
// except percent, noted below).
export const standardUnits: StandardUnits = {
    // pressure
    bar: makeEUInformation("BAR", "bar", "bar [unit of pressure]"),
    hectopascal: makeEUInformation("A97", "hPa", "hectopascal"),
    millibar: makeEUInformation("MBR", "mbar", "millibar"),
    pascal: makeEUInformation("PAL", "Pa", "pascal"),
    kilogram_per_squared_centimeter: makeEUInformation("D5", "kg/cm²", "kilogram per square centimetre"),
    megapascal: makeEUInformation("MPA", "MPa", "megapascal"),

    // time/duration
    microsecond: makeEUInformation("B98", "µs", "microsecond"),
    millisecond: makeEUInformation("C26", "ms", "millisecond"),
    second: makeEUInformation("SEC", "s", "second [unit of time]"),
    // distance
    centimetre: makeEUInformation("CMT", "cm", "centimetre"),
    metre: makeEUInformation("MTR", "m", "metre"),
    millimetre: makeEUInformation("MMT", "mm", "millimetre"),
    // volume
    cubic_centimetre: makeEUInformation("CMQ", "cm³", "cubic centimetre"),
    cubic_metre: makeEUInformation("MTQ", "m³", "cubic metre"),
    // temperature
    degree_celsius: makeEUInformation("CEL", "°C", "degree Celsius"),
    degree_fahrenheit: makeEUInformation("FAH", "°F", "degree Fahrenheit"),
    kelvin: makeEUInformation("KEL", "K", "kelvin"),

    // weight
    gram: makeEUInformation("GRM", "g", "gram"),
    kilogram: makeEUInformation("KGM", "kg", "kilogram"),
    // speed
    metre_per_second: makeEUInformation("MTS", "m/s", "metre per second"),
    mile_per_hour: makeEUInformation("HM", "mile/h", "mile per hour (statute mile)"),
    kilometre_per_hour: makeEUInformation("KMH", "km/h", "kilometre per hour"),

    // acceleration
    metre_per_second_squared: makeEUInformation("MSK", "m/s²", "metre per second squared"),
    // frequency
    kilohertz: makeEUInformation("KHZ", "kHz", "kilohertz"),
    hertz: makeEUInformation("HTZ", "Hz", "hertz"),
    megahertz: makeEUInformation("MHZ", "MHz", "megahertz"),
    revolutions_per_minute: makeEUInformation("RPM", "r/min", "revolutions per minute"),
    revolutions_per_second: makeEUInformation("RPS", "r/s", "revolutions per second"),
    // force
    newton: makeEUInformation("NEW", "N", "newton"),
    kilogram_force: makeEUInformation("B37", "kgf", "kilogram-force"),
    // power
    kilowatt: makeEUInformation("KWT", "kW", "kilowatt"),
    megawatt: makeEUInformation("MAW", "MW", "megawatt"),
    watt: makeEUInformation("WTT", "W", "watt"),
    // rate of flow
    cubic_centimetre_per_second: makeEUInformation("2J", "cm³/s", "cubic centimetre per second"),
    cubic_metre_per_hour: makeEUInformation("MQH", "m³/h", "cubic metre per hour"),
    cubic_meter_per_minute: makeEUInformation("G53", "m³/min", "cubic metre per minute"),
    // angle
    degree: makeEUInformation("DD", "°", "degree [unit of angle]"),

    //
    ampere: makeEUInformation("AMP", "A", "ampere"),
    becquerel: makeEUInformation("BQL", "Bq", "becquerel"),

    curie: makeEUInformation("CUR", "Ci", "curie"),
    curie_per_kilogram: makeEUInformation("A42", "Ci/kg", "curie per kilogram"),

    dots_per_inch: makeEUInformation("E39", "dpi", "dots per inch"),
    electron_volt: makeEUInformation("A53", "eV", "electronvolt"),
    farad: makeEUInformation("FAR", "F", "farad"),
    gigabecquerel: makeEUInformation("GBQ", "GBq", "gigabecquerel"),
    joule: makeEUInformation("JOU", "J", "joule"),
    kilo_electron_volt: makeEUInformation("B29", "keV", "kiloelectronvolt"),
    kilogram_per_second: makeEUInformation("KGS", "kg/s", "kilogram per second"),
    kilopascal: makeEUInformation("KPA", "kPa", "kilopascal"),
    millipascal: makeEUInformation("74", "mPa", "millipascal"),
    kilobecquerel: makeEUInformation("2Q", "kBq", "kilobecquerel"),
    mega_electron_volt: makeEUInformation("B71", "MeV", "megaelectronvolt"),
    megawatt_per_minute: makeEUInformation("Q35", "MW/min", "megawatts per minute"),
    // Foundation table DisplayName for unitId 20529 is "% or pct"; the CTT itself (004.js)
    // also accepts the literal "%" and "pct", so "%" is kept as the (already correct) displayName.
    percent: makeEUInformation("P1", "%", "percent"),
    // H87 (piece) below and E37 (pixel) here are NOT in the OPC Foundation's UNECE_to_OPCUA
    // table: the CTT's 001.js flags any EUInformation carrying them as "not an official UNECE
    // definition". No table-backed equivalent exists for "pixel"; kept for compatibility.
    pixel: makeEUInformation("E37", "", "pixel:  unit of count defining the number of pixels (pixel: picture element)"),
    volt: makeEUInformation("VLT", "V", "volt"),

    byte: makeEUInformation("AD", "byte", "byte"),
    kilobyte: makeEUInformation("2P", "kbyte", "kilobyte"),
    megabyte: makeEUInformation("4L", "Mbyte", "megabyte"),
    gigabyte: makeEUInformation("E34", "Gbyte", "gigabyte"),
    terabyte: makeEUInformation("E35", "Tbyte", "terabyte"),
    minute: makeEUInformation("MIN", "min", "minute [unit of time]"),
    minute_angle: makeEUInformation("D61", "'", "minute [unit of angle]"),
    part_per_million: makeEUInformation("59", "ppm", "part per million"),
    // C62 ("one"), unitId 4404786, IS in the Foundation table: use it for a plain count instead
    // of the non-standard H87 (piece) code carried by categorizedUnits.piece in node-opcua-units.
    one: makeEUInformation("C62", "1", "one")
    // to be continued
};
