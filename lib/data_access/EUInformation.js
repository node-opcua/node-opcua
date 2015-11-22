"use strict";
/*jslint bitwise: true */
require("requirish")._(module);
// http://www.unece.org/fileadmin/DAM/cefact/recommendations/rec20/rec20_rev3_Annex2e.pdf
exports.EUInformation = require("_generated_/_auto_generated_EUInformation").EUInformation;

//To facilitate interoperability, OPC UA specifies how to apply the widely accepted "Codes for Units of Measurement
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
exports.commonCodeToUInt = function (code) {
    // CEL =>
    var unitId = 0, c;
    var m = Math.min(4, code.length);
    for (var i = 0; i < m; i++) {
        c = code[i].charCodeAt();
        /* istanbul ignore if*/
        if (c === 0) {
            return unitId;
        }
        unitId *= 256;
        unitId |= c;
    }
    return unitId;
};

var makeEUInformation = function (symbol, shortName, longName) {

    return new exports.EUInformation({
        unitId: exports.commonCodeToUInt(symbol),
        displayName: {text: shortName},
        description: {text: longName}
    });
};
exports.makeEUInformation = makeEUInformation;

// http://www.unece.org/fileadmin/DAM/cefact/recommendations/rec20/rec20_rev3_Annex2e.pdf
exports.standardUnits = {
    ampere:               makeEUInformation("AMP", "A",     "ampere"),
    bar:                  makeEUInformation("BAR", "bar",   "bar [unit of pressure] = 1E5 Pa"),
    becquerel:            makeEUInformation("BQL", "Bq",    "becquerel = 27,027E-12 Ci"),
    kilobecquerel:        makeEUInformation("2Q", "kBq",    "kilo becquerel = 1E3 Bq"),
    gigabecquerel:        makeEUInformation("GBQ", "GBq",   "Giga becquerel = 1E9 Bq"),
    curie:                makeEUInformation("CUR", "Ci",    "Curie = 3,7E-10 Bq"),
    curie_per_kilogram:   makeEUInformation("A42", "Ci/kg", "Curie per kilogram = 3,7E-10 Bq/kg"),
    cubic_centimetre:     makeEUInformation("CMQ", "cm^3",  "Cubic centimetre = 1E-6 m^3"),
    cubic_centimetre_per_second: makeEUInformation("2J",    "cm^3/s", "Cubic centimetre per second"),
    cubic_metre:          makeEUInformation("MTQ", "m^3",   "Cubic metre"),
    cubic_metre_per_hour: makeEUInformation("MQH", "m^3",   "Cubic metre per hours = 2,777 78 x 10⁻⁴ m³/s"),
    degree:               makeEUInformation("DD", "°",      "degree [unit of angle]"),
    degree_celsius:       makeEUInformation("CEL", "°C",    "degree Celsius"),
    degree_fahrenheit:    makeEUInformation("FAH", "°F",    "degree Fahrenheit 9/5(°C) + 32°"),
    kelvin:               makeEUInformation("KEL", "K",     "degree Kelvin"),
    dots_per_inch:        makeEUInformation("E39", "dpi",   "dot per inch"),
    electron_volt:        makeEUInformation("A53", "eV",    "electron volt"),
    kilo_electron_volt:   makeEUInformation("B29", "keV",   "kilo electron volt"),
    mega_electron_volt:   makeEUInformation("B71", "MeV",   "mega electron volt"),
    farad:                makeEUInformation("FAR", "F",     "Farad = kg⁻¹ x m⁻² x s⁴ x     A²"),
    gram:                 makeEUInformation("GRM", "g",     "gramme 1E-3 kg"),
    joule:                makeEUInformation("JOU", "J",     "Joule"),
    kilohertz:            makeEUInformation("KHZ", "kHz",   "kilo hertz = 1E3 Hertz"),
    metre:                makeEUInformation("MTR", "m",     "metre"),
    centimetre:           makeEUInformation("CMT", "cm",    "centimetre = 1E-2 m"),
    millimetre:           makeEUInformation("MMT", "mm",    "millimetre = 1E-3 metre"),
    megawatt:             makeEUInformation("MAW", "MW",    "Mega Watt"),
    newton:               makeEUInformation("NEW", "N",     "Newton (kg x m)/s² "),
    //xx distance:             makeEUInformation("CEL",  "°C", "degree Celsius"),
    percent:              makeEUInformation("P1", "%",      "Percent, a unit of proportion equal to 0.01. "),
    pixel:                makeEUInformation("E37", "",      "pixel:  unit of count defining the number of pixels (pixel: picture element)"),
    volt:                 makeEUInformation("VLT", "V",     "Volt"),
    watt:                 makeEUInformation("WTT", "W",     "Watt"),
    second:               makeEUInformation("SEC", "s",     "second"),
    millisecond:          makeEUInformation("C26", "ms",    "millisecond =1E-3 second"),
    microsecond:          makeEUInformation("B98", "μs",    "microsecond =1E-6 second")
    // to be continued
};
