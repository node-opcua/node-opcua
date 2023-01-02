// Automatically generated file, do not modify
import { makeEUInformation } from "node-opcua-data-access";
export const categorizedUnits = {
   /**
    * Space and Time
    */
   "Space and Time": {
      /**
       * angle (plane)
       */
      "angle (plane)": {
         radian: makeEUInformation("C81", "rad", "radian - rad"),
         milliradian: makeEUInformation("C25", "mrad", "milliradian - 10⁻³ rad"),
         microradian: makeEUInformation("B97", "µrad", "microradian - 10⁻⁶ rad"),
         "degree_[unit_of_angle]": makeEUInformation("DD", "°", "degree [unit of angle] - 1,745 329 × 10⁻² rad"),
         "minute_[unit_of_angle]": makeEUInformation("D61", "", "minute [unit of angle] - 2,908 882 × 10⁻⁴ rad"),
         "second_[unit_of_angle]": makeEUInformation("D62", '"', "second [unit of angle] - 4,848 137 × 10⁻⁶ rad"),
         grade: makeEUInformation("A91", "", "grade - = gon"),
         gon: makeEUInformation("A91", "gon", "gon - Synonym: grade 1,570 796 × 10⁻² rad"),
         mil: makeEUInformation(
            "M43",
            "mil",
            "mil - Unit to indicate an angle at military zone, equal to the 6400th part of the full circle of the 360° or 2·p·rad. 9,817 477  × 10⁻⁴ rad"
         ),
         revolution: makeEUInformation(
            "M44",
            "rev",
            "revolution - Unit to identify an angle of the full circle of 360° or 2·p·rad (Refer ISO/TC12 SI Guide). 6,283 185 rad"
         )
      },
      /**
       * solid angle
       */
      "solid angle": {
         steradian: makeEUInformation("D27", "sr", "steradian - sr"),
         inch_per_two_pi_radiant: makeEUInformation(
            "H57",
            "in/revolution",
            "inch per two pi radiant - 2,54 × 10⁻² m/(2 × π × rad)"
         ),
         degree_per_second: makeEUInformation("E96", "°/s", "degree per second - 1,745 329 × 10⁻² rad × s⁻¹"),
         degree_per_metre: makeEUInformation("H27", "°/m", "degree per metre - 1,745 329 × 10⁻² rad/m"),
         metre_per_radiant: makeEUInformation(
            "M55",
            "m/rad",
            "metre per radiant - Unit of the translation factor for implementation from rotation to linear movement. m/rad"
         )
      },
      /**
       * length, breadth, height, thickness, radius, radius of curvature, cartesian coordinates, diameter, length of path, distance
       */
      "length, breadth, height, thickness, radius, radius of curvature, cartesian coordinates, diameter, length of path, distance":
      {
         metre: makeEUInformation("MTR", "m", "metre - m"),
         decimetre: makeEUInformation("DMT", "dm", "decimetre - 10⁻¹ m"),
         centimetre: makeEUInformation("CMT", "cm", "centimetre - 10⁻² m"),
         "micrometre_(micron)": makeEUInformation("4H", "µm", "micrometre (micron) - 10⁻⁶ m"),
         millimetre: makeEUInformation("MMT", "mm", "millimetre - 10⁻³ m"),
         hectometre: makeEUInformation("HMT", "hm", "hectometre - 10² m"),
         kilometre: makeEUInformation("KMT", "km", "kilometre - 10³ m"),
         nanometre: makeEUInformation("C45", "nm", "nanometre - 10⁻⁹ m"),
         picometre: makeEUInformation("C52", "pm", "picometre - 10⁻¹² m"),
         femtometre: makeEUInformation("A71", "fm", "femtometre - 10⁻¹⁵ m"),
         decametre: makeEUInformation("A45", "dam", "decametre - 10 m"),
         nautical_mile: makeEUInformation("NMI", "n mile", "nautical mile - 1 852 m"),
         angstrom: makeEUInformation("A11", "Å", "angstrom - 10⁻¹⁰ m"),
         astronomical_unit: makeEUInformation("A12", "ua", "astronomical unit - 1,495 978 70 × 10¹¹ m"),
         parsec: makeEUInformation("C63", "pc", "parsec - 3,085 678 × 10¹⁶ m"),
         metre_per_kelvin: makeEUInformation("F52", "m/K", "metre per kelvin - m × K⁻¹"),
         micrometre_per_kelvin: makeEUInformation("F50", "µm/K", "micrometre per kelvin - 10⁻⁶ m × K⁻¹"),
         centimetre_per_kelvin: makeEUInformation("F51", "cm/K", "centimetre per kelvin - 10⁻² m × K⁻¹"),
         millimetre_per_bar: makeEUInformation("G06", "mm/bar", "millimetre per bar - 10⁻⁸ kg⁻¹ × m² × s²"),
         gram_millimetre: makeEUInformation("H84", "g·mm", "gram millimetre - 10⁻⁶ kg × m"),
         centimetre_per_bar: makeEUInformation("G04", "cm/bar", "centimetre per bar - 10⁻⁷ kg⁻¹ × m² × s²"),
         metre_per_bar: makeEUInformation("G05", "m/bar", "metre per bar - 10⁻⁵ kg⁻¹ × m² × s²"),
         French_gauge: makeEUInformation(
            "H79",
            "Fg",
            "French gauge - A unit of distance used for measuring the diameter of small tubes such as urological instruments and catheters.  Synonym: French, Charrière, Charrière gauge 0,333 333 333 × 10⁻³ m"
         ),
         fathom: makeEUInformation("AK", "fth", "fathom - 1,828 8 m"),
         Gunters_chain: makeEUInformation(
            "X1",
            "ch (UK)",
            "Gunters chain - A unit of distance used or formerly used by British surveyors. 20,116 8 m"
         ),
         inch: makeEUInformation("INH", "in", "inch - 25,4 x 10⁻³ m"),
         "micro-inch": makeEUInformation("M7", "µin", "micro-inch - 25,4 x 10⁻⁹ m"),
         foot: makeEUInformation("FOT", "ft", "foot - 0,304 8 m"),
         yard: makeEUInformation("YRD", "yd", "yard - 0,914 4 m"),
         "mile_(statute_mile)": makeEUInformation("SMI", "mile", "mile (statute mile) - 1 609,344 m"),
         "milli-inch": makeEUInformation("77", "mil", "milli-inch - 25,4 x 10⁻⁶ m"),
         light_year: makeEUInformation(
            "B57",
            "ly",
            "light year - A unit of length defining the distance that light travels in a vacuum in one year. 9,460 73 x 10¹⁵ m"
         ),
         "rod_[unit_of_distance]": makeEUInformation(
            "F49",
            "rd (US)",
            "rod [unit of distance] - A unit of distance equal to 5.5 yards (16 feet 6 inches). 5,029 210 m"
         ),
         megametre: makeEUInformation("MAM", "Mm", "megametre - 10⁶ m"),
         foot_per_degree_Fahrenheit: makeEUInformation("K13", "ft/°F", "foot per degree Fahrenheit - 0,548 64 m/K"),
         foot_per_psi: makeEUInformation("K17", "ft/psi", "foot per psi - 4,420 750 x 10⁻⁵ m/Pa"),
         inch_per_degree_Fahrenheit: makeEUInformation("K45", "in/°F", "inch per degree Fahrenheit - 4,572 x 10⁻² m/K"),
         inch_per_psi: makeEUInformation("K46", "in/psi", "inch per psi - 3,683 959 x 10⁻⁶ m/Pa"),
         yard_per_degree_Fahrenheit: makeEUInformation("L98", "yd/°F", "yard per degree Fahrenheit - 1,645 92 m/K"),
         yard_per_psi: makeEUInformation("L99", "yd/psi", "yard per psi - 1,326 225 x 10⁻⁴ m/Pa"),
         "chain_(based_on_U.S._survey_foot)": makeEUInformation(
            "M49",
            "ch (US survey) ",
            "chain (based on U.S. survey foot) - Unit of the length according the Anglo-American system of units. 2,011684 x 10 m"
         ),
         furlong: makeEUInformation(
            "M50",
            "fur",
            "furlong - Unit commonly used in Great Britain at rural distances: 1 furlong = 40 rods = 10 chains (UK) = 1/8 mile = 1/10 furlong = 220 yards = 660 foot. 2,011 68 x 10² m"
         ),
         "foot_(U.S._survey)_": makeEUInformation(
            "M51",
            "ft (US survey) ",
            "foot (U.S. survey)  - Unit commonly used in the United States for ordnance survey.  3,048 006 x 10⁻¹ m"
         ),
         "mile_(based_on_U.S._survey_foot)_": makeEUInformation(
            "M52",
            "mi (US survey) ",
            "mile (based on U.S. survey foot)  - Unit commonly used in the United States for ordnance survey. 1,609347 x 10³ m"
         ),
         metre_per_pascal: makeEUInformation(
            "M53",
            "m/Pa",
            "metre per pascal - SI base unit metre divided by the derived SI unit pascal. kg⁻¹ x m² x s²"
         ),
         american_wire_gauge: makeEUInformation(
            "AWG",
            "AWG",
            "american wire gauge - A unit of distance used for measuring the diameter of small tubes or wires such as the outer diameter od hypodermic or suture needles. "
         )
      },
      /**
       * area
       */
      area: {
         square_metre: makeEUInformation("MTK", "m²", "square metre - m²"),
         square_kilometre: makeEUInformation("KMK", "km²", "square kilometre - 10⁶ m²"),
         "square_micrometre_(square_micron)": makeEUInformation("H30", "µm²", "square micrometre (square micron) - 10⁻¹² m²"),
         square_metre_per_newton: makeEUInformation("H59", "m²/N", "square metre per newton - m x kg⁻¹ x s²"),
         decare: makeEUInformation("DAA", "daa", "decare - 10³ m²"),
         square_centimetre: makeEUInformation("CMK", "cm²", "square centimetre - 10⁻⁴ m²"),
         square_decimetre: makeEUInformation("DMK", "dm²", "square decimetre - 10⁻² m²"),
         square_decametre: makeEUInformation("H16", "dam²", "square decametre - Synonym: are 10² m²"),
         square_hectometre: makeEUInformation("H18", "hm²", "square hectometre - Synonym: hectare 10⁴ m²"),
         square_millimetre: makeEUInformation("MMK", "mm²", "square millimetre - 10⁻⁶ m²"),
         are: makeEUInformation("ARE", "a", "are - Synonym: square decametre 10² m²"),
         hectare: makeEUInformation("HAR", "ha", "hectare - Synonym: square hectometre 10⁴ m²"),
         square_inch: makeEUInformation("INK", "in²", "square inch - 6,451 6 x 10⁻⁴ m²"),
         square_foot: makeEUInformation("FTK", "ft²", "square foot - 9,290 304 x 10⁻² m²"),
         square_yard: makeEUInformation("YDK", "yd²", "square yard - 8,361 274 x 10⁻¹ m²"),
         "square_mile_(statute_mile)": makeEUInformation("MIK", "mi²", "square mile (statute mile) - 2,589 988 km²"),
         "square_mile_(based_on_U.S._survey_foot)_": makeEUInformation(
            "M48",
            "mi² (US survey)",
            "square mile (based on U.S. survey foot)  - Unit of the area, which is mainly common in the agriculture and forestry. 2,589 998 x 10⁶ m²"
         ),
         acre: makeEUInformation("ACR", "acre", "acre - 4 046,873 m²"),
         circular_mil_: makeEUInformation(
            "M47",
            "cmil",
            "circular mil  - Unit of an area, of which the size is given by a diameter of length of 1 mm (0,001 in) based on the formula: area = p·(diameter/2)². 5,067 075 x 10⁻¹⁰ m²"
         )
      },
      /**
       * volume
       */
      volume: {
         cubic_metre: makeEUInformation("MTQ", "m³", "cubic metre - Synonym: metre cubed m³"),
         megalitre: makeEUInformation("MAL", "Ml", "megalitre - 10³ m³"),
         litre: makeEUInformation("LTR", "l", "litre - 10⁻³ m³"),
         cubic_millimetre: makeEUInformation("MMQ", "mm³", "cubic millimetre - 10⁻⁹ m³"),
         cubic_centimetre: makeEUInformation("CMQ", "cm³", "cubic centimetre - 10⁻⁶ m³"),
         cubic_decimetre: makeEUInformation("DMQ", "dm³", "cubic decimetre - 10⁻³ m³"),
         millilitre: makeEUInformation("MLT", "ml", "millilitre - 10⁻⁶ m³"),
         hectolitre: makeEUInformation("HLT", "hl", "hectolitre - 10⁻¹ m³"),
         centilitre: makeEUInformation("CLT", "cl", "centilitre - 10⁻⁵ m³"),
         cubic_decametre: makeEUInformation("DMA", "dam³", "cubic decametre - 10³ m³"),
         cubic_hectometre: makeEUInformation("H19", "hm³", "cubic hectometre - 10⁶ m³"),
         cubic_kilometre: makeEUInformation("H20", "km³", "cubic kilometre - 10⁹ m³"),
         cubic_metre_per_pascal: makeEUInformation(
            "M71",
            "m³/Pa",
            "cubic metre per pascal - Power of the SI base unit meter by exponent 3 divided by the derived SI base unit pascal. kg⁻¹ x m⁴ x s²"
         ),
         decilitre: makeEUInformation("DLT", "dl", "decilitre - 10⁻⁴ m³"),
         microlitre: makeEUInformation("4G", "µl", "microlitre - 10⁻⁹ m³"),
         kilolitre: makeEUInformation("K6", "kl", "kilolitre - m³"),
         decalitre: makeEUInformation("A44", "dal", "decalitre - 10⁻² m³"),
         cubic_centimetre_per_bar: makeEUInformation("G94", "cm³/bar", "cubic centimetre per bar - 10⁻¹¹ kg⁻¹ x m⁴ x s²"),
         litre_per_bar: makeEUInformation("G95", "l/bar", "litre per bar - 10⁻⁸ kg⁻¹ x m⁴ x s²"),
         cubic_metre_per_bar: makeEUInformation("G96", "m³/bar", "cubic metre per bar - 10⁻⁵ kg⁻¹ x m⁴ x s²"),
         millilitre_per_bar: makeEUInformation("G97", "ml/bar", "millilitre per bar - 10⁻¹¹ kg⁻¹ x m⁴ x s²"),
         standard_cubic_foot: makeEUInformation("5I", "std", "standard cubic foot - Use standard (common code WSD) 4,672 m³"),
         cubic_inch: makeEUInformation("INQ", "in³", "cubic inch - Synonym: inch cubed 16,387 064 x 10⁻⁶ m³"),
         cubic_foot: makeEUInformation("FTQ", "ft³", "cubic foot - 2,831 685 x 10⁻² m³"),
         cubic_yard: makeEUInformation("YDQ", "yd³", "cubic yard - 0,764 555 m³"),
         "gallon_(UK)": makeEUInformation("GLI", "gal (UK)", "gallon (UK) - 4,546 092 x 10⁻³ m³"),
         "gallon_(US)": makeEUInformation("GLL", "gal (US)", "gallon (US) - 3,785 412 x 10⁻³ m³"),
         "pint_(US)": makeEUInformation("PT", "pt (US)", "pint (US) - Use liquid pint (common code PTL) 4, 731 76 x 10⁻⁴ m³"),
         "pint_(UK)": makeEUInformation("PTI", "pt (UK)", "pint (UK) - 5, 682 61 x 10⁻⁴ m³"),
         "quart_(UK)": makeEUInformation("QTI", "qt (UK)", "quart (UK) - 1,136 522 5 x 10⁻³ m³"),
         "liquid_pint_(US)": makeEUInformation("PTL", "liq pt (US)", "liquid pint (US) - 4, 731 765 x 10⁻⁴ m³"),
         "liquid_quart_(US)": makeEUInformation("QTL", "liq qt (US)", "liquid quart (US) - 9,463 529 x 10⁻⁴ m³"),
         "dry_pint_(US)": makeEUInformation("PTD", "dry pt (US)", "dry pint (US) - 5,506 105 x 10⁻⁴ m³"),
         "fluid_ounce_(UK)": makeEUInformation("OZI", "fl oz (UK)", "fluid ounce (UK) - 2,841 306 x 10⁻⁵ m³"),
         "quart_(US)": makeEUInformation(
            "QT",
            "qt (US)",
            "quart (US) - Use liquid quart (common code QTL) 0,946 352 9 x 10⁻³ m³"
         ),
         "barrel_(UK_petroleum)": makeEUInformation("J57", "bbl (UK liq.)", "barrel (UK petroleum) - 0,159 113 15 m³"),
         cubic_foot_per_degree_Fahrenheit: makeEUInformation(
            "K21",
            "ft³/°F",
            "cubic foot per degree Fahrenheit - 5,097 033 x 10⁻² m³/K"
         ),
         cubic_foot_per_psi: makeEUInformation("K23", "ft³/psi", "cubic foot per psi - 4,107 012 x 10⁻⁶ m³/Pa"),
         "peck_(UK)": makeEUInformation("L43", "pk (UK)", "peck (UK) - 9,092 181 x 10⁻³ m³"),
         "pint_(US_dry)": makeEUInformation(
            "L61",
            "pt (US dry)",
            "pint (US dry) - Use dry pint (common code PTD) 5,506 105 x 10⁻⁴ m³"
         ),
         "quart_(US_dry)": makeEUInformation(
            "L62",
            "qt (US dry)",
            "quart (US dry) - Use dry quart (US) (common code QTD) 1,101 221 x 10⁻³ m³"
         ),
         "ton_(UK_shipping)": makeEUInformation("L84", "British shipping ton", "ton (UK shipping) - 1,189 3 m³"),
         "ton_(US_shipping)": makeEUInformation("L86", "(US) shipping ton", "ton (US shipping) - 1,132 6 m³"),
         cubic_yard_per_degree_Fahrenheit: makeEUInformation(
            "M11",
            "yd³/°F",
            "cubic yard per degree Fahrenheit - 1,376 199 m³/K"
         ),
         cubic_yard_per_psi: makeEUInformation("M14", "yd³/psi", "cubic yard per psi - 1,108 893 x 10⁻⁴ m³/Pa"),
         "fluid_ounce_(US)": makeEUInformation("OZA", "fl oz (US)", "fluid ounce (US) - 2,957 353 x 10⁻⁵ m³"),
         "bushel_(UK)": makeEUInformation("BUI", "bushel (UK)", "bushel (UK) - 3,636 872 x 10⁻² m³"),
         "bushel_(US)": makeEUInformation("BUA", "bu (US)", "bushel (US) - 3,523 907 x 10⁻² m³"),
         "barrel_(US)": makeEUInformation("BLL", "barrel (US)", "barrel (US) - 158,987 3 x 10⁻³ m³"),
         "dry_barrel_(US)": makeEUInformation("BLD", "bbl (US)", "dry barrel (US) - 1,156 27 x 10⁻¹ m³"),
         "dry_gallon_(US)": makeEUInformation("GLD", "dry gal (US)", "dry gallon (US) - 4,404 884 x 10⁻³ m³"),
         "dry_quart_(US)": makeEUInformation("QTD", "dry qt (US)", "dry quart (US) - 1,101 221 x 10⁻³ m³"),
         stere: makeEUInformation("G26", "st", "stere - m³"),
         "cup_[unit_of_volume]": makeEUInformation("G21", "cup (US)", "cup [unit of volume] - 2,365 882 x 10⁻⁴ m³"),
         "tablespoon_(US)": makeEUInformation("G24", "tablespoon (US)", "tablespoon (US) - 1,478 676 x 10⁻⁵ m³"),
         "teaspoon_(US)": makeEUInformation("G25", "teaspoon (US)", "teaspoon (US) - 4,928 922 x 10⁻⁶ m³"),
         peck: makeEUInformation("G23", "pk (US)", "peck - 8,809 768 x 10⁻³ m³"),
         "acre-foot_(based_on_U.S._survey_foot)": makeEUInformation(
            "M67",
            "acre-ft (US survey)",
            "acre-foot (based on U.S. survey foot) - Unit of the volume, which is used in the United States to measure/gauge the capacity of reservoirs. 1,233 489 x 10³ m³"
         ),
         "cord_(128_ft3)": makeEUInformation(
            "M68",
            "cord",
            "cord (128 ft3) - Traditional unit of the volume of stacked firewood which has been measured with a cord. 3,624 556 m³"
         ),
         "cubic_mile_(UK_statute)": makeEUInformation(
            "M69",
            "mi³",
            "cubic mile (UK statute) - Unit of volume according to the Imperial system of units. 4,168 182 x 10⁹ m³"
         ),
         "ton,_register_": makeEUInformation(
            "M70",
            "RT",
            "ton, register  - Traditional unit of the cargo capacity. 2,831 685 m³"
         ),
         femtolitre: makeEUInformation("Q32", "fl", "femtolitre - 10-18 m3"),
         picolitre: makeEUInformation("Q33", "pl", "picolitre - 10-15 m3"),
         nanolitre: makeEUInformation("Q34", "nl", "nanolitre - 10-12 m3"),
         Normalised_cubic_metre: makeEUInformation(
            "NM3",
            "",
            "Normalised cubic metre - Normalised cubic metre (temperature 0°C and pressure 101325 millibars ) m3"
         ),
         Standard_cubic_metre: makeEUInformation(
            "SM3",
            "",
            "Standard cubic metre - Standard cubic metre (temperature 15°C and pressure 101325 millibars ) m3"
         )
      },
      /**
       * volume per temperature
       */
      "volume per temperature": {
         cubic_centimetre_per_kelvin: makeEUInformation("G27", "cm³/K", "cubic centimetre per kelvin - 10⁻⁶ m³ x K⁻¹"),
         cubic_metre_per_kelvin: makeEUInformation("G29", "m³/K", "cubic metre per kelvin - m³ x K⁻¹"),
         litre_per_kelvin: makeEUInformation("G28", "l/K", "litre per kelvin - 10⁻³ m³ x K⁻¹"),
         millilitre_per_kelvin: makeEUInformation("G30", "ml/K", "millilitre per kelvin - 10⁻⁶ m³ x K⁻¹")
      },
      /**
       * volume ratio
       */
      "volume ratio": {
         microlitre_per_litre: makeEUInformation("J36", "µl/l", "microlitre per litre - 10⁻⁶"),
         cubic_centimetre_per_cubic_metre: makeEUInformation("J87", "cm³/m³", "cubic centimetre per cubic metre - 10⁻⁶"),
         cubic_decimetre_per_cubic_metre: makeEUInformation("J91", "dm³/m³", "cubic decimetre per cubic metre - 10⁻³"),
         litre_per_litre: makeEUInformation("K62", "l/l", "litre per litre - 1"),
         millilitre_per_litre: makeEUInformation("L19", "ml/l", "millilitre per litre - 10⁻³"),
         cubic_millimetre_per_cubic_metre: makeEUInformation("L21", "mm³/m³", "cubic millimetre per cubic metre - 10⁹")
      },
      /**
       * time
       */
      time: {
         "second_[unit_of_time]": makeEUInformation("SEC", "s", "second [unit of time] - s"),
         "minute_[unit_of_time]": makeEUInformation("MIN", "min", "minute [unit of time] - 60 s"),
         hour: makeEUInformation("HUR", "h", "hour - 3 600 s"),
         day: makeEUInformation("DAY", "d", "day - 86 400 s"),
         kilosecond: makeEUInformation("B52", "ks", "kilosecond - 10³ s"),
         millisecond: makeEUInformation("C26", "ms", "millisecond - 10⁻³ s"),
         picosecond: makeEUInformation("H70", "ps", "picosecond - 10⁻¹² s"),
         microsecond: makeEUInformation("B98", "µs", "microsecond - 10⁻⁶ s"),
         nanosecond: makeEUInformation("C47", "ns", "nanosecond - 10⁻⁹ s"),
         week: makeEUInformation("WEE", "wk", "week - 6,048 x 10⁵ s"),
         month: makeEUInformation("MON", "mo", "month - Unit of time equal to 1/12 of a year of 365,25 days. 2,629 800 x 10⁶ s"),
         year: makeEUInformation("ANN", "y", "year - Unit of time equal to 365,25 days.  Synonym: Julian year 3,155 76 x 10⁷ s"),
         tropical_year: makeEUInformation(
            "D42",
            "y (tropical)",
            "tropical year - Unit of time equal to about 365.242 19 days.  Synonym: solar year 3,155 692 5 x 10⁷ s"
         ),
         common_year: makeEUInformation("L95", "y (365 days)", "common year - 3,153 6 x 10⁷ s"),
         sidereal_year: makeEUInformation("L96", "y (sidereal)", "sidereal year - 3,155 815 x 10⁷ s"),
         shake: makeEUInformation("M56", "shake", "shake - Unit for a very short period. 10⁻⁸ s")
      },
      /**
       * angular velocity
       */
      "angular velocity": {
         radian_per_second: makeEUInformation("2A", "rad/s", "radian per second - Refer ISO/TC12 SI Guide rad/s"),
         revolution_per_minute_: makeEUInformation(
            "M46",
            "r/min",
            "revolution per minute  - Unit of the angular velocity. 0,104 719 8 rad/s"
         )
      },
      /**
       * angular acceleration
       */
      "angular acceleration": {
         radian_per_second_squared: makeEUInformation(
            "2B",
            "rad/s²",
            "radian per second squared - Refer ISO/TC12 SI Guide rad/s²"
         ),
         "degree_[unit_of_angle]_per_second_squared": makeEUInformation(
            "M45",
            "°/s²",
            "degree [unit of angle] per second squared - 360 part of a full circle divided by the power of the SI base unit second and the exponent 2. 1,745 329 x 10⁻² rad / s"
         )
      },
      /**
       * velocity, phase velocity, group velocity
       */
      "velocity, phase velocity, group velocity": {
         metre_per_second: makeEUInformation("MTS", "m/s", "metre per second - m/s"),
         knot: makeEUInformation("KNT", "kn", "knot - 0,514 444 m/s"),
         kilometre_per_hour: makeEUInformation("KMH", "km/h", "kilometre per hour - 0,277 778 m/s"),
         millimetre_per_second: makeEUInformation("C16", "mm/s", "millimetre per second - 10⁻³ m/s"),
         centimetre_per_second: makeEUInformation("2M", "cm/s", "centimetre per second - 10⁻² m/s"),
         centimetre_per_hour: makeEUInformation("H49", "cm/h", "centimetre per hour - 0,277 777 778 × 10⁻⁶ m x s⁻¹"),
         millimetre_per_minute: makeEUInformation("H81", "mm/min", "millimetre per minute - 1,666 666 667 × 10⁻⁵ m x s⁻¹"),
         metre_per_minute: makeEUInformation("2X", "m/min", "metre per minute - 0,016 666 m/s"),
         metre_per_second_pascal: makeEUInformation(
            "M59",
            "(m/s)/Pa",
            "metre per second pascal - SI base unit meter divided by the product of SI base unit second and the derived SI unit pascal. m² x kg⁻¹ x s"
         ),
         millimetre_per_year: makeEUInformation("H66", "mm/y", "millimetre per year - 3,15576 × 10⁴ m x s⁻¹"),
         millimetre_per_hour: makeEUInformation("H67", "mm/h", "millimetre per hour - 0,277 777 778 × 10⁻⁷ m x s⁻¹"),
         foot_per_minute: makeEUInformation("FR", "ft/min", "foot per minute - 5,08 x 10⁻³ m/s"),
         inch_per_second: makeEUInformation("IU", "in/s", "inch per second - 0,025 4 m/s"),
         foot_per_second: makeEUInformation("FS", "ft/s", "foot per second - 0,304 8 m/s"),
         "mile_per_hour_(statute_mile)": makeEUInformation("HM", "mile/h", "mile per hour (statute mile) - 0,447 04 m/s"),
         centimetre_per_second_kelvin: makeEUInformation("J84", "(cm/s)/K", "centimetre per second kelvin - 10⁻² (m/s)/K"),
         centimetre_per_second_bar: makeEUInformation("J85", "(cm/s)/bar", "centimetre per second bar - 10⁻⁷ (m/s)/Pa"),
         foot_per_hour: makeEUInformation("K14", "ft/h", "foot per hour - 8,466 667 x 10⁻⁵m/s"),
         foot_per_second_degree_Fahrenheit: makeEUInformation(
            "K18",
            "(ft/s)/°F",
            "foot per second degree Fahrenheit - 0,548 64  (m/s)/K"
         ),
         foot_per_second_psi: makeEUInformation("K19", "(ft/s)/psi", "foot per second psi - 4,420 750 x 10⁻⁵ (m/s)/Pa"),
         inch_per_second_degree_Fahrenheit: makeEUInformation(
            "K47",
            "(in/s)/°F",
            "inch per second degree Fahrenheit - 4,572 x 10⁻² (m/s)/K"
         ),
         inch_per_second_psi: makeEUInformation("K48", "(in/s)/psi", "inch per second psi - 3,683 959 x 10⁻⁶ (m/s)/Pa"),
         metre_per_second_kelvin: makeEUInformation("L12", "(m/s)/K", "metre per second kelvin - (m/s)/K"),
         metre_per_second_bar: makeEUInformation("L13", "(m/s)/bar", "metre per second bar - 10⁻⁵ (m/s)/Pa"),
         millilitre_per_square_centimetre_minute: makeEUInformation(
            "M22",
            "(ml/min)/cm²",
            "millilitre per square centimetre minute - 2,777 778 x 10⁻⁶  (m³/s)/m²"
         ),
         mile_per_minute_: makeEUInformation(
            "M57",
            "mi/min",
            "mile per minute  - Unit of velocity from the Imperial system of units. 26,822 4 m/s"
         ),
         mile_per_second_: makeEUInformation(
            "M58",
            "mi/s",
            "mile per second  - Unit of the velocity from the Imperial system of units. 1,609 344 x 10³ m/s"
         ),
         metre_per_hour: makeEUInformation(
            "M60",
            "m/h",
            "metre per hour - SI base unit metre divided by the unit hour. 2,777 78 x 10⁻⁴ m/s"
         ),
         inch_per_year: makeEUInformation(
            "M61",
            "in/y",
            "inch per year - Unit of the length according to the Anglo-American and Imperial system of units divided by the unit common year with 365 days. 8,048 774 x 10⁻¹⁰ m/s"
         ),
         kilometre_per_second_: makeEUInformation(
            "M62",
            "km/s",
            "kilometre per second  - 1000-fold of the SI base unit metre divided by the SI base unit second. 10³ m/s"
         ),
         inch_per_minute: makeEUInformation(
            "M63",
            "in/min",
            "inch per minute - Unit inch according to the Anglo-American and Imperial system of units divided by the unit minute. 4,233 333 x 10⁻⁴ m/s"
         ),
         yard_per_second: makeEUInformation(
            "M64",
            "yd/s",
            "yard per second - Unit yard according to the Anglo-American and Imperial system of units divided by the SI base unit second. 9,144 x 10⁻¹ m/s"
         ),
         yard_per_minute: makeEUInformation(
            "M65",
            "yd/min",
            "yard per minute - Unit yard according to the Anglo-American and Imperial system of units divided by the unit minute. 1,524 x 10⁻² m/s"
         ),
         yard_per_hour: makeEUInformation(
            "M66",
            "yd/h",
            "yard per hour - Unit yard according to the Anglo-American and Imperial system of units divided by the unit hour. 2,54 x 10⁻⁴ m/s"
         )
      },
      /**
       * acceleration, acceleration of free fall, acceleration due to gravity
       */
      "acceleration, acceleration of free fall, acceleration due to gravity": {
         metre_per_second_squared: makeEUInformation("MSK", "m/s²", "metre per second squared - m/s²"),
         gal: makeEUInformation("A76", "Gal", "gal - 10⁻² m/s²"),
         milligal: makeEUInformation("C11", "mGal", "milligal - 10⁻⁵ m/s²"),
         kilometre_per_second_squared: makeEUInformation(
            "M38",
            "km/s²",
            "kilometre per second squared - 1000-fold of the SI base unit metre divided by the power of the SI base unit second by exponent 2. 10³ m/s²"
         ),
         centimetre_per_second_squared: makeEUInformation(
            "M39",
            "cm/s²",
            "centimetre per second squared - 0,01-fold of the SI base unit metre divided by the power of the SI base unit second by exponent 2. 10⁻² m/s²"
         ),
         millimetre_per_second_squared: makeEUInformation(
            "M41",
            "mm/s²",
            "millimetre per second squared - 0,001-fold of the SI base unit metre divided by the power of the SI base unit second by exponent 2. 10⁻³ m/s²"
         ),
         foot_per_second_squared: makeEUInformation("A73", "ft/s²", "foot per second squared - 0,304 8 m/s²"),
         inch_per_second_squared: makeEUInformation("IV", "in/s²", "inch per second squared - 0,025 4 m/s²"),
         standard_acceleration_of_free_fall: makeEUInformation(
            "K40",
            "gn",
            "standard acceleration of free fall - 9,806 65 m/s²"
         ),
         yard_per_second_squared: makeEUInformation(
            "M40",
            "yd/s²",
            "yard per second squared - Unit of the length according to the Anglo-American and Imperial system of units divided by the power of the SI base unit second by exponent 2. 9,144 x 10⁻¹ m/s²"
         ),
         "mile_(statute_mile)_per_second_squared": makeEUInformation(
            "M42",
            "mi/s²",
            "mile (statute mile) per second squared - Unit of the length according to the Imperial system of units divided by the power of the SI base unit second by exponent 2. 1,609 344 x 10³ m/s²"
         )
      },
      /**
       * curvature
       */
      curvature: {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      }
   },
   /**
    * Periodic and related phenomena
    */
   "Periodic and related phenomena": {
      /**
       * frequency
       */
      frequency: {
         hertz: makeEUInformation("HTZ", "Hz", "hertz - Hz"),
         kilohertz: makeEUInformation("KHZ", "kHz", "kilohertz - 10³ Hz"),
         megahertz: makeEUInformation("MHZ", "MHz", "megahertz - 10⁶ Hz"),
         terahertz: makeEUInformation("D29", "THz", "terahertz - 10¹² Hz"),
         gigahertz: makeEUInformation("A86", "GHz", "gigahertz - 10⁹ Hz"),
         millihertz: makeEUInformation(
            "MTZ",
            "mHz ",
            "millihertz - A unit of frequency equal to 0.001 cycle per second 10-3 Hz"
         ),
         reciprocal_hour: makeEUInformation("H10", "1/h", "reciprocal hour - 2,777 78 × 10⁻⁴ s⁻¹"),
         reciprocal_month: makeEUInformation("H11", "1/mo", "reciprocal month - 3,802 57 × 10⁻⁷ s⁻¹"),
         reciprocal_year: makeEUInformation("H09", "1/y", "reciprocal year - 3,168 81 x 10⁻⁸ s⁻¹"),
         reciprocal_week: makeEUInformation("H85", "1/wk", "reciprocal week - 1,647 989 452 868 × 10⁻⁶ s⁻¹"),
         oscillations_per_minute: makeEUInformation(
            "OPM",
            "o/min",
            "oscillations per minute - The number of oscillation per minute 1.667 x 10-2 /s"
         )
      },
      /**
       * rotational frequency
       */
      "rotational frequency": {
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹"),
         revolutions_per_second: makeEUInformation("RPS", "r/s", "revolutions per second - Refer ISO/TC12 SI Guide 1/s"),
         revolutions_per_minute: makeEUInformation(
            "RPM",
            "r/min",
            "revolutions per minute - Refer ISO/TC12 SI Guide 1,67 x 10⁻²/s"
         ),
         reciprocal_minute: makeEUInformation("C94", "min⁻¹", "reciprocal minute - 1,666 667 x 10⁻² s")
      },
      /**
       * angular frequency, pulsatance
       */
      "angular frequency, pulsatance": {
         radian_per_second: makeEUInformation("2A", "rad/s", "radian per second - Refer ISO/TC12 SI Guide rad/s"),
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹")
      },
      /**
       * wavelength
       */
      wavelength: {
         metre: makeEUInformation("MTR", "m", "metre - m"),
         angstrom: makeEUInformation("A11", "Å", "angstrom - 10⁻¹⁰ m")
      },
      /**
       * wave number, attenuation coefficient, phase coefficient, propagation coefficient, repetency
       */
      "wave number, attenuation coefficient, phase coefficient, propagation coefficient, repetency": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * level of a field quantity, level of a power quantity
       */
      "level of a field quantity, level of a power quantity": {
         neper: makeEUInformation("C50", "Np", "neper - Np"),
         decibel: makeEUInformation("2N", "dB", "decibel - 0,115 129 3 Np"),
         bel: makeEUInformation("M72", "B", "bel - Logarithmic relationship to base 10. B")
      },
      /**
       * damping coefficient
       */
      "damping coefficient": {
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹"),
         neper_per_second: makeEUInformation("C51", "Np/s", "neper per second - Np/s")
      },
      /**
       * logarithmic decrement
       */
      "logarithmic decrement": {
         neper: makeEUInformation("C50", "Np", "neper - Np")
      }
   },
   /**
    * Mechanics
    */
   Mechanics: {
      /**
       * mass
       */
      mass: {
         kilogram: makeEUInformation("KGM", "kg", "kilogram - A unit of mass equal to one thousand grams. kg"),
         microgram: makeEUInformation("MC", "µg", "microgram - 10⁻⁹ kg"),
         decagram: makeEUInformation("DJ", "dag", "decagram - 10⁻² kg"),
         decigram: makeEUInformation("DG", "dg", "decigram - 10⁻⁴ kg"),
         gram: makeEUInformation("GRM", "g", "gram - 10⁻³ kg"),
         centigram: makeEUInformation("CGM", "cg", "centigram - 10⁻⁵ kg"),
         "tonne_(metric_ton)": makeEUInformation("TNE", "t", "tonne (metric ton) - Synonym: metric ton 10³ kg"),
         decitonne: makeEUInformation(
            "DTN",
            "dt or dtn",
            "decitonne - Synonym: centner, metric 100 kg; quintal, metric 100 kg 10² kg"
         ),
         milligram: makeEUInformation("MGM", "mg", "milligram - 10⁻⁶ kg"),
         hectogram: makeEUInformation("HGM", "hg", "hectogram - 10⁻¹ kg"),
         kilotonne: makeEUInformation("KTN", "kt", "kilotonne - 10⁶ kg"),
         megagram: makeEUInformation("2U", "Mg", "megagram - 10³ kg"),
         pound: makeEUInformation("LBR", "lb", "pound - 0,453 592 37 kg"),
         grain: makeEUInformation("GRN", "gr", "grain - 64,798 91 x 10⁻⁶ kg"),
         "ounce_(avoirdupois)": makeEUInformation("ONZ", "oz", "ounce (avoirdupois) - 2,834 952 x 10⁻² kg"),
         "hundred_weight_(UK)": makeEUInformation("CWI", "cwt (UK)", "hundred weight (UK) - 50,802 35 kg"),
         "hundred_pound_(cwt)_/_hundred_weight_(US)": makeEUInformation(
            "CWA",
            "cwt (US)",
            "hundred pound (cwt) / hundred weight (US) - 45,359 2 kg"
         ),
         "ton_(UK)_or_long_ton_(US)": makeEUInformation(
            "LTN",
            "ton (UK)",
            "ton (UK) or long ton (US) - Synonym: gross ton (2240 lb) 1,016 047 x 10³ kg"
         ),
         "stone_(UK)": makeEUInformation("STI", "st", "stone (UK) - 6,350 293 kg"),
         "ton_(US)_or_short_ton_(UK/US)": makeEUInformation(
            "STN",
            "ton (US)",
            "ton (US) or short ton (UK/US) - Synonym: net ton (2000 lb) 0,907184 7 x 10³ kg"
         ),
         troy_ounce_or_apothecary_ounce: makeEUInformation(
            "APZ",
            "tr oz",
            "troy ounce or apothecary ounce - 3,110 348 x 10⁻³ kg"
         ),
         slug: makeEUInformation(
            "F13",
            "slug",
            "slug - A unit of mass. One slug is the mass accelerated at 1 foot per second per second by a force of 1 pound. 1,459 390 x 10¹ kg"
         ),
         "pound_(avoirdupois)_per_degree_Fahrenheit": makeEUInformation(
            "K64",
            "lb/°F",
            "pound (avoirdupois) per degree Fahrenheit - 0,816 466 3 kg/K"
         ),
         tonne_per_kelvin: makeEUInformation("L69", "t/K", "tonne per kelvin - 10³ kg/K"),
         ton_short_per_degree_Fahrenheit: makeEUInformation(
            "L87",
            "ton (US)/°F",
            "ton short per degree Fahrenheit - 1,632 932 x 10³ kg/K"
         ),
         "ton,_assay": makeEUInformation(
            "M85",
            "",
            "ton, assay - Non SI-conforming unit of the mass used in the mineralogy to determine the concentration of precious metals in ore according to the mass of the precious metal in milligrams in a sample of the mass of an assay sound (number of troy ounces in a short ton (1 000 lb)). 2,916 667 x 10⁻² kg"
         ),
         pfund: makeEUInformation("M86", "pfd", "pfund - Outdated unit of the mass used in Germany. 0,5 kg")
      },
      /**
       * density, mass density, volumic mass
       */
      "density, mass density, volumic mass": {
         kilogram_per_cubic_metre: makeEUInformation(
            "KMQ",
            "kg/m³",
            "kilogram per cubic metre - A unit of weight expressed in kilograms of a substance that fills a volume of one cubic metre. kg/m³"
         ),
         gram_per_cubic_centimetre: makeEUInformation("23", "g/cm³", "gram per cubic centimetre - 10³ kg/m³"),
         tonne_per_cubic_metre: makeEUInformation("D41", "t/m³", "tonne per cubic metre - 10³ kg/m³"),
         gram_per_millilitre: makeEUInformation("GJ", "g/ml", "gram per millilitre - 10³ kg/m³"),
         kilogram_per_litre: makeEUInformation("B35", "kg/l or kg/L", "kilogram per litre - 10³ kg/m³"),
         gram_per_litre: makeEUInformation("GL", "g/l", "gram per litre - kg/m³"),
         gram_per_cubic_metre: makeEUInformation("A93", "g/m³", "gram per cubic metre - 10⁻³ kg/m³"),
         milligram_per_cubic_metre: makeEUInformation("GP", "mg/m³", "milligram per cubic metre - 10⁻⁶ kg/m³"),
         megagram_per_cubic_metre: makeEUInformation("B72", "Mg/m³", "megagram per cubic metre - 10³ kg/m³"),
         kilogram_per_cubic_decimetre: makeEUInformation("B34", "kg/dm³", "kilogram per cubic decimetre - 10³ kg/m³"),
         milligram_per_gram: makeEUInformation("H64", "mg/g", "milligram per gram - 10⁻³ 1"),
         microgram_per_litre: makeEUInformation("H29", "µg/l", "microgram per litre - 10⁻⁶ m⁻³ x kg"),
         milligram_per_litre: makeEUInformation("M1", "mg/l", "milligram per litre - 10⁻³ kg/m³"),
         microgram_per_cubic_metre: makeEUInformation("GQ", "µg/m³", "microgram per cubic metre - 10⁻⁹ kg/m³"),
         gram_per_cubic_centimetre_bar: makeEUInformation("G11", "g/(cm³·bar)", "gram per cubic centimetre bar - 10⁻² m⁻² x s²"),
         gram_per_cubic_centimetre_kelvin: makeEUInformation(
            "G33",
            "g/(cm³·K)",
            "gram per cubic centimetre kelvin - 10³ kg x m⁻³ x K⁻¹"
         ),
         gram_per_cubic_decimetre: makeEUInformation("F23", "g/dm³", "gram per cubic decimetre - kg x m⁻³"),
         gram_per_cubic_decimetre_bar: makeEUInformation("G12", "g/(dm³·bar)", "gram per cubic decimetre bar - 10⁻⁵ m⁻² x s²"),
         gram_per_cubic_decimetre_kelvin: makeEUInformation(
            "G34",
            "g/(dm³·K)",
            "gram per cubic decimetre kelvin - kg x m⁻³ x K⁻¹"
         ),
         gram_per_cubic_metre_bar: makeEUInformation("G14", "g/(m³·bar)", "gram per cubic metre bar - 10⁻⁸ m⁻² x s²"),
         gram_per_cubic_metre_kelvin: makeEUInformation("G36", "g/(m³·K)", "gram per cubic metre kelvin - 10⁻³ kg x m⁻³ x K⁻¹"),
         gram_per_litre_bar: makeEUInformation("G13", "g/(l·bar)", "gram per litre bar - 10⁻⁵ m⁻² x s²"),
         gram_per_litre_kelvin: makeEUInformation("G35", "g/(l·K)", "gram per litre kelvin - kg x m⁻³ x K⁻¹"),
         gram_per_millilitre_bar: makeEUInformation("G15", "g/(ml·bar)", "gram per millilitre bar - 10⁻² m⁻² x s²"),
         gram_per_millilitre_kelvin: makeEUInformation("G37", "g/(ml·K)", "gram per millilitre kelvin - 10³ kg x m⁻³ x K⁻¹"),
         kilogram_per_cubic_centimetre: makeEUInformation("G31", "kg/cm³", "kilogram per cubic centimetre - 10⁶ kg x m⁻³"),
         kilogram_per_cubic_centimetre_bar: makeEUInformation(
            "G16",
            "kg/(cm³·bar)",
            "kilogram per cubic centimetre bar - 10¹ m⁻² x s²"
         ),
         kilogram_per_cubic_centimetre_kelvin: makeEUInformation(
            "G38",
            "kg/(cm³·K)",
            "kilogram per cubic centimetre kelvin - 10⁶ kg x m⁻³ x K⁻¹"
         ),
         kilogram_per_cubic_metre_bar: makeEUInformation("G18", "kg/(m³·bar)", "kilogram per cubic metre bar - 10⁻⁵ m⁻² x s²"),
         kilogram_per_cubic_metre_kelvin: makeEUInformation(
            "G40",
            "kg/(m³·K)",
            "kilogram per cubic metre kelvin - kg x m⁻³ x K⁻¹"
         ),
         kilogram_per_cubic_decimetre_kelvin: makeEUInformation(
            "H54",
            "(kg/dm³)/K",
            "kilogram per cubic decimetre kelvin - 10³ m⁻³ x kg x K⁻¹"
         ),
         kilogram_per_cubic_decimetre_bar: makeEUInformation(
            "H55",
            "(kg/dm³)/bar",
            "kilogram per cubic decimetre bar - 10⁻² m⁻² x s²"
         ),
         gram_per_kelvin: makeEUInformation("F14", "g/K", "gram per kelvin - 10⁻³ kg x K⁻¹"),
         kilogram_per_kelvin: makeEUInformation("F15", "kg/K", "kilogram per kelvin - kg x K⁻¹"),
         kilogram_per_kilomole: makeEUInformation("F24", "kg/kmol", "kilogram per kilomole - 10⁻³ kg x mol⁻¹"),
         kilogram_per_litre_bar: makeEUInformation("G17", "kg/(l·bar)", "kilogram per litre bar - 10⁻² m⁻² x s²"),
         kilogram_per_litre_kelvin: makeEUInformation("G39", "kg/(l·K)", "kilogram per litre kelvin - 10³ kg x m⁻³ x K⁻¹"),
         kilogram_per_bar: makeEUInformation("H53", "kg/bar", "kilogram per bar - 10⁻⁵ m x s²"),
         kilogram_square_centimetre: makeEUInformation("F18", "kg·cm²", "kilogram square centimetre - 10⁻⁴ kg m²"),
         kilogram_square_millimetre: makeEUInformation("F19", "kg·mm²", "kilogram square millimetre - 10⁻⁶ kg m²"),
         gram_per_bar: makeEUInformation("F74", "g/bar", "gram per bar - 10⁻⁸ m x s²"),
         milligram_per_bar: makeEUInformation("F75", "mg/bar", "milligram per bar - 10⁻¹¹ m x s²"),
         milligram_per_kelvin: makeEUInformation("F16", "mg/K", "milligram per kelvin - 10⁻⁶ kg x K⁻¹"),
         kilogram_per_cubic_metre_pascal: makeEUInformation(
            "M73",
            "(kg/m³)/Pa",
            "kilogram per cubic metre pascal - SI base unit kilogram divided by the product of the power of the SI base unit metre with exponent 3 and the derived SI unit pascal. m⁻² x s²"
         ),
         pound_per_cubic_foot: makeEUInformation("87", "lb/ft³", "pound per cubic foot - 1,601 846 x 10¹ kg/m³"),
         "pound_per_gallon_(US)": makeEUInformation("GE", "lb/gal (US)", "pound per gallon (US) - 1,198 264 x 10² kg/m³"),
         pound_per_cubic_inch: makeEUInformation("LA", "lb/in³", "pound per cubic inch - 2,767 990 x 10⁴ kg/m³"),
         "ounce_(avoirdupois)_per_cubic_yard": makeEUInformation(
            "G32",
            "oz/yd³",
            "ounce (avoirdupois) per cubic yard - 3,707 98 × 10⁻² kg x m⁻³"
         ),
         microgram_per_cubic_metre_kelvin: makeEUInformation(
            "J34",
            "(µg/m³)/K",
            "microgram per cubic metre kelvin - 10⁻⁹ (kg/m³)/K"
         ),
         microgram_per_cubic_metre_bar: makeEUInformation(
            "J35",
            "(µg/m³)/bar",
            "microgram per cubic metre bar - 10⁻¹⁴ (kg/m³)/Pa"
         ),
         "grain_per_gallon_(US)": makeEUInformation("K41", "gr/gal (US)", "grain per gallon (US) - 1,711 806 x 10⁻² kg/m³"),
         "pound_(avoirdupois)_per_cubic_foot_degree_Fahrenheit": makeEUInformation(
            "K69",
            "(lb/ft³)/°F",
            "pound (avoirdupois) per cubic foot degree Fahrenheit - 28,833 23 (kg/m³)/K"
         ),
         "pound_(avoirdupois)_per_cubic_foot_psi": makeEUInformation(
            "K70",
            "(lb/ft³)/psi",
            "pound (avoirdupois) per cubic foot psi - 2,323 282 x 10⁻³"
         ),
         "pound_(avoirdupois)_per_gallon_(UK)": makeEUInformation(
            "K71",
            "lb/gal (UK)",
            "pound (avoirdupois) per gallon (UK) - 99,776 37 kg/m³"
         ),
         "pound_(avoirdupois)_per_cubic_inch_degree_Fahrenheit": makeEUInformation(
            "K75",
            "(lb/in³)/°F",
            "pound (avoirdupois) per cubic inch degree Fahrenheit - 4,982 384 x 10⁴ (kg/m³)/K"
         ),
         "pound_(avoirdupois)_per_cubic_inch_psi": makeEUInformation(
            "K76",
            "(lb/in³)/psi",
            "pound (avoirdupois) per cubic inch psi - 4,014 632 (kg/m³)/Pa"
         ),
         pound_per_cubic_yard: makeEUInformation("K84", "lb/yd³", "pound per cubic yard - 0,593 276 4 kg/m³"),
         milligram_per_cubic_metre_kelvin: makeEUInformation(
            "L17",
            "(mg/m³)/K",
            "milligram per cubic metre kelvin - 10⁻⁶ (kg/m³)/K"
         ),
         milligram_per_cubic_metre_bar: makeEUInformation(
            "L18",
            "(mg/m³)/bar",
            "milligram per cubic metre bar - 10⁻¹¹ (kg/m³)/Pa"
         ),
         "ounce_(avoirdupois)_per_gallon_(UK)": makeEUInformation(
            "L37",
            "oz/gal (UK)",
            "ounce (avoirdupois) per gallon (UK) - 6,236 023 kg/m³"
         ),
         "ounce_(avoirdupois)_per_gallon_(US)": makeEUInformation(
            "L38",
            "oz/gal (US)",
            "ounce (avoirdupois) per gallon (US) - 7,489 152 kg/m³"
         ),
         "ounce_(avoirdupois)_per_cubic_inch": makeEUInformation(
            "L39",
            "oz/in³",
            "ounce (avoirdupois) per cubic inch - 1,729 994 x 10³ kg/m³"
         ),
         slug_per_cubic_foot: makeEUInformation("L65", "slug/ft³", "slug per cubic foot - 5,153 788 x 10² kg/m³"),
         tonne_per_cubic_metre_kelvin: makeEUInformation("L76", "(t/m³)/K", "tonne per cubic metre kelvin - 10³ (kg/m³)/K"),
         tonne_per_cubic_metre_bar: makeEUInformation("L77", "(t/m³)/bar", "tonne per cubic metre bar - 10⁻² (kg/m³)/Pa"),
         "ton_(UK_long)_per_cubic_yard": makeEUInformation(
            "L92",
            "ton.l/yd³ (UK)",
            "ton (UK long) per cubic yard - 1,328 939 x 10³ kg/m³"
         ),
         "ton_(US_short)_per_cubic_yard": makeEUInformation(
            "L93",
            "ton.s/yd³ (US)",
            "ton (US short) per cubic yard - 1,186 553 x 10³ kg/m³"
         ),
         "pound_(avoirdupois)_per_psi": makeEUInformation(
            "K77",
            "lb/psi",
            "pound (avoirdupois) per psi - 6,578 802 x 10⁻⁵ kg/Pa"
         ),
         tonne_per_bar: makeEUInformation("L70", "t/bar", "tonne per bar - 10⁻² kg/Pa"),
         ton_short_per_psi: makeEUInformation("L91", "ton (US)/psi", "ton short per psi - 0,131 576"),
         kilogram_per_pascal: makeEUInformation(
            "M74",
            "kg/Pa",
            "kilogram per pascal - SI base unit kilogram divided by the derived SI unit pascal. m x s²"
         )
      },
      /**
       * relative density, relative mass density
       */
      "relative density, relative mass density": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * specific volume, massic volume
       */
      "specific volume, massic volume": {
         cubic_metre_per_kilogram: makeEUInformation("A39", "m³/kg", "cubic metre per kilogram - m³/kg"),
         decilitre_per_gram: makeEUInformation("22", "dl/g", "decilitre per gram - 10⁻¹ x m³/kg"),
         millilitre_per_cubic_metre: makeEUInformation("H65", "ml/m³", "millilitre per cubic metre - 10⁻⁶ 1"),
         litre_per_kilogram: makeEUInformation("H83", "l/kg", "litre per kilogram - 10⁻³ m³ x kg⁻¹"),
         millilitre_per_kilogram: makeEUInformation("KX", "ml/kg", "millilitre per kilogram - 10⁻⁶ m³/kg"),
         square_centimetre_per_gram: makeEUInformation("H15", "cm²/g", "square centimetre per gram - 10⁻¹ kg⁻¹ x m²"),
         cubic_decimetre_per_kilogram: makeEUInformation(
            "N28",
            "dm³/kg",
            "cubic decimetre per kilogram - 0,001 fold of the power of the SI base unit meter by exponent 3 divided by the SI based unit kilogram. 10⁻³ m³ x kg⁻¹"
         ),
         cubic_foot_per_pound: makeEUInformation(
            "N29",
            "ft³/lb",
            "cubic foot per pound - Power of the unit foot according to the Anglo-American and Imperial system of units by exponent 3 divided by the unit avoirdupois pound according to the avoirdupois unit system. 6,242 796 x 10⁻² m³/kg"
         ),
         cubic_inch_per_pound: makeEUInformation(
            "N30",
            "in³/lb",
            "cubic inch per pound - Power of the unit inch according to the Anglo-American and Imperial system of units by exponent 3 divided by the avoirdupois pound according to the avoirdupois unit system . 3,612 728 x 10⁻⁵ m³/kg"
         )
      },
      /**
       * linear density, linear mass
       */
      "linear density, linear mass": {
         kilogram_per_metre: makeEUInformation("KL", "kg/m", "kilogram per metre - kg/m"),
         "gram_per_metre_(gram_per_100_centimetres)": makeEUInformation(
            "GF",
            "g/m",
            "gram per metre (gram per 100 centimetres) - 10⁻³ kg/m"
         ),
         gram_per_millimetre: makeEUInformation("H76", "g/mm", "gram per millimetre - 10¹ kg x m⁻¹"),
         kilogram_per_millimetre: makeEUInformation("KW", "kg/mm", "kilogram per millimetre - 10³ kg/m"),
         milligram_per_metre: makeEUInformation("C12", "mg/m", "milligram per metre - 10⁻⁶ kg/m"),
         kilogram_per_kilometre: makeEUInformation("M31", "kg/km", "kilogram per kilometre - 10⁻³ kg/m"),
         pound_per_foot: makeEUInformation("P2", "lb/ft", "pound per foot - 1,488 164 kg/m"),
         pound_per_inch_of_length: makeEUInformation("PO", "lb/in", "pound per inch of length - 1,785 797 x 10¹ kg/m"),
         denier_: makeEUInformation(
            "M83",
            "den",
            "denier  - Traditional unit for the indication of the linear mass of textile fibers and yarns. 1,111 111 x 10⁻⁷ kg/m"
         ),
         pound_per_yard_: makeEUInformation(
            "M84",
            "lb/yd",
            "pound per yard  - Unit for linear mass according to avoirdupois system of units. 4,960 546 x 10⁻¹ kg/m"
         )
      },
      /**
       * surface density, areic mass
       */
      "surface density, areic mass": {
         milligram_per_square_metre: makeEUInformation("GO", "mg/m²", "milligram per square metre - 10⁻⁶ kg/m²"),
         gram_per_square_centimetre: makeEUInformation("25", "g/cm²", "gram per square centimetre - 10 kg/m²"),
         milligram_per_square_centimetre: makeEUInformation("H63", "mg/cm²", "milligram per square centimetre - 10⁻² m⁻² x kg"),
         gram_per_square_metre: makeEUInformation("GM", "g/m²", "gram per square metre - 10⁻³ kg/m²"),
         kilogram_per_square_metre: makeEUInformation("28", "kg/m²", "kilogram per square metre - kg/m²"),
         kilogram_per_square_centimetre: makeEUInformation("D5", "kg/cm²", "kilogram per square centimetre - 10⁴ kg/m²"),
         ounce_per_square_yard: makeEUInformation("ON", "oz/yd²", "ounce per square yard - 3,390 575 x 10⁻² kg/m²"),
         ounce_per_square_foot: makeEUInformation("37", "oz/ft²", "ounce per square foot - 0,305 151 7 kg/m²")
      },
      /**
       * momentum
       */
      momentum: {
         kilogram_metre_per_second: makeEUInformation("B31", "kg·m/s", "kilogram metre per second - kg x m/s"),
         kilogram_centimetre_per_second: makeEUInformation(
            "M98",
            "kg·(cm/s)",
            "kilogram centimetre per second - Product of the SI base unit kilogram and the 0,01-fold of the SI base unit metre divided by the SI base unit second. 10⁻² kg x m/s"
         ),
         gram_centimetre_per_second: makeEUInformation(
            "M99",
            "g·(cm/s)",
            "gram centimetre per second - Product of the 0,001-fold of the SI base unit kilogram and the 0,01-fold of the SI base unit metre divided by the SI base unit second. 10⁻⁵ kg x m/s"
         ),
         pound_foot_per_second: makeEUInformation(
            "N10",
            "lb·(ft/s)",
            "pound foot per second - Product of the avoirdupois pound according to the avoirdupois unit system and the unit foot according to the Anglo-American and Imperial system of units divided by the SI base unit second. 1,382 550 x 10⁻¹ kg x m/s"
         ),
         pound_inch_per_second: makeEUInformation(
            "N11",
            "lb·(in/s)",
            "pound inch per second - Product of the avoirdupois pound according to the avoirdupois unit system and the unit inch according to the Anglo-American and Imperial system of units divided by the SI base unit second. 1,152 125 x 10⁻² kg x m/s"
         )
      },
      /**
       * moment of momentum, angular momentum
       */
      "moment of momentum, angular momentum": {
         kilogram_metre_squared_per_second: makeEUInformation("B33", "kg·m²/s", "kilogram metre squared per second - kg x m²/s")
      },
      /**
       * moment of inertia (dynamic moment of inertia)
       */
      "moment of inertia (dynamic moment of inertia)": {
         kilogram_metre_squared: makeEUInformation("B32", "kg·m²", "kilogram metre squared - kg x m²"),
         pound_inch_squared: makeEUInformation("F20", "lb·in²", "pound inch squared - 2,926 397 x 10⁻⁴ kg x m²"),
         "pound_(avoirdupois)_square_foot": makeEUInformation(
            "K65",
            "lb·ft²",
            "pound (avoirdupois) square foot - 4,214 011 x 10⁻² kg x m²"
         )
      },
      /**
       * force, weight
       */
      "force, weight": {
         newton: makeEUInformation("NEW", "N", "newton - (kg x m)/s²"),
         meganewton: makeEUInformation("B73", "MN", "meganewton - 10⁶ N"),
         kilonewton: makeEUInformation("B47", "kN", "kilonewton - 10³ N"),
         millinewton: makeEUInformation("C20", "mN", "millinewton - 10⁻³ N"),
         micronewton: makeEUInformation("B92", "µN", "micronewton - 10⁻⁶ N"),
         dyne: makeEUInformation("DU", "dyn", "dyne - 10⁻⁵ N"),
         "pound-force": makeEUInformation("C78", "lbf", "pound-force - 4,448 222 N"),
         "kilogram-force": makeEUInformation("B37", "kgf", "kilogram-force - 9,806 65 N"),
         kilopond: makeEUInformation("B51", "kp", "kilopond - Synonym: kilogram-force 9,806 65 N"),
         "ounce_(avoirdupois)-force": makeEUInformation("L40", "ozf", "ounce (avoirdupois)-force - 0,278 013 9 N"),
         "ton-force_(US_short)": makeEUInformation("L94", "ton.sh-force", "ton-force (US short) - 8,896 443 x 10³ N"),
         "kilopound-force": makeEUInformation(
            "M75",
            "kip",
            "kilopound-force - 1000-fold of the unit of the force pound-force (lbf) according to the Anglo-American system of units with the relationship. 4,448 222 x 10³ N"
         ),
         poundal: makeEUInformation(
            "M76",
            "pdl",
            "poundal - Non SI-conforming unit of the power, which corresponds to a mass of a pound multiplied with the acceleration of a foot per square second. 1,382 550 x 10⁻¹ N"
         ),
         kilogram_metre_per_second_squared: makeEUInformation(
            "M77",
            "kg·m/s²",
            "kilogram metre per second squared - Product of the SI base unit kilogram and the SI base unit metre divided by the power of the SI base unit second by exponent 2. (kg x m)/s²"
         ),
         pond: makeEUInformation(
            "M78",
            "p",
            "pond - 0,001-fold of the unit of the weight, defined as a mass of 1 kg which finds out about a weight strength from 1 kp by the gravitational force at sea level which corresponds to a strength of 9,806 65 newton. 9,806 65 x 10⁻³ N"
         )
      },
      /**
       * force divided by length
       */
      "force divided by length": {
         "pound-force_per_foot": makeEUInformation("F17", "lbf/ft", "pound-force per foot - 1,459 39 × 10¹ kg x s⁻²"),
         "pound-force_per_inch": makeEUInformation("F48", "lbf/in", "pound-force per inch - 1,751 27 × 10² kg x s⁻²")
      },
      /**
       * gravitational constant
       */
      "gravitational constant": {
         newton_metre_squared_per_kilogram_squared: makeEUInformation(
            "C54",
            "N·m²/kg²",
            "newton metre squared per kilogram squared - N x m²/kg²"
         )
      },
      /**
       * moment of force, moment of a couple, torque
       */
      "moment of force, moment of a couple, torque": {
         newton_metre: makeEUInformation("NU", "N·m", "newton metre - N x m"),
         newton_per_ampere: makeEUInformation("H40", "N/A", "newton per ampere - kg x m x s⁻² x A⁻¹"),
         meganewton_metre: makeEUInformation("B74", "MN·m", "meganewton metre - 10⁶ N x m"),
         kilonewton_metre: makeEUInformation("B48", "kN·m", "kilonewton metre - 10³ N x m"),
         millinewton_metre: makeEUInformation("D83", "mN·m", "millinewton metre - 10⁻³ N x m"),
         micronewton_metre: makeEUInformation("B93", "µN·m", "micronewton metre - 10⁻⁶ N x m"),
         decinewton_metre: makeEUInformation("DN", "dN·m", "decinewton metre - 10⁻¹ N x m"),
         centinewton_metre: makeEUInformation("J72", "cN·m", "centinewton metre - 10⁻² N x m"),
         kilogram_metre: makeEUInformation(
            "M94",
            "kg·m",
            "kilogram metre - Unit of imbalance as a product of the SI base unit kilogram and the SI base unit metre. kg x m"
         ),
         newton_centimetre: makeEUInformation("F88", "N·cm", "newton centimetre - 10⁻² kg x m² x s⁻²"),
         newton_metre_per_ampere: makeEUInformation("F90", "N·m/A", "newton metre per ampere - kg x m² x s⁻² x A⁻¹"),
         newton_metre_per_degree: makeEUInformation("F89", "Nm/°", "newton metre per degree - 57,295 788 kg x m² x s⁻² x rad⁻¹"),
         newton_metre_per_kilogram: makeEUInformation("G19", "N·m/kg", "newton metre per kilogram - m² x s⁻²"),
         newton_per_millimetre: makeEUInformation("F47", "N/mm", "newton per millimetre - 10³ kg x s⁻²"),
         newton_metre_per_radian: makeEUInformation(
            "M93",
            "N·m/rad",
            "newton metre per radian - Product of the derived SI unit newton and the SI base unit metre divided by the unit radian. m² x kg x s⁻² x rad⁻¹"
         ),
         "newton_metre_watt_to_the_power_minus_0,5": makeEUInformation(
            "H41",
            "N·m·W⁻⁰‧⁵",
            "newton metre watt to the power minus 0,5 - kg x m² x s⁻² x W⁻⁰‧⁵"
         ),
         "kilogram-force_metre": makeEUInformation("B38", "kgf·m", "kilogram-force metre - 9,806 65 N x m"),
         "inch_pound_(pound_inch)": makeEUInformation("IA", "in·lb", "inch pound (pound inch) - 1,152 12 x 10⁻² kg x m"),
         ounce_inch: makeEUInformation("4Q", "oz·in", "ounce inch - 7,200 778 x 10⁻⁴ kg x m"),
         ounce_foot: makeEUInformation("4R", "oz·ft", "ounce foot - 8,640 934 x 10⁻³ kg x m"),
         "pound-force_foot_per_ampere": makeEUInformation(
            "F22",
            "lbf·ft/A",
            "pound-force foot per ampere - 1,355 82 kg x m² x s⁻² x A⁻¹"
         ),
         "pound-force_inch": makeEUInformation("F21", "lbf·in", "pound-force inch - 1,129 85 × 10⁻¹ kg x m² x s⁻²"),
         "pound-force_foot_per_pound": makeEUInformation("G20", "lbf·ft/lb", "pound-force foot per pound - 2,989 07 m² x s⁻²"),
         dyne_centimetre: makeEUInformation("J94", "dyn·cm", "dyne centimetre - 10⁻⁷ N x m"),
         "ounce_(avoirdupois)-force_inch": makeEUInformation(
            "L41",
            "ozf·in",
            "ounce (avoirdupois)-force inch - 7,061 552 x 10⁻³ N x m"
         ),
         "pound-force_foot": makeEUInformation(
            "M92",
            "lbf·ft",
            "pound-force foot - Product of the unit pound-force according to the Anglo-American system of units and the unit foot according to the Anglo-American and the Imperial system of units. 1,355 818 N x m"
         ),
         poundal_foot: makeEUInformation(
            "M95",
            "pdl·ft",
            "poundal foot - Product of the non SI-conforming unit of the force poundal and the unit foot according to the Anglo-American and Imperial system of units . 4,214 011 x 10⁻² N x m"
         ),
         poundal_inch: makeEUInformation(
            "M96",
            "pdl·in",
            "poundal inch - Product of the non SI-conforming unit of the force poundal and the unit inch according to the Anglo-American and Imperial system of units . 3,511 677 10⁻³ N x m"
         ),
         dyne_metre: makeEUInformation(
            "M97",
            "dyn·m",
            "dyne metre - CGS (Centimetre-Gram-Second system) unit of the rotational moment. 10⁻⁵ N x m"
         )
      },
      /**
       * impulse
       */
      impulse: {
         newton_second: makeEUInformation("C57", "N·s", "newton second - N x s")
      },
      /**
       * angular impulse
       */
      "angular impulse": {
         newton_metre_second: makeEUInformation("C53", "N·m·s", "newton metre second - N x m x s")
      },
      /**
       * pressure, normal stress, shear stress, modulus of elasticity,shear modulus, modulus of rigidity, bulk modulus, modulus of compression
       */
      "pressure, normal stress, shear stress, modulus of elasticity,shear modulus, modulus of rigidity, bulk modulus, modulus of compression":
      {
         millipascal: makeEUInformation("74", "mPa", "millipascal - 10⁻³ Pa"),
         megapascal: makeEUInformation("MPA", "MPa", "megapascal - 10⁶ Pa"),
         pascal: makeEUInformation("PAL", "Pa", "pascal - Pa"),
         kilopascal: makeEUInformation("KPA", "kPa", "kilopascal - 10³ Pa"),
         "bar_[unit_of_pressure]": makeEUInformation("BAR", "bar", "bar [unit of pressure] - 10⁵ Pa"),
         hectobar: makeEUInformation("HBA", "hbar", "hectobar - 10⁷ Pa"),
         millibar: makeEUInformation("MBR", "mbar", "millibar - 10² Pa"),
         kilobar: makeEUInformation("KBA", "kbar", "kilobar - 10⁸ Pa"),
         standard_atmosphere: makeEUInformation("ATM", "atm", "standard atmosphere - 1 013 25 Pa"),
         gigapascal: makeEUInformation("A89", "GPa", "gigapascal - 10⁹ Pa"),
         micropascal: makeEUInformation("B96", "µPa", "micropascal - 10⁻⁶ Pa"),
         hectopascal: makeEUInformation("A97", "hPa", "hectopascal - 10² Pa"),
         decapascal: makeEUInformation("H75", "daPa", "decapascal - 10¹ Pa"),
         microbar: makeEUInformation("B85", "µbar", "microbar - 10⁻¹ Pa"),
         newton_per_square_metre: makeEUInformation("C55", "N/m²", "newton per square metre - Pa"),
         newton_per_square_millimetre: makeEUInformation("C56", "N/mm²", "newton per square millimetre - 10⁶ Pa"),
         pascal_second_per_bar: makeEUInformation("H07", "Pa·s/bar", "pascal second per bar - 10⁻⁵ s"),
         hectopascal_cubic_metre_per_second: makeEUInformation(
            "F94",
            "hPa·m³/s",
            "hectopascal cubic metre per second - 10² kg x m² x s⁻³"
         ),
         hectopascal_litre_per_second: makeEUInformation(
            "F93",
            "hPa·l/s",
            "hectopascal litre per second - 10⁻¹ kg x m² x s⁻³"
         ),
         hectopascal_per_kelvin: makeEUInformation("F82", "hPa/K", "hectopascal per kelvin - 10² kg x m⁻¹ x s⁻² x K⁻¹"),
         kilopascal_per_kelvin: makeEUInformation("F83", "kPa/K", "kilopascal per kelvin - 10³ kg x m⁻¹ x s⁻² x K⁻¹"),
         megapascal_cubic_metre_per_second: makeEUInformation(
            "F98",
            "MPa·m³/s",
            "megapascal cubic metre per second - 10⁶ kg x m² x s⁻³"
         ),
         megapascal_litre_per_second: makeEUInformation("F97", "MPa·l/s", "megapascal litre per second - 10³ kg x m² x s⁻³"),
         megapascal_per_kelvin: makeEUInformation("F85", "MPa/K", "megapascal per kelvin - 10⁶ kg x m⁻¹ x s⁻² x K⁻¹"),
         millibar_cubic_metre_per_second: makeEUInformation(
            "F96",
            "mbar·m³/s",
            "millibar cubic metre per second - 10² kg x m² x s⁻³"
         ),
         millibar_litre_per_second: makeEUInformation("F95", "mbar·l/s", "millibar litre per second - 10⁻¹ kg x m² x s⁻³"),
         millibar_per_kelvin: makeEUInformation("F84", "mbar/K", "millibar per kelvin - 10² kg x m⁻¹ x s⁻² x K⁻¹"),
         pascal_cubic_metre_per_second: makeEUInformation("G01", "Pa·m³/s", "pascal cubic metre per second - kg x m² x s⁻³"),
         pascal_litre_per_second: makeEUInformation("F99", "Pa·l/s", "pascal litre per second - 10⁻³ kg x m² x s⁻³"),
         pascal_second_per_kelvin: makeEUInformation("F77", "Pa.s/K", "pascal second per kelvin - kg x m⁻¹ x s⁻¹ x K⁻¹"),
         newton_per_square_centimetre: makeEUInformation(
            "E01",
            "N/cm²",
            "newton per square centimetre - A measure of pressure expressed in newtons per square centimetre. 10⁴ Pa"
         ),
         pound_per_square_foot: makeEUInformation("FP", "lb/ft²", "pound per square foot - 4,882 428 kg/m²"),
         "pound-force_per_square_inch": makeEUInformation(
            "PS",
            "lbf/in²",
            "pound-force per square inch - 6,894 757 x 10³ Pa"
         ),
         "kilogram-force_per_square_metre": makeEUInformation(
            "B40",
            "kgf/m²",
            "kilogram-force per square metre - 9,806 65 Pa"
         ),
         torr: makeEUInformation("UA", "Torr", "torr - 133,322 4 Pa"),
         technical_atmosphere: makeEUInformation("ATT", "at", "technical atmosphere - 98 066,5 Pa"),
         pound_per_square_inch_absolute: makeEUInformation(
            "80",
            "lb/in²",
            "pound per square inch absolute - 7,030 696 x 10² kg/m²"
         ),
         conventional_centimetre_of_water: makeEUInformation(
            "H78",
            "cm H₂O",
            "conventional centimetre of water - 9,806 65 × 10¹ Pa"
         ),
         conventional_millimetre_of_water: makeEUInformation(
            "HP",
            "mm H₂O",
            "conventional millimetre of water - 9,806 65 Pa"
         ),
         conventional_millimetre_of_mercury: makeEUInformation(
            "HN",
            "mm Hg",
            "conventional millimetre of mercury - 133,322 4 Pa"
         ),
         inch_of_mercury: makeEUInformation("F79", "inHg", "inch of mercury - 3,386 39 × 10³ kg x m⁻¹ x s⁻²"),
         inch_of_water: makeEUInformation("F78", "inH₂O", "inch of water - 2,490 89 × 10² kg x m⁻¹ x s⁻²"),
         centimetre_of_mercury: makeEUInformation("J89", "cm Hg", "centimetre of mercury - 1,333 224 x 10³ Pa"),
         foot_of_water: makeEUInformation("K24", "ft H₂O", "foot of water - 2,989 067 x 10³  Pa"),
         foot_of_mercury: makeEUInformation("K25", "ft Hg", "foot of mercury - 4,063 666 x 10⁴ Pa"),
         "gram-force_per_square_centimetre": makeEUInformation(
            "K31",
            "gf/cm²",
            "gram-force per square centimetre - 98,066 5 Pa"
         ),
         "kilogram-force_per_square_centimetre": makeEUInformation(
            "E42",
            "kgf/cm²",
            "kilogram-force per square centimetre - 9,806 65 x 10⁴ Pa"
         ),
         "kilogram-force_per_square_millimetre": makeEUInformation(
            "E41",
            "kgf·m/cm²",
            "kilogram-force per square millimetre - 9,806 65 x 10⁻⁶ Pa"
         ),
         "pound-force_per_square_foot": makeEUInformation("K85", "lbf/ft²", "pound-force per square foot - 47,880 26 Pa"),
         "pound-force_per_square_inch_degree_Fahrenheit": makeEUInformation(
            "K86",
            "psi/°F",
            "pound-force per square inch degree Fahrenheit - 1,241 056 x 10⁴ Pa/K"
         ),
         "A_unit_of_pressure_defining_the_number_of_kilopounds_force_per_square_inch.  Use_kip_per_square_inch_(common_code_N20).":
            makeEUInformation(
               "84",
               "klbf/in²",
               "A unit of pressure defining the number of kilopounds force per square inch.  Use kip per square inch (common code N20). - A unit of pressure defining the number of kilopounds force per square inch. 6,894 757 x 10⁶ Pa"
            ),
         "centimetre_of_mercury_(0_ºC)": makeEUInformation(
            "N13",
            "cmHg (0 ºC)",
            "centimetre of mercury (0 ºC) - Non SI-conforming unit of pressure, at which a value of 1 cmHg meets the static pressure, which is generated by a mercury at a temperature of 0 °C with a height of 1 centimetre . 1,333 22 x 10³ Pa"
         ),
         "centimetre_of_water_(4_ºC)": makeEUInformation(
            "N14",
            "cmH₂O (4 °C)",
            "centimetre of water (4 ºC) - Non SI-conforming unit of pressure, at which a value of 1 cmH2O meets the static pressure, which is generated by a head of water at a temperature of 4 °C with a height of 1 centimetre . 9,806 38 x 10 Pa"
         ),
         "foot_of_water_(39.2_ºF)": makeEUInformation(
            "N15",
            "ftH₂O (39,2 ºF)",
            "foot of water (39.2 ºF) - Non SI-conforming unit of pressure according to the Anglo-American and Imperial system for units, whereas the value of 1 ftH2O is equivalent to the static pressure, which is generated by a head of water at a temperature 39,2°F with a height of 1 foot . 2,988 98 x 10³  Pa"
         ),
         "inch_of_mercury_(32_ºF)": makeEUInformation(
            "N16",
            "inHG (32 ºF)",
            "inch of mercury (32 ºF) - Non SI-conforming unit of pressure according to the Anglo-American and Imperial system for units, whereas the value of 1 inHg meets the static pressure, which is generated by a mercury at a temperature of 32°F with a height of 1 inch. 3,386 38 x 10³  Pa"
         ),
         "inch_of_mercury_(60_ºF)": makeEUInformation(
            "N17",
            "inHg (60 ºF)",
            "inch of mercury (60 ºF) - Non SI-conforming unit of pressure according to the Anglo-American and Imperial system for units, whereas the value of 1 inHg meets the static pressure, which is generated by a mercury at a temperature of 60°F with a height of 1 inch. 3,376 85 x 10³  Pa"
         ),
         "inch_of_water_(39.2_ºF)": makeEUInformation(
            "N18",
            "inH₂O (39,2 ºF)",
            "inch of water (39.2 ºF) - Non SI-conforming unit of pressure according to the Anglo-American and Imperial system for units, whereas the value of 1 inH2O meets the static pressure, which is generated by a head of water at a temperature of 39,2°F with a height of 1 inch . 2,490 82 × 10² Pa"
         ),
         "inch_of_water_(60_ºF)": makeEUInformation(
            "N19",
            "inH₂O (60 ºF)",
            "inch of water (60 ºF) - Non SI-conforming unit of pressure according to the Anglo-American and Imperial system for units, whereas the value of 1 inH2O meets the static pressure, which is generated by a head of water at a temperature of 60°F with a height of 1 inch . 2,488 4 × 10² Pa"
         ),
         kip_per_square_inch: makeEUInformation(
            "N20",
            "ksi",
            "kip per square inch - Non SI-conforming unit of the pressure according to the Anglo-American system of units as the 1000-fold of the unit of the force pound-force divided by the power of the unit inch by exponent 2. 6,894 757 x 10⁶ Pa"
         ),
         poundal_per_square_foot_: makeEUInformation(
            "N21",
            "pdl/ft²",
            "poundal per square foot  - Non SI-conforming unit of pressure by the Imperial system of units according to NIST: 1 pdl/ft² = 1,488 164 Pa. 1,488 164 Pa"
         ),
         "ounce_(avoirdupois)_per_square_inch_": makeEUInformation(
            "N22",
            "oz/in²",
            "ounce (avoirdupois) per square inch  - Unit of the surface specific mass (avoirdupois ounce according to the avoirdupois system of units according to the surface square inch according to the Anglo-American and Imperial system of units). 4,394 185 x 10 kg/m²"
         ),
         conventional_metre_of_water: makeEUInformation(
            "N23",
            "mH₂O",
            "conventional metre of water - Not SI-conforming unit of pressure, whereas a value of 1 mH2O is equivalent to the static pressure, which is produced by one metre high water column . 9,806 65 x 10³ Pa"
         ),
         gram_per_square_millimetre: makeEUInformation(
            "N24",
            "g/mm²",
            "gram per square millimetre - 0,001-fold of the SI base unit kilogram divided by the 0.000 001-fold of the power of the SI base unit meter by exponent 2. 10³ kg/m²"
         ),
         pound_per_square_yard: makeEUInformation(
            "N25",
            "lb/yd²",
            "pound per square yard - Unit for areal-related mass as a unit pound according to the avoirdupois unit system divided by the power of the unit yard according to the Anglo-American and Imperial system of units with exponent 2. 5,424 919 x 10⁻¹ kg/m²"
         ),
         poundal_per_square_inch: makeEUInformation(
            "N26",
            "pdl/in²",
            "poundal per square inch - Non SI-conforming unit of the pressure according to the Imperial system of units (poundal by square inch). 2,142 957 × 10² Pa"
         ),
         kilonewton_per_square_metre: makeEUInformation("KNM", "KN/m2", "kilonewton per square metre - 103pascal")
      },
      /**
       * pressure ratio
       */
      "pressure ratio": {
         hectopascal_per_bar: makeEUInformation("E99", "hPa/bar", "hectopascal per bar - 10⁻³"),
         megapascal_per_bar: makeEUInformation("F05", "MPa/bar", "megapascal per bar - 10¹"),
         millibar_per_bar: makeEUInformation("F04", "mbar/bar", "millibar per bar - 10⁻³"),
         pascal_per_bar: makeEUInformation("F07", "Pa/bar", "pascal per bar - 10⁻⁵"),
         kilopascal_per_bar: makeEUInformation("F03", "kPa/bar", "kilopascal per bar - 10⁻²"),
         psi_per_psi: makeEUInformation("L52", "psi/psi", "psi per psi - 1"),
         bar_per_bar: makeEUInformation("J56", "bar/bar", "bar per bar - 1")
      },
      /**
       * linear strain, relative elongation, shear strain, volume or bulk strain
       */
      "linear strain, relative elongation, shear strain, volume or bulk strain": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * poisson ratio, poisson number
       */
      "poisson ratio, poisson number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * compressibility, bulk compressibility
       */
      "compressibility, bulk compressibility": {
         reciprocal_pascal_or_pascal_to_the_power_minus_one: makeEUInformation(
            "C96",
            "Pa⁻¹",
            "reciprocal pascal or pascal to the power minus one - Pa⁻¹"
         ),
         reciprocal_bar: makeEUInformation("F58", "1/bar", "reciprocal bar - bar⁻¹")
      },
      /**
       * second moment of area, second axial moment of area
       */
      "second moment of area, second axial moment of area": {
         metre_to_the_fourth_power: makeEUInformation("B83", "m⁴", "metre to the fourth power - m⁴"),
         millimetre_to_the_fourth_power: makeEUInformation("G77", "mm⁴", "millimetre to the fourth power - 10⁻¹² m⁴")
      },
      /**
       * second polar moment of area
       */
      "second polar moment of area": {
         inch_to_the_fourth_power: makeEUInformation("D69", "in⁴", "inch to the fourth power - 41,623 14 x 10⁻⁸ m⁴"),
         foot_to_the_fourth_power_: makeEUInformation(
            "N27",
            "ft⁴",
            "foot to the fourth power  - Power of the unit foot according to the Anglo-American and Imperial system of units by exponent 4 according to NIST: 1 ft4 = 8,630 975 m4. 8,630 975 x 10⁻³ m⁴"
         )
      },
      /**
       * section modulus
       */
      "section modulus": {
         cubic_metre: makeEUInformation("MTQ", "m³", "cubic metre - Synonym: metre cubed m³"),
         cubic_inch: makeEUInformation("INQ", "in³", "cubic inch - Synonym: inch cubed 16,387 064 x 10⁻⁶ m³")
      },
      /**
       * friction factor, coefficient of friction
       */
      "friction factor, coefficient of friction": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * viscosity (dynamic viscosity)
       */
      "viscosity (dynamic viscosity)": {
         pascal_second: makeEUInformation("C65", "Pa·s", "pascal second - Pa x s"),
         kilogram_per_metre_second: makeEUInformation(
            "N37",
            "kg/(m·s)",
            "kilogram per metre second - Unit of the dynamic viscosity as a quotient SI base unit kilogram divided by the SI base unit metre and by the SI base unit second. Pa x s"
         ),
         kilogram_per_metre_minute: makeEUInformation(
            "N38",
            "kg/(m·min)",
            "kilogram per metre minute - Unit of the dynamic viscosity as a quotient SI base unit kilogram divided by the SI base unit metre and by the unit minute. 1,666 67 × 10⁻² Pa x s"
         ),
         millipascal_second: makeEUInformation("C24", "mPa·s", "millipascal second - 10⁻³ Pa x s"),
         newton_second_per_square_metre: makeEUInformation(
            "N36",
            "(N/m²)·s",
            "newton second per square metre - Unit of the dynamic viscosity as a product of unit of the pressure (newton by square metre) multiplied with the SI base unit second. Pa x s"
         ),
         kilogram_per_metre_day: makeEUInformation(
            "N39",
            "kg/(m·d)",
            "kilogram per metre day - Unit of the dynamic viscosity as a quotient SI base unit kilogram divided by the SI base unit metre and by the unit day. 1,157 41 × 10⁻⁵ Pa x s"
         ),
         kilogram_per_metre_hour: makeEUInformation(
            "N40",
            "kg/(m·h)",
            "kilogram per metre hour - Unit of the dynamic viscosity as a quotient SI base unit kilogram divided by the SI base unit metre and by the unit hour. 2,777 78 × 10⁻⁴ Pa x s"
         ),
         gram_per_centimetre_second: makeEUInformation(
            "N41",
            "g/(cm·s)",
            "gram per centimetre second - Unit of the dynamic viscosity as a quotient of the 0,001-fold of the SI base unit kilogram divided by the 0,01-fold of the SI base unit metre and SI base unit second. 0,1 Pa x s"
         ),
         poise: makeEUInformation("89", "P", "poise - 0,1 Pa x s"),
         centipoise: makeEUInformation("C7", "cP", "centipoise - 10⁻³ Pa x s"),
         poise_per_bar: makeEUInformation("F06", "P/bar", "poise per bar - 10⁻⁶ s"),
         poise_per_kelvin: makeEUInformation("F86", "P/K", "poise per kelvin - 10⁻¹ kg x m⁻¹ x s⁻¹ x K⁻¹"),
         micropoise: makeEUInformation("J32", "µP", "micropoise - 10⁻⁶ Pa x s"),
         centipoise_per_kelvin: makeEUInformation("J73", "cP/K", "centipoise per kelvin - 10⁻³  Pa x s/K"),
         centipoise_per_bar: makeEUInformation("J74", "cP/bar", "centipoise per bar - 10⁻⁸ s"),
         pound_per_foot_hour: makeEUInformation("K67", "lb/(ft·h)", "pound per foot hour - 4,133 789 x 10⁻⁴ Pa x s"),
         pound_per_foot_second: makeEUInformation("K68", "lb/(ft·s)", "pound per foot second - 1,488 164 Pa x s"),
         "pound-force_second_per_square_foot": makeEUInformation(
            "K91",
            "lbf·s/ft²",
            "pound-force second per square foot - 47,880 26 Pa x s"
         ),
         "pound-force_second_per_square_inch": makeEUInformation(
            "K92",
            "lbf·s/in²",
            "pound-force second per square inch - 6,894 757  x 10³ Pa x s"
         ),
         millipascal_second_per_kelvin: makeEUInformation("L15", "mPa·s/K", "millipascal second per kelvin - 10⁻³ Pa x s/K"),
         millipascal_second_per_bar: makeEUInformation("L16", "mPa·s/bar", "millipascal second per bar - 10⁻⁸ s"),
         slug_per_foot_second: makeEUInformation("L64", "slug/(ft·s)", "slug per foot second - 47,880 26 Pa x s"),
         poundal_second_per_square_foot_: makeEUInformation(
            "N34",
            "(pdl/ft²)·s",
            "poundal second per square foot  - Non SI-conforming unit of viscosity. 1,488 164 Pa x s"
         ),
         poise_per_pascal: makeEUInformation(
            "N35",
            "P/Pa",
            "poise per pascal - CGS (Centimetre-Gram-Second system) unit poise divided by the derived SI unit pascal. 0,1 s"
         ),
         poundal_second_per_square_inch: makeEUInformation(
            "N42",
            "(pdl/in²)·s",
            "poundal second per square inch - Non SI-conforming unit of dynamic viscosity according to the Imperial system of units as product unit of the pressure (poundal by square inch) multiplied by the SI base unit second. 2,142 957 x 10² Pa x s"
         ),
         pound_per_foot_minute: makeEUInformation(
            "N43",
            "lb/(ft·min)",
            "pound per foot minute - Unit of the dynamic viscosity according to the Anglo-American unit system. 2,480 273 x 10⁻²  Pa x s"
         ),
         pound_per_foot_day: makeEUInformation(
            "N44",
            "lb/(ft·d)",
            "pound per foot day - Unit of the dynamic viscosity according to the Anglo-American unit system. 1,722 412 x 10⁻⁵ Pa x s"
         )
      },
      /**
       * kinematic viscosity
       */
      "kinematic viscosity": {
         square_metre_per_second: makeEUInformation(
            "S4",
            "m²/s",
            "square metre per second - Synonym: metre squared per second (square metres/second US) m²/s"
         ),
         square_metre_per_second_pascal: makeEUInformation(
            "M82",
            "(m²/s)/Pa",
            "square metre per second pascal - Power of the SI base unit metre with the exponent 2 divided by the SI base unit second and the derived SI unit pascal. kg⁻¹ x m³ x s"
         ),
         millimetre_squared_per_second: makeEUInformation("C17", "mm²/s", "millimetre squared per second - 10⁻⁶ m²/s"),
         square_metre_per_second_bar: makeEUInformation("G41", "m²/(s·bar)", "square metre per second bar - 10⁻⁵ kg⁻¹ x m³ x s"),
         square_metre_per_second_kelvin: makeEUInformation("G09", "m²/(s·K)", "square metre per second kelvin - m² x s⁻¹ x K⁻¹"),
         stokes: makeEUInformation("91", "St", "stokes - 10⁻⁴ m²/s"),
         centistokes: makeEUInformation("4C", "cSt", "centistokes - 10⁻⁶ m²/s"),
         stokes_per_bar: makeEUInformation("G46", "St/bar", "stokes per bar - 10⁻⁹ kg⁻¹ x m³ x s"),
         stokes_per_kelvin: makeEUInformation("G10", "St/K", "stokes per kelvin - 10⁻⁴ m² x s⁻¹ x K⁻¹"),
         square_foot_per_second: makeEUInformation(
            "S3",
            "ft²/s",
            "square foot per second - Synonym: foot squared per second 0,092 903 04 m²/s"
         ),
         square_inch_per_second: makeEUInformation("G08", "in²/s", "square inch per second - 6,451 6 × 10⁻⁴ m² x s⁻¹"),
         square_foot_per_hour_: makeEUInformation(
            "M79",
            "ft²/h",
            "square foot per hour  - Power of the unit foot according to the Anglo-American and Imperial system of units by exponent 2 divided by the unit of time hour. 2,580 64 x 10⁻⁵ m²/s"
         ),
         stokes_per_pascal: makeEUInformation(
            "M80",
            "St/Pa",
            "stokes per pascal - CGS (Centimetre-Gram-Second system) unit stokes divided by the derived SI unit pascal. 10⁻⁴ kg⁻¹ x m³ x s"
         ),
         square_centimetre_per_second: makeEUInformation(
            "M81",
            "cm²/s",
            "square centimetre per second - 0,000 1-fold of the power of the SI base unit metre by exponent 2 divided by the SI base unit second. 10⁻⁴ m²/s"
         )
      },
      /**
       * surface tension
       */
      "surface tension": {
         newton_per_metre: makeEUInformation("4P", "N/m", "newton per metre - N/m"),
         millinewton_per_metre: makeEUInformation("C22", "mN/m", "millinewton per metre - 10⁻³ N/m"),
         newton_per_centimetre: makeEUInformation("M23", "N/cm", "newton per centimetre - 10² N/m"),
         kilonewton_per_metre: makeEUInformation(
            "N31",
            "kN/m",
            "kilonewton per metre - 1000-fold of the derived SI unit newton divided by the SI base unit metre. 10³ N/m"
         ),
         dyne_per_centimetre: makeEUInformation("DX", "dyn/cm", "dyne per centimetre - 10⁻³ N/m"),
         poundal_per_inch: makeEUInformation(
            "N32",
            "pdl/in",
            "poundal per inch - Non SI-conforming unit of the surface tension according to the Imperial unit system as quotient poundal by inch. 5,443 110 N/m"
         ),
         "pound-force_per_yard": makeEUInformation(
            "N33",
            "lbf/yd",
            "pound-force per yard - Unit of force per unit length based on the Anglo-American system of units. 4,864 635 N/m"
         )
      },
      /**
       * torsional stiffness, area-related torsional moment
       */
      "torsional stiffness, area-related torsional moment ": {
         newton_metre_per_square_metre: makeEUInformation("M34", "N·m/m²", "newton metre per square metre - N x m/m²")
      },
      /**
       * work, energy, potential energy, kinetic energy
       */
      "work, energy, potential energy, kinetic energy": {
         joule: makeEUInformation("JOU", "J", "joule - J"),
         kilojoule: makeEUInformation("KJO", "kJ", "kilojoule - 10³ J"),
         exajoule: makeEUInformation("A68", "EJ", "exajoule - 10¹⁸ J"),
         petajoule: makeEUInformation("C68", "PJ", "petajoule - 10¹⁵ J"),
         terajoule: makeEUInformation("D30", "TJ", "terajoule - 10¹² J"),
         gigajoule: makeEUInformation("GV", "GJ", "gigajoule - 10⁹ J"),
         megajoule: makeEUInformation("3B", "MJ", "megajoule - 10⁶ J"),
         millijoule: makeEUInformation("C15", "mJ", "millijoule - 10⁻³ J"),
         femtojoule: makeEUInformation("A70", "fJ", "femtojoule - 10⁻¹⁵ J"),
         attojoule: makeEUInformation("A13", "aJ", "attojoule - 10⁻¹⁸ J"),
         watt_hour: makeEUInformation("WHR", "W·h", "watt hour - 3,6 x 10³ J"),
         "megawatt_hour_(1000 kW.h)": makeEUInformation(
            "MWH",
            "MW·h",
            "megawatt hour (1000 kW.h) - A unit of power defining the total amount of bulk energy transferred or consumed. 3,6 x 10⁹ J"
         ),
         kilowatt_hour: makeEUInformation("KWH", "kW·h", "kilowatt hour - 3,6 x 10⁶ J"),
         gigawatt_hour: makeEUInformation("GWH", "GW·h", "gigawatt hour - 3,6 x 10¹² J"),
         terawatt_hour: makeEUInformation("D32", "TW·h", "terawatt hour - 3,6 x 10¹⁵ J"),
         electronvolt: makeEUInformation("A53", "eV", "electronvolt - 1,602 176 487 x 10⁻¹⁹ J"),
         megaelectronvolt: makeEUInformation("B71", "MeV", "megaelectronvolt - 10⁶ eV"),
         gigaelectronvolt: makeEUInformation("A85", "GeV", "gigaelectronvolt - 10⁹ eV"),
         kiloelectronvolt: makeEUInformation("B29", "keV", "kiloelectronvolt - 10³ eV"),
         erg: makeEUInformation("A57", "erg", "erg - 10⁻⁷J"),
         "foot_pound-force": makeEUInformation("85", "ft·lbf", "foot pound-force - 1,355 818 J"),
         "kilogram-force_metre": makeEUInformation("B38", "kgf·m", "kilogram-force metre - 9,806 65 N x m"),
         foot_poundal: makeEUInformation("N46", "ft·pdl", "foot poundal - Unit of the work (force-path). 4,214 011 x 10⁻² J"),
         inch_poundal: makeEUInformation(
            "N47",
            "in·pdl",
            "inch poundal - Unit of work (force multiplied by path) according to the Imperial system of units as a product unit inch multiplied by poundal. 3,511 677 x 10⁻³ J"
         )
      },
      /**
       * work per unit weight
       */
      "work per unit weight": {
         "pound-force_foot_per_pound": makeEUInformation("G20", "lbf·ft/lb", "pound-force foot per pound - 2,989 07 m² x s⁻²")
      },
      /**
       * power
       */
      power: {
         watt: makeEUInformation("WTT", "W", "watt - W"),
         kilowatt: makeEUInformation("KWT", "kW", "kilowatt - 10³ W"),
         megawatt: makeEUInformation(
            "MAW",
            "MW",
            "megawatt - A unit of power defining the rate of energy transferred or consumed when a current of 1000 amperes flows due to a potential of 1000 volts at unity power factor. 10⁶ W"
         ),
         gigawatt: makeEUInformation("A90", "GW", "gigawatt - 10⁹ W"),
         milliwatt: makeEUInformation("C31", "mW", "milliwatt - 10⁻³ W"),
         microwatt: makeEUInformation("D80", "µW", "microwatt - 10⁻⁶ W"),
         water_horse_power: makeEUInformation(
            "F80",
            "",
            "water horse power - A unit of power defining the amount of power required to move a given volume of water against acceleration of gravity to a specified elevation (pressure head). 7,460 43 x 10² W"
         ),
         erg_per_second: makeEUInformation("A63", "erg/s", "erg per second - 10⁻⁷ W"),
         "foot_pound-force_per_second": makeEUInformation("A74", "ft·lbf/s", "foot pound-force per second - 1,355 818 W"),
         "kilogram-force_metre_per_second": makeEUInformation("B39", "kgf·m/s", "kilogram-force metre per second - 9,806 65 W"),
         metric_horse_power: makeEUInformation("HJ", "metric hp", "metric horse power - 735,498 75 W"),
         cheval_vapeur: makeEUInformation("A25", "CV", "cheval vapeur - Synonym: metric horse power 7,354 988 x 10² W"),
         brake_horse_power: makeEUInformation("BHP", "BHP", "brake horse power - 7,457 x 10² W"),
         "foot_pound-force_per_hour": makeEUInformation("K15", "ft·lbf/h", "foot pound-force per hour - 3,766 161 x 10⁻⁴ W"),
         "foot_pound-force_per_minute": makeEUInformation(
            "K16",
            "ft·lbf/min",
            "foot pound-force per minute - 2,259 697 x 10⁻² W"
         ),
         "horsepower_(boiler)": makeEUInformation("K42", "boiler hp", "horsepower (boiler) - 9,809 50 x 10³ W"),
         Pferdestaerke: makeEUInformation(
            "N12",
            "PS",
            "Pferdestaerke - Obsolete unit of the power relating to DIN 1301-3:1979: 1 PS = 735,498 75 W. 7,354 988 x 10² W"
         )
      },
      /**
       * mass flow rate
       */
      "mass flow rate": {
         kilogram_per_second: makeEUInformation("KGS", "kg/s", "kilogram per second - kg/s"),
         kilogram_per_square_metre_second: makeEUInformation(
            "H56",
            "kg/(m²·s)",
            "kilogram per square metre second - kg m⁻² x s⁻¹"
         ),
         kilogram_per_second_pascal: makeEUInformation(
            "M87",
            "(kg/s)/Pa",
            "kilogram per second pascal - SI base unit kilogram divided by the product of the SI base unit second and the derived SI unit pascal. m x s"
         ),
         milligram_per_hour: makeEUInformation("4M", "mg/h", "milligram per hour - 2,777 78 x 10⁻¹⁰ kg/s"),
         gram_per_day: makeEUInformation("F26", "g/d", "gram per day - 1,157 41 × 10⁻⁸ kg x s⁻¹"),
         gram_per_day_bar: makeEUInformation("F62", "g/(d·bar)", "gram per day bar - 1,157 41 × 10⁻¹³ m x s"),
         gram_per_day_kelvin: makeEUInformation("F35", "g/(d·K)", "gram per day kelvin - 1,157 41 × 10⁻⁸ kg x s⁻¹ x K⁻¹"),
         gram_per_hour: makeEUInformation("F27", "g/h", "gram per hour - 2,777 78 × 10⁻⁷ kg x s⁻¹"),
         gram_per_hour_bar: makeEUInformation("F63", "g/(h·bar)", "gram per hour bar - 2,777 78 × 10⁻¹² m x s"),
         gram_per_hour_kelvin: makeEUInformation("F36", "g/(h·K)", "gram per hour kelvin - 2,777 78 × 10⁻⁷ kg x s⁻¹ x K⁻¹"),
         gram_per_minute: makeEUInformation("F28", "g/min", "gram per minute - 1,666 67 × 10⁻⁵ kg x s⁻¹"),
         gram_per_minute_bar: makeEUInformation("F64", "g/(min·bar)", "gram per minute bar - 1,666 67 × 10⁻¹⁰ m x s"),
         gram_per_minute_kelvin: makeEUInformation(
            "F37",
            "g/(min·K)",
            "gram per minute kelvin - 1,666 67 × 10⁻⁵ kg x s⁻¹ x K⁻¹"
         ),
         gram_per_second: makeEUInformation("F29", "g/s", "gram per second - 10⁻³ kg x s⁻¹"),
         gram_per_second_bar: makeEUInformation("F65", "g/(s·bar)", "gram per second bar - 10⁻⁸ m x s"),
         gram_per_second_kelvin: makeEUInformation("F38", "g/(s·K)", "gram per second kelvin - 10⁻³ kg x s⁻¹ x K⁻¹"),
         kilogram_per_day: makeEUInformation("F30", "kg/d", "kilogram per day - 1,157 41 × 10⁻⁵ kg x s⁻¹"),
         kilogram_per_day_bar: makeEUInformation("F66", "kg/(d·bar)", "kilogram per day bar - 1,157 41 × 10⁻¹⁰ m x s"),
         kilogram_per_day_kelvin: makeEUInformation(
            "F39",
            "kg/(d·K)",
            "kilogram per day kelvin - 1,157 41 × 10⁻⁵ kg x s⁻¹ x K⁻¹"
         ),
         kilogram_per_hour: makeEUInformation("E93", "kg/h", "kilogram per hour - 2,777 78 × 10⁻⁴ kg x s⁻¹"),
         kilogram_per_hour_bar: makeEUInformation("F67", "kg/(h·bar)", "kilogram per hour bar - 2,777 78 × 10⁻⁹ m x s"),
         kilogram_per_hour_kelvin: makeEUInformation(
            "F40",
            "kg/(h·K)",
            "kilogram per hour kelvin - 2,777 78 × 10⁻⁴ kg x s⁻¹ x K⁻¹"
         ),
         kilogram_per_minute: makeEUInformation("F31", "kg/min", "kilogram per minute - 1,666 67 × 10⁻² kg x s⁻¹"),
         kilogram_per_minute_bar: makeEUInformation("F68", "kg/(min·bar)", "kilogram per minute bar - 1,666 67 × 10⁻⁷ m x s"),
         kilogram_per_minute_kelvin: makeEUInformation(
            "F41",
            "kg/(min·K)",
            "kilogram per minute kelvin - 1,666 67 × 10⁻²kg x s⁻¹ x K⁻¹"
         ),
         kilogram_per_second_bar: makeEUInformation("F69", "kg/(s·bar)", "kilogram per second bar - 10⁻⁵ m x s"),
         kilogram_per_second_kelvin: makeEUInformation("F42", "kg/(s·K)", "kilogram per second kelvin - kg x s⁻¹ x K⁻¹"),
         milligram_per_day: makeEUInformation("F32", "mg/d", "milligram per day - 1,157 41 × 10⁻¹¹ kg x s⁻¹"),
         milligram_per_day_bar: makeEUInformation("F70", "mg/(d·bar)", "milligram per day bar - 1,157 41 × 10⁻¹⁶ m x s"),
         milligram_per_day_kelvin: makeEUInformation(
            "F43",
            "mg/(d·K)",
            "milligram per day kelvin - 1,157 41 × 10⁻¹¹ kg x s⁻¹ x K⁻¹"
         ),
         milligram_per_hour_bar: makeEUInformation("F71", "mg/(h·bar)", "milligram per hour bar - 2,777 78 × 10⁻¹⁵ m x s"),
         milligram_per_hour_kelvin: makeEUInformation(
            "F44",
            "mg/(h·K)",
            "milligram per hour kelvin - 2,777 78 × 10⁻¹⁰ kg x s⁻¹ x K⁻¹"
         ),
         milligram_per_minute: makeEUInformation("F33", "mg/min", "milligram per minute - 1,666 67 × 10⁻⁸ kg x s⁻¹"),
         milligram_per_minute_bar: makeEUInformation("F72", "mg/(min·bar)", "milligram per minute bar - 1,666 67 × 10⁻¹³ m x s"),
         milligram_per_minute_kelvin: makeEUInformation(
            "F45",
            "mg/(min·K)",
            "milligram per minute kelvin - 1,666 67 × 10⁻⁸ kg x s⁻¹ x K⁻¹"
         ),
         milligram_per_second: makeEUInformation("F34", "mg/s", "milligram per second - 10⁻⁶ kg x s⁻¹"),
         milligram_per_second_bar: makeEUInformation("F73", "mg/(s·bar)", "milligram per second bar - 10⁻¹¹ m x s"),
         milligram_per_second_kelvin: makeEUInformation("F46", "mg/(s·K)", "milligram per second kelvin - 10⁻⁶ kg x s⁻¹ x K⁻¹"),
         gram_per_hertz: makeEUInformation("F25", "g/Hz", "gram per hertz - 10⁻³ kg x s"),
         "ton_(US)_per_hour": makeEUInformation("4W", "ton (US) /h", "ton (US) per hour - 2,519 958 x 10⁻¹ kg/s"),
         pound_per_hour: makeEUInformation("4U", "lb/h", "pound per hour - 1,259 979 x 10⁻⁴ kg/s"),
         "pound_(avoirdupois)_per_day": makeEUInformation("K66", "lb/d", "pound (avoirdupois) per day - 5,249 912 x 10⁻⁶ kg/s"),
         "pound_(avoirdupois)_per_hour_degree_Fahrenheit": makeEUInformation(
            "K73",
            "(lb/h)/°F",
            "pound (avoirdupois) per hour degree Fahrenheit - 2,267 962 x 10⁻⁴ (kg/s)/K"
         ),
         "pound_(avoirdupois)_per_hour_psi": makeEUInformation(
            "K74",
            "(lb/h)/psi",
            "pound (avoirdupois) per hour psi - 1,827 445 x 10⁻⁸ (kg/s)/Pa"
         ),
         "pound_(avoirdupois)_per_minute": makeEUInformation(
            "K78",
            "lb/min",
            "pound (avoirdupois) per minute - 7,559 873 x 10⁻³ kg/s"
         ),
         "pound_(avoirdupois)_per_minute_degree_Fahrenheit": makeEUInformation(
            "K79",
            "lb/(min·°F)",
            "pound (avoirdupois) per minute degree Fahrenheit - 1,360 777  x 10⁻² (kg/s)/K"
         ),
         "pound_(avoirdupois)_per_minute_psi": makeEUInformation(
            "K80",
            "(lb/min)/psi",
            "pound (avoirdupois) per minute psi - 1,096 467 x 10⁻⁶ (kg/s)/Pa"
         ),
         "pound_(avoirdupois)_per_second": makeEUInformation("K81", "lb/s", "pound (avoirdupois) per second - 0,453 592 4 kg/s"),
         "pound_(avoirdupois)_per_second_degree_Fahrenheit": makeEUInformation(
            "K82",
            "(lb/s)/°F",
            "pound (avoirdupois) per second degree Fahrenheit - 0,816 466 3 (kg/s)/K"
         ),
         "pound_(avoirdupois)_per_second_psi": makeEUInformation(
            "K83",
            "(lb/s)/psi",
            "pound (avoirdupois) per second psi - 6,578 802 x 10⁻⁵ (kg/s)/Pa"
         ),
         "ounce_(avoirdupois)_per_day": makeEUInformation("L33", "oz/d", "ounce (avoirdupois) per day - 3,281 194 x 10⁻⁷kg/s"),
         "ounce_(avoirdupois)_per_hour": makeEUInformation(
            "L34",
            "oz/h",
            "ounce (avoirdupois) per hour - 7,874 867 x 10⁻⁶ kg/s"
         ),
         "ounce_(avoirdupois)_per_minute": makeEUInformation(
            "L35",
            "oz/min",
            "ounce (avoirdupois) per minute - 4,724 92 x 10⁻⁴ kg/s"
         ),
         "ounce_(avoirdupois)_per_second": makeEUInformation(
            "L36",
            "oz/s",
            "ounce (avoirdupois) per second - 2,834 952 x 10⁻² kg/s"
         ),
         slug_per_day: makeEUInformation("L63", "slug/d", "slug per day - 1,689 109 x 10⁻⁴ kg/s"),
         slug_per_hour: makeEUInformation("L66", "slug/h", "slug per hour - 4,053 861 x 10⁻³ kg/s"),
         slug_per_minute: makeEUInformation("L67", "slug/min", "slug per minute - 0,243 231 7 kg/s"),
         slug_per_second: makeEUInformation("L68", "slug/s", "slug per second - 14,593 90 kg/s"),
         tonne_per_day: makeEUInformation("L71", "t/d", "tonne per day - 1,157 41 x 10⁻² kg/s"),
         tonne_per_day_kelvin: makeEUInformation("L72", "(t/d)/K", "tonne per day kelvin - 1,157 41 x 10⁻² (kg/s)/K"),
         tonne_per_day_bar: makeEUInformation("L73", "(t/d)/bar", "tonne per day bar - 1,157 41 x 10⁻⁷ (kg/s)/Pa"),
         tonne_per_hour: makeEUInformation(
            "E18",
            "t/h",
            "tonne per hour - A unit of weight or mass equal to one tonne per hour. 2,777 78 x 10⁻¹ kg/s"
         ),
         tonne_per_hour_kelvin: makeEUInformation("L74", "(t/h)/K", "tonne per hour kelvin - 2,777 78 x 10⁻¹ (kg/s)/K"),
         tonne_per_hour_bar: makeEUInformation("L75", "(t/h)/bar", "tonne per hour bar - 2,777 78 x 10⁻⁶ (kg/s)/Pa"),
         tonne_per_minute: makeEUInformation("L78", "t/min", "tonne per minute - 16,666 7 kg/s"),
         tonne_per_minute_kelvin: makeEUInformation("L79", "(t/min)/K", "tonne per minute kelvin - 16,666 7 (kg/s)/K"),
         tonne_per_minute_bar: makeEUInformation("L80", "(t/min)/bar", "tonne per minute bar - 1,666 67 x 10⁻⁴ (kg/s)/Pa"),
         tonne_per_second: makeEUInformation("L81", "t/s", "tonne per second - 10³ kg/s"),
         tonne_per_second_kelvin: makeEUInformation("L82", "(t/s)/K", "tonne per second kelvin - 10³ (kg/s)/K"),
         tonne_per_second_bar: makeEUInformation("L83", "(t/s)/bar", "tonne per second bar - 10⁻² (kg/s)/Pa"),
         ton_long_per_day: makeEUInformation("L85", "ton (UK)/d", "ton long per day - 1,175 980 x 10⁻² kg/s"),
         ton_short_per_day: makeEUInformation("L88", "ton (US)/d", "ton short per day - 1,049 982 x 10⁻² kg/s"),
         ton_short_per_hour_degree_Fahrenheit: makeEUInformation(
            "L89",
            "ton (US)/(h·°F)",
            "ton short per hour degree Fahrenheit - 0,453 592 2 kg/s x K"
         ),
         ton_short_per_hour_psi: makeEUInformation(
            "L90",
            "(ton (US)/h)/psi",
            "ton short per hour psi - 3,654 889 x 10⁻⁵ (kg/s)/Pa"
         ),
         tonne_per_month: makeEUInformation(
            "M88",
            "t/mo",
            "tonne per month - Unit tonne divided by the unit month. 3,802 570 537 68 x 10⁻⁴ kg/s"
         ),
         tonne_per_year: makeEUInformation(
            "M89",
            "t/y",
            "tonne per year - Unit tonne divided by the unit year with 365 days. 3,168 808 781 x 10⁻⁵ kg/s"
         ),
         kilopound_per_hour: makeEUInformation(
            "M90",
            "klb/h",
            "kilopound per hour - 1000-fold of the unit of the mass avoirdupois pound according to the avoirdupois unit system divided by the unit hour. 0,125 997 889 kg/s"
         )
      },
      /**
       * mass ratio
       */
      "mass ratio": {
         microgram_per_kilogram: makeEUInformation("J33", "µg/kg", "microgram per kilogram - 10⁻⁹"),
         nanogram_per_kilogram: makeEUInformation("L32", "ng/kg", "nanogram per kilogram - 10⁻¹²"),
         milligram_per_kilogram: makeEUInformation("NA", "mg/kg", "milligram per kilogram - 10⁻⁶  1"),
         kilogram_per_kilogram: makeEUInformation("M29", "kg/kg", "kilogram per kilogram - 1"),
         pound_per_pound: makeEUInformation(
            "M91",
            "lb/lb",
            "pound per pound - Proportion of the mass consisting of the avoirdupois pound according to the avoirdupois unit system divided by the avoirdupois pound according to the avoirdupois unit system. 1"
         ),
         microgram_per_hectogram: makeEUInformation("Q29", "µg/hg", "microgram per hectogram - Microgram per hectogram. 10⁻8")
      },
      /**
       * volume flow rate
       */
      "volume flow rate": {
         cubic_metre_per_second: makeEUInformation("MQS", "m³/s", "cubic metre per second - m³/s"),
         cubic_metre_per_hour: makeEUInformation("MQH", "m³/h", "cubic metre per hour - 2,777 78 x 10⁻⁴ m³/s"),
         millilitre_per_second: makeEUInformation("40", "ml/s", "millilitre per second - 10⁻⁶ m³/s"),
         millilitre_per_minute: makeEUInformation("41", "ml/min", "millilitre per minute - 1,666 67 x 10⁻⁸ m³/s"),
         litre_per_day: makeEUInformation("LD", "l/d", "litre per day - 1,157 41 x 10⁻⁸ m³/s"),
         cubic_centimetre_per_second: makeEUInformation("2J", "cm³/s", "cubic centimetre per second - 10⁻⁶ m³/s"),
         kilolitre_per_hour: makeEUInformation("4X", "kl/h", "kilolitre per hour - 2,777 78 x 10⁻⁴ m³/s"),
         litre_per_minute: makeEUInformation("L2", "l/min", "litre per minute - 1,666 67 x 10⁻⁵ m³/s"),
         cubic_centimetre_per_day: makeEUInformation("G47", "cm³/d", "cubic centimetre per day - 1,157 41 × 10⁻¹¹ m³ x s⁻¹"),
         cubic_centimetre_per_day_bar: makeEUInformation(
            "G78",
            "cm³/(d·bar)",
            "cubic centimetre per day bar - 1,157 41 × 10⁻¹⁶ kg⁻¹ x m⁴ x s"
         ),
         cubic_centimetre_per_day_kelvin: makeEUInformation(
            "G61",
            "cm³/(d·K)",
            "cubic centimetre per day kelvin - 1,157 41 × 10⁻¹¹ m³ x s⁻¹ x K⁻¹"
         ),
         cubic_centimetre_per_hour: makeEUInformation("G48", "cm³/h", "cubic centimetre per hour - 2,777 78 × 10⁻¹⁰ m³ x s⁻¹"),
         cubic_centimetre_per_hour_bar: makeEUInformation(
            "G79",
            "cm³/(h·bar)",
            "cubic centimetre per hour bar - 2,777 78 × 10⁻¹⁵ kg⁻¹ x m⁴ x s"
         ),
         cubic_centimetre_per_hour_kelvin: makeEUInformation(
            "G62",
            "cm³/(h·K)",
            "cubic centimetre per hour kelvin - 2,777 78 × 10⁻¹⁰ m³ x s⁻¹ x K⁻¹"
         ),
         cubic_centimetre_per_minute: makeEUInformation(
            "G49",
            "cm³/min",
            "cubic centimetre per minute - 1,666 67 × 10⁻⁸ m³ x s⁻¹"
         ),
         cubic_centimetre_per_minute_bar: makeEUInformation(
            "G80",
            "cm³/(min·bar)",
            "cubic centimetre per minute bar - 1,666 67 × 10⁻¹³ kg⁻¹ x m⁴ x s"
         ),
         cubic_centimetre_per_minute_kelvin: makeEUInformation(
            "G63",
            "cm³/(min·K)",
            "cubic centimetre per minute kelvin - 1,666 67 × 10⁻⁸ m³ x s⁻¹ x K⁻¹"
         ),
         cubic_centimetre_per_second_bar: makeEUInformation(
            "G81",
            "cm³/(s·bar)",
            "cubic centimetre per second bar - 10⁻¹¹ kg⁻¹ x m⁴ x s"
         ),
         cubic_centimetre_per_second_kelvin: makeEUInformation(
            "G64",
            "cm³/(s·K)",
            "cubic centimetre per second kelvin - 10⁻⁶ m³ x s⁻¹ x K⁻¹"
         ),
         cubic_decimetre_per_hour: makeEUInformation("E92", "dm³/h", "cubic decimetre per hour - 2,777 78 × 10⁻⁷ m³ x s⁻¹"),
         cubic_metre_per_day: makeEUInformation("G52", "m³/d", "cubic metre per day - 1,157 41 × 10⁻⁵ m³ x s⁻¹"),
         cubic_metre_per_day_bar: makeEUInformation(
            "G86",
            "m³/(d·bar)",
            "cubic metre per day bar - 1,157 41 × 10⁻¹⁰ kg⁻¹ x m⁴ x s"
         ),
         cubic_metre_per_day_kelvin: makeEUInformation(
            "G69",
            "m³/(d·K)",
            "cubic metre per day kelvin - 1,157 41 × 10⁻⁵ m³ x s⁻¹ x K⁻¹"
         ),
         cubic_metre_per_hour_bar: makeEUInformation(
            "G87",
            "m³/(h·bar)",
            "cubic metre per hour bar - 2,777 78 × 10⁻⁹ kg⁻¹ x m⁴ x s"
         ),
         cubic_metre_per_hour_kelvin: makeEUInformation(
            "G70",
            "m³/(h·K)",
            "cubic metre per hour kelvin - 2,777 78 × 10⁻⁴ m³ x s⁻¹ x K⁻¹"
         ),
         cubic_metre_per_minute: makeEUInformation("G53", "m³/min", "cubic metre per minute - 1,666 67 × 10⁻² m³ x s⁻¹"),
         cubic_metre_per_minute_bar: makeEUInformation(
            "G88",
            "m³/(min·bar)",
            "cubic metre per minute bar - 1,666 67 × 10⁻⁷ kg⁻¹ x m⁴ x s"
         ),
         cubic_metre_per_minute_kelvin: makeEUInformation(
            "G71",
            "m³/(min·K)",
            "cubic metre per minute kelvin - 1,666 67 × 10⁻² m³ x s⁻¹ x K⁻¹"
         ),
         cubic_metre_per_second_bar: makeEUInformation("G89", "m³/(s·bar)", "cubic metre per second bar - 10⁻⁵ kg⁻¹ x m⁴ x s"),
         cubic_metre_per_second_kelvin: makeEUInformation("G72", "m³/(s·K)", "cubic metre per second kelvin - m³ x s⁻¹ x K⁻¹"),
         litre_per_day_bar: makeEUInformation("G82", "l/(d·bar)", "litre per day bar - 1,157 41 × 10⁻¹³ kg⁻¹ x m⁴ x s"),
         litre_per_day_kelvin: makeEUInformation("G65", "l/(d·K)", "litre per day kelvin - 1,157 41 × 10⁻⁸ m³ x s⁻¹ x K⁻¹"),
         litre_per_hour_bar: makeEUInformation("G83", "l/(h·bar)", "litre per hour bar - 2,777 78 × 10⁻¹² kg⁻¹ x m⁴ x s"),
         litre_per_hour_kelvin: makeEUInformation("G66", "l/(h·K)", "litre per hour kelvin - 2,777 78 × 10⁻⁷ m³ x s⁻¹ x K⁻¹"),
         litre_per_minute_bar: makeEUInformation("G84", "l/(min·bar)", "litre per minute bar - 1,666 67 × 10⁻¹⁰ kg⁻¹ x m⁴ x s"),
         litre_per_minute_kelvin: makeEUInformation(
            "G67",
            "l/(min·K)",
            "litre per minute kelvin - 1,666 67 × 10⁻⁵ m³ x s⁻¹ x K⁻¹"
         ),
         litre_per_second: makeEUInformation("G51", "l/s", "litre per second - 10⁻³ m³ x s⁻¹"),
         litre_per_second_bar: makeEUInformation("G85", "l/(s·bar)", "litre per second bar - 10⁻⁸ kg⁻¹ x m⁴ x s"),
         litre_per_second_kelvin: makeEUInformation("G68", "l/(s·K)", "litre per second kelvin - 10⁻³ m³ x s⁻¹ x K⁻¹"),
         millilitre_per_day: makeEUInformation("G54", "ml/d", "millilitre per day - 1,157 41 × 10⁻¹¹ m³ x s⁻¹"),
         millilitre_per_day_bar: makeEUInformation(
            "G90",
            "ml/(d·bar)",
            "millilitre per day bar - 1,157 41 x 10⁻¹⁶ x kg⁻¹ x m⁴ x s"
         ),
         millilitre_per_day_kelvin: makeEUInformation(
            "G73",
            "ml/(d·K)",
            "millilitre per day kelvin - 1,157 41 × 10⁻¹¹ m³ x s⁻¹ x K⁻¹"
         ),
         millilitre_per_hour: makeEUInformation("G55", "ml/h", "millilitre per hour - 2,777 78 × 10⁻¹⁰ m³ x s⁻¹"),
         millilitre_per_hour_bar: makeEUInformation(
            "G91",
            "ml/(h·bar)",
            "millilitre per hour bar - 2,777 78 x 10⁻¹⁵ x kg⁻¹ x m⁴ x s"
         ),
         millilitre_per_hour_kelvin: makeEUInformation(
            "G74",
            "ml/(h·K)",
            "millilitre per hour kelvin - 2,777 78 × 10⁻¹⁰ m³ x s⁻¹ x K⁻¹"
         ),
         millilitre_per_minute_bar: makeEUInformation(
            "G92",
            "ml/(min·bar)",
            "millilitre per minute bar - 1,666 67 × 10⁻¹³ x kg⁻¹ x m⁴ x s"
         ),
         millilitre_per_minute_kelvin: makeEUInformation(
            "G75",
            "ml/(min·K)",
            "millilitre per minute kelvin - 1,666 67 × 10⁻⁸ m³ x s⁻¹ x K⁻¹"
         ),
         millilitre_per_second_bar: makeEUInformation("G93", "ml/(s·bar)", "millilitre per second bar - 10⁻¹¹ kg⁻¹ x m⁴ x s"),
         millilitre_per_second_kelvin: makeEUInformation(
            "G76",
            "ml/(s·K)",
            "millilitre per second kelvin - 10⁻⁶ m³ x s⁻¹ x K⁻¹"
         ),
         cubic_foot_per_hour: makeEUInformation("2K", "ft³/h", "cubic foot per hour - 7,865 79 x 10⁻⁶ m³/s"),
         cubic_foot_per_minute: makeEUInformation("2L", "ft³/min", "cubic foot per minute - 4,719 474 x 10⁻⁴ m³/s"),
         "barrel_(US)_per_minute": makeEUInformation("5A", "barrel (US)/min", "barrel (US) per minute - 2,649 79 x 10⁻³ m³/s"),
         US_gallon_per_minute: makeEUInformation("G2", "gal (US) /min", "US gallon per minute - 6,309 020 x 10⁻⁵ m³/s"),
         Imperial_gallon_per_minute: makeEUInformation(
            "G3",
            "gal (UK) /min",
            "Imperial gallon per minute - 7,576 82 x 10⁻⁵ m³/s"
         ),
         cubic_inch_per_hour: makeEUInformation("G56", "in³/h", "cubic inch per hour - 4,551 96 × 10⁻⁹ m³ x s⁻¹"),
         cubic_inch_per_minute: makeEUInformation("G57", "in³/min", "cubic inch per minute - 2,731 18 × 10⁻⁷ m³ x s⁻¹"),
         cubic_inch_per_second: makeEUInformation("G58", "in³/s", "cubic inch per second - 1,638 71 × 10⁻⁵ m³ x s⁻¹"),
         "gallon_(US)_per_hour": makeEUInformation("G50", "gal/h", "gallon (US) per hour - 1,051 5 × 10⁻⁶ m³ x s⁻¹"),
         "barrel_(UK_petroleum)_per_minute": makeEUInformation(
            "J58",
            "bbl (UK liq.)/min",
            "barrel (UK petroleum) per minute - 2,651 886 m³/s"
         ),
         "barrel_(UK_petroleum)_per_day": makeEUInformation(
            "J59",
            "bbl (UK liq.)/d",
            "barrel (UK petroleum) per day - 1,841 587 4 x 10⁻⁶ m³/s"
         ),
         "barrel_(UK_petroleum)_per_hour": makeEUInformation(
            "J60",
            "bbl (UK liq.)/h",
            "barrel (UK petroleum) per hour - 4,419 810 x 10⁻⁵ m³/s"
         ),
         "barrel_(UK_petroleum)_per_second": makeEUInformation(
            "J61",
            "bbl (UK liq.)/s",
            "barrel (UK petroleum) per second - 0,159 113 15 m³/s"
         ),
         "barrel_(US_petroleum)_per_hour": makeEUInformation(
            "J62",
            "bbl (US)/h",
            "barrel (US petroleum) per hour - 4,416 314 x 10⁻⁵ m³/s"
         ),
         "barrel_(US_petroleum)_per_second": makeEUInformation(
            "J63",
            "bbl (US)/s",
            "barrel (US petroleum) per second - 0,158 987 3 m³/s"
         ),
         "bushel_(UK)_per_day": makeEUInformation("J64", "bu (UK)/d", "bushel (UK) per day - 4,209 343 x 10⁻⁷ m³/s"),
         "bushel_(UK)_per_hour": makeEUInformation("J65", "bu (UK)/h", "bushel (UK) per hour - 1,010 242 x 10⁻⁵ m³/s"),
         "bushel_(UK)_per_minute": makeEUInformation("J66", "bu (UK)/min", "bushel (UK) per minute - 6,061 453 x 10⁻⁴ m³/s"),
         "bushel_(UK)_per_second": makeEUInformation("J67", "bu (UK)/s", "bushel (UK) per second - 3,636 872 x 10⁻² m³/s"),
         "bushel_(US_dry)_per_day": makeEUInformation("J68", "bu (US dry)/d", "bushel (US dry) per day - 4,078 596 x 10⁻⁷ m³/s"),
         "bushel_(US_dry)_per_hour": makeEUInformation(
            "J69",
            "bu (US dry)/h",
            "bushel (US dry) per hour - 9,788 631 x 10⁻⁶ m³/s"
         ),
         "bushel_(US_dry)_per_minute": makeEUInformation(
            "J70",
            "bu (US dry)/min",
            "bushel (US dry) per minute - 5,873 178 x 10⁻⁴ m³/s"
         ),
         "bushel_(US_dry)_per_second": makeEUInformation(
            "J71",
            "bu (US dry)/s",
            "bushel (US dry) per second - 3,523 907 x 10⁻² m³/s"
         ),
         cubic_decimetre_per_day: makeEUInformation("J90", "dm³/d", "cubic decimetre per day - 1,157 41 x 10⁻⁸ m³/s"),
         cubic_decimetre_per_minute: makeEUInformation("J92", "dm³/min", "cubic decimetre per minute - 1,666 67 x 10⁻⁵ m³/s"),
         cubic_decimetre_per_second: makeEUInformation("J93", "dm³/s", "cubic decimetre per second - 10⁻³ m³/s"),
         cubic_metre_per_second_pascal: makeEUInformation(
            "N45",
            "(m³/s)/Pa",
            "cubic metre per second pascal - Power of the SI base unit meter by exponent 3 divided by the product of the SI base unit second and the derived SI base unit pascal. kg⁻¹ x m⁴ x s"
         ),
         "ounce_(UK_fluid)_per_day": makeEUInformation(
            "J95",
            "fl oz (UK)/d",
            "ounce (UK fluid) per day - 3,288 549 x 10⁻¹⁰ m³/s"
         ),
         "ounce_(UK_fluid)_per_hour": makeEUInformation(
            "J96",
            "fl oz (UK)/h",
            "ounce (UK fluid) per hour - 7,892 517 x 10⁻⁹ m³/s"
         ),
         "ounce_(UK_fluid)_per_minute": makeEUInformation(
            "J97",
            "fl oz (UK)/min",
            "ounce (UK fluid) per minute - 4,735 51 x 10⁻⁷ m³/s"
         ),
         "ounce_(UK_fluid)_per_second": makeEUInformation(
            "J98",
            "fl oz (UK)/s",
            "ounce (UK fluid) per second - 2,841 306 x 10⁻⁵ m³/s"
         ),
         "ounce_(US_fluid)_per_day": makeEUInformation(
            "J99",
            "fl oz (US)/d",
            "ounce (US fluid) per day - 3,422 862 x 10⁻¹⁰ m³/s"
         ),
         "ounce_(US_fluid)_per_hour": makeEUInformation(
            "K10",
            "fl oz (US)/h",
            "ounce (US fluid) per hour - 8,214 869 x 10⁻⁹ m³/s"
         ),
         "ounce_(US_fluid)_per_minute": makeEUInformation(
            "K11",
            "fl oz (US)/min",
            "ounce (US fluid) per minute - 4,928 922 x 10⁻⁷ m³/s"
         ),
         "ounce_(US_fluid)_per_second": makeEUInformation(
            "K12",
            "fl oz (US)/s",
            "ounce (US fluid) per second - 2,957 353 x 10⁻⁵ m³/s"
         ),
         cubic_foot_per_day: makeEUInformation("K22", "ft³/d", "cubic foot per day - 3,277 413 x 10⁻⁷ m³/s"),
         "gallon_(UK)_per_day": makeEUInformation("K26", "gal (UK)/d", "gallon (UK) per day - 5,261 678 x 10⁻⁸ m³/s"),
         "gallon_(UK)_per_hour": makeEUInformation("K27", "gal (UK)/h", "gallon (UK) per hour - 1,262 803 x 10⁻⁶ m³/s"),
         "gallon_(UK)_per_second": makeEUInformation("K28", "gal (UK)/s", "gallon (UK) per second - 4,546 09 x 10⁻³ m³/s"),
         "gallon_(US_liquid)_per_second": makeEUInformation(
            "K30",
            "gal (US liq.)/s",
            "gallon (US liquid) per second - 3,785 412 x 10⁻³ m³/s"
         ),
         "gill_(UK)_per_day": makeEUInformation("K32", "gi (UK)/d", "gill (UK) per day - 1,644 274 x 10⁻⁵ m³/s"),
         "gill_(UK)_per_hour": makeEUInformation("K33", "gi (UK)/h", "gill (UK) per hour - 3,946 258 x 10⁻⁸ m³/s"),
         "gill_(UK)_per_minute": makeEUInformation("K34", "gi (UK)/min", "gill (UK) per minute - 0,023 677 55 m³/s"),
         "gill_(UK)_per_second": makeEUInformation("K35", "gi (UK)/s", "gill (UK) per second - 1,420 653 x 10⁻⁴ m³/s"),
         "gill_(US)_per_day": makeEUInformation("K36", "gi (US)/d", "gill (US) per day - 1,369 145 x 10⁻⁹ m³/s"),
         "gill_(US)_per_hour": makeEUInformation("K37", "gi (US)/h", "gill (US) per hour - 3,285 947 x 10⁻⁸ m³/s"),
         "gill_(US)_per_minute": makeEUInformation("K38", "gi (US)/min", "gill (US) per minute - 1,971 568 x 10⁻⁶ m³/s"),
         "gill_(US)_per_second": makeEUInformation("K39", "gi (US)/s", "gill (US) per second - 1,182 941 x 10⁻⁴ m³/s"),
         "quart_(UK_liquid)_per_day": makeEUInformation(
            "K94",
            "qt (UK liq.)/d",
            "quart (UK liquid) per day - 1,315 420 x 10⁻⁸ m³/s"
         ),
         "quart_(UK_liquid)_per_hour": makeEUInformation(
            "K95",
            "qt (UK liq.)/h",
            "quart (UK liquid) per hour - 3,157 008 x 10⁻⁷ m³/s"
         ),
         "quart_(UK_liquid)_per_minute": makeEUInformation(
            "K96",
            "qt (UK liq.)/min",
            "quart (UK liquid) per minute - 1,894 205 x 10⁻⁵ m³/s"
         ),
         "quart_(UK_liquid)_per_second": makeEUInformation(
            "K97",
            "qt (UK liq.)/s",
            "quart (UK liquid) per second - 1,136 523 x 10⁻³ m³/s"
         ),
         "quart_(US_liquid)_per_day": makeEUInformation(
            "K98",
            "qt (US liq.)/d",
            "quart (US liquid) per day - 1,095 316 x 10⁻⁸ m³/s"
         ),
         "quart_(US_liquid)_per_hour": makeEUInformation(
            "K99",
            "qt (US liq.)/h",
            "quart (US liquid) per hour - 2,628 758 x 10⁻⁷ m³/s"
         ),
         "quart_(US_liquid)_per_minute": makeEUInformation(
            "L10",
            "qt (US liq.)/min",
            "quart (US liquid) per minute - 1,577 255 x 10⁻⁵ m³/s"
         ),
         "quart_(US_liquid)_per_second": makeEUInformation(
            "L11",
            "qt (US liq.)/s",
            "quart (US liquid) per second - 9,463 529 x 10⁻⁴ m³/s"
         ),
         "peck_(UK)_per_day": makeEUInformation("L44", "pk (UK)/d", "peck (UK) per day - 1,052 336 x 10⁻⁷ m³/s"),
         "peck_(UK)_per_hour": makeEUInformation("L45", "pk (UK)/h", "peck (UK) per hour - 2,525 606 x 10⁻⁶ m³/s"),
         "peck_(UK)_per_minute": makeEUInformation("L46", "pk (UK)/min", "peck (UK) per minute - 1,515 363 5 x 10⁻⁴ m³/s"),
         "peck_(UK)_per_second": makeEUInformation("L47", "pk (UK)/s", "peck (UK) per second - 9,092 181 x 10⁻³ m³/s"),
         "peck_(US_dry)_per_day": makeEUInformation("L48", "pk (US dry)/d", "peck (US dry) per day - 1,019 649 x 10⁻⁷ m³/s"),
         "peck_(US_dry)_per_hour": makeEUInformation("L49", "pk (US dry)/h", "peck (US dry) per hour - 2,447 158 x 10⁻⁶ m³/s"),
         "peck_(US_dry)_per_minute": makeEUInformation(
            "L50",
            "pk (US dry)/min",
            "peck (US dry) per minute - 1,468 295 x 10⁻⁴ m³/s"
         ),
         "peck_(US_dry)_per_second": makeEUInformation(
            "L51",
            "pk (US dry)/s",
            "peck (US dry) per second - 8,809 768 x 10⁻³ m³/s"
         ),
         "pint_(UK)_per_day": makeEUInformation("L53", "pt (UK)/d", "pint (UK) per day - 6,577 098 x 10⁻⁹ m³/s"),
         "pint_(UK)_per_hour": makeEUInformation("L54", "pt (UK)/h", "pint (UK) per hour - 1,578 504 x 10⁻⁷ m³/s"),
         "pint_(UK)_per_minute": makeEUInformation("L55", "pt (UK)/min", "pint (UK) per minute - 9,471 022 x 10⁻⁶ m³/s"),
         "pint_(UK)_per_second": makeEUInformation("L56", "pt (UK)/s", "pint (UK) per second - 5,682 613 x 10⁻⁴ m³/s"),
         "pint_(US_liquid)_per_day": makeEUInformation(
            "L57",
            "pt (US liq.)/d",
            "pint (US liquid) per day - 5,476 580 x 10⁻⁹ m³/s"
         ),
         "pint_(US_liquid)_per_hour": makeEUInformation(
            "L58",
            "pt (US liq.)/h",
            "pint (US liquid) per hour - 1,314 379 x 10⁻⁷ m³/s"
         ),
         "pint_(US_liquid)_per_minute": makeEUInformation(
            "L59",
            "pt (US liq.)/min",
            "pint (US liquid) per minute - 7,886 275 x 10⁻⁶ m³/s"
         ),
         "pint_(US_liquid)_per_second": makeEUInformation(
            "L60",
            "pt (US liq.)/s",
            "pint (US liquid) per second - 4,731 765 x 10⁻⁴ m³/s"
         ),
         cubic_yard_per_day: makeEUInformation("M12", "yd³/d", "cubic yard per day - 8,849 015 x 10⁻⁶ m³/s"),
         cubic_yard_per_hour: makeEUInformation("M13", "yd³/h", "cubic yard per hour - 2,123 764 x 10⁻⁴ m³/s"),
         cubic_yard_per_minute: makeEUInformation("M15", "yd³/min", "cubic yard per minute - 1,274 258 x 10⁻² m³/s"),
         cubic_yard_per_second: makeEUInformation("M16", "yd³/s", "cubic yard per second - 0,764 554 9 m³/s"),
         Standard_cubic_metre_per_day: makeEUInformation(
            "Q37",
            "",
            "Standard cubic metre per day - Standard cubic metre (temperature 15°C and pressure 101325 millibars ) per day 1.15741 × 10-5 m3/s"
         ),
         Standard_cubic_metre_per_hour: makeEUInformation(
            "Q38",
            "",
            "Standard cubic metre per hour - Standard cubic metre (temperature 15°C and pressure 101325 millibars ) per hour 2.77778 × 10-4 m3/s"
         ),
         Normalized_cubic_metre_per_day: makeEUInformation(
            "Q39",
            "",
            "Normalized cubic metre per day - Normalized cubic metre (temperature 0°C and pressure 101325 millibars ) per day 1.15741 × 10-5 m3/s"
         ),
         Normalized_cubic_metre_per_hour: makeEUInformation(
            "Q40",
            "",
            "Normalized cubic metre per hour - Normalized cubic metre (temperature 0°C and pressure 101325 millibars ) per hour 2.77778 × 10-4 m3/s"
         )
      },
      /**
       * volume ratio
       */
      "volume ratio": {
         cubic_metre_per_cubic_metre: makeEUInformation("H60", "m³/m³", "cubic metre per cubic metre - 1")
      },
      /**
       * leakage rate of gas
       */
      "leakage rate of gas": {
         bar_cubic_metre_per_second: makeEUInformation("F92", "bar·m³/s", "bar cubic metre per second - 10⁵ kg x m² x s⁻³"),
         bar_litre_per_second: makeEUInformation("F91", "bar·l/s", "bar litre per second - 10² kg x m² x s⁻³"),
         psi_cubic_inch_per_second: makeEUInformation("K87", "psi·in³/s", "psi cubic inch per second - 0,112 985 Pa x m³/s"),
         psi_litre_per_second: makeEUInformation("K88", "psi·l/s", "psi litre per second - 6,894 757 Pa x m³/s"),
         psi_cubic_metre_per_second: makeEUInformation(
            "K89",
            "psi·m³/s",
            "psi cubic metre per second - 6,894 757  x 10³ Pa x m³/s"
         ),
         psi_cubic_yard_per_second: makeEUInformation(
            "K90",
            "psi·yd³/s",
            "psi cubic yard per second - 5,271 420 x 10³ Pa x m³/s"
         )
      },
      /**
       * undefined
       */
      undefined: {
         Kilowatt_hour_per_normalized_cubic_metre: makeEUInformation(
            "KWN",
            "",
            "Kilowatt hour per normalized cubic metre - Kilowatt hour per normalized cubic metre (temperature 0°C and pressure 101325 millibars ). "
         ),
         Kilowatt_hour_per_standard_cubic_metre: makeEUInformation(
            "KWS",
            "",
            "Kilowatt hour per standard cubic metre - Kilowatt hour per standard cubic metre (temperature 15°C and pressure 101325 millibars). "
         ),
         Joule_per_normalised_cubic_metre: makeEUInformation(
            "Q41",
            "",
            "Joule per normalised cubic metre - Joule per normalised cubic metre (temperature 0°C and pressure 101325 millibars). "
         ),
         Joule_per_standard_cubic_metre: makeEUInformation(
            "Q42",
            "",
            "Joule per standard cubic metre - Joule per standard cubic metre (temperature 15°C and pressure 101325 millibars). "
         ),
         Mega_Joule_per_Normalised_cubic_Metre: makeEUInformation(
            "MNJ",
            "MJ/m³",
            "Mega Joule per Normalised cubic Metre - Energy in Mega Joules per normalised cubic metre for gas (temperature 0°C and pressure 101325 millibars) "
         )
      },
      /**
       * Power flow rate
       */
      "Power flow rate": {
         megawatts_per_minute: makeEUInformation(
            "Q35",
            "MW/min",
            "megawatts per minute - A unit of power defining the total amount of bulk energy transferred or consumer per minute 1.667 × 104 W/s"
         )
      }
   },
   /**
    * Heat
    */
   Heat: {
      /**
       * thermodynamic
       */
      thermodynamic: {
         kelvin: makeEUInformation("KEL", "K", "kelvin - Refer ISO 80000-5 (Quantities and units — Part 5: Thermodynamics) K")
      },
      /**
       * temperature
       */
      temperature: {
         degree_Celsius: makeEUInformation(
            "CEL",
            "°C",
            "degree Celsius - Refer ISO 80000-5 (Quantities and units — Part 5: Thermodynamics) 1 x K"
         ),
         degree_Celsius_per_hour: makeEUInformation("H12", "°C/h", "degree Celsius per hour - 2,777 78 x 10⁻⁴ s⁻¹ K"),
         degree_Celsius_per_bar: makeEUInformation("F60", "°C/bar", "degree Celsius per bar - 10⁻⁵ kg⁻¹ x m x s² x K"),
         degree_Celsius_per_kelvin: makeEUInformation("E98", "°C/K", "degree Celsius per kelvin - 1"),
         degree_Celsius_per_minute: makeEUInformation("H13", "°C/min", "degree Celsius per minute - 1,666 67 x 10⁻² s⁻¹ K"),
         degree_Celsius_per_second: makeEUInformation("H14", "°C/s", "degree Celsius per second - s⁻¹ K"),
         kelvin_per_bar: makeEUInformation("F61", "K/bar", "kelvin per bar - 10⁻⁵ kg⁻¹ x m x s² x K"),
         kelvin_per_hour: makeEUInformation("F10", "K/h", "kelvin per hour - 2,777 78 × 10⁻⁴ s⁻¹ x K"),
         kelvin_per_kelvin: makeEUInformation("F02", "K/K", "kelvin per kelvin - 1"),
         kelvin_per_minute: makeEUInformation("F11", "K/min", "kelvin per minute - 1,666 67 × 10⁻² s⁻¹ x K"),
         kelvin_per_second: makeEUInformation("F12", "K/s", "kelvin per second - s⁻¹ x K"),
         kelvin_per_pascal: makeEUInformation(
            "N79",
            "K/Pa",
            "kelvin per pascal - SI base unit kelvin divided by the derived SI unit pascal. kg⁻¹ x m x s² x K"
         ),
         degree_Fahrenheit_per_kelvin: makeEUInformation("J20", "°F/K", "degree Fahrenheit per kelvin - 0,555 555 6"),
         degree_Fahrenheit_per_bar: makeEUInformation("J21", "°F/bar", "degree Fahrenheit per bar - 0,555 555 6 x 10⁻⁵ K/Pa"),
         reciprocal_degree_Fahrenheit: makeEUInformation("J26", "1/°F", "reciprocal degree Fahrenheit - 1,8 1/K"),
         degree_Rankine: makeEUInformation(
            "A48",
            "°R",
            "degree Rankine - Refer ISO 80000-5 (Quantities and units — Part 5: Thermodynamics) 5/9 x K"
         )
      },
      /**
       * fahrenheit temperature
       */
      "fahrenheit temperature": {
         degree_Fahrenheit: makeEUInformation(
            "FAH",
            "°F",
            "degree Fahrenheit - Refer ISO 80000-5 (Quantities and units — Part 5: Thermodynamics) 5/9 x K"
         )
      },
      /**
       * temperature variation over time
       */
      "temperature variation over time": {
         degree_Fahrenheit_per_hour: makeEUInformation("J23", "°F/h", "degree Fahrenheit per hour - 1,543 210 x 10⁻⁴ K/s"),
         degree_Fahrenheit_per_minute: makeEUInformation(
            "J24",
            "°F/min",
            "degree Fahrenheit per minute - 9,259 259 x 10⁻³  K/s"
         ),
         degree_Fahrenheit_per_second: makeEUInformation("J25", "°F/s", "degree Fahrenheit per second - 0,555 555 6 K/s"),
         degree_Rankine_per_hour: makeEUInformation("J28", "°R/h", "degree Rankine per hour - 1,543 210 x 10⁻⁴ K/s"),
         degree_Rankine_per_minute: makeEUInformation("J29", "°R/min", "degree Rankine per minute - 9,259 259 x 10⁻³  K/s"),
         degree_Rankine_per_second: makeEUInformation("J30", "°R/s", "degree Rankine per second - 0,555 555 6 K/s")
      },
      /**
       * linear expansion coefficient, cubic expansion coefficient, relative pressure coefficient
       */
      "linear expansion coefficient, cubic expansion coefficient, relative pressure coefficient": {
         reciprocal_kelvin_or_kelvin_to_the_power_minus_one: makeEUInformation(
            "C91",
            "K⁻¹",
            "reciprocal kelvin or kelvin to the power minus one - K⁻¹"
         ),
         reciprocal_megakelvin_or_megakelvin_to_the_power_minus_one: makeEUInformation(
            "M20",
            "1/MK",
            "reciprocal megakelvin or megakelvin to the power minus one - 10⁻⁶ K⁻¹"
         )
      },
      /**
       * pressure coefficient
       */
      "pressure coefficient": {
         pascal_per_kelvin: makeEUInformation("C64", "Pa/K", "pascal per kelvin - Pa/K"),
         bar_per_kelvin: makeEUInformation("F81", "bar/K", "bar per kelvin - 10⁵ kg x m⁻¹ x s⁻² x K⁻¹")
      },
      /**
       * isothermal compressibility, isentropic compressibility
       */
      "isothermal compressibility, isentropic compressibility": {
         reciprocal_pascal_or_pascal_to_the_power_minus_one: makeEUInformation(
            "C96",
            "Pa⁻¹",
            "reciprocal pascal or pascal to the power minus one - Pa⁻¹"
         )
      },
      /**
       * heat, quantity of heat, energy, thermodynamic energy, enthalpy, Helmholtz function, Helmholtz free energy
       */
      "heat, quantity of heat, energy, thermodynamic energy, enthalpy, Helmholtz function, Helmholtz free energy": {
         joule: makeEUInformation("JOU", "J", "joule - J"),
         watt_second: makeEUInformation("J55", "W·s", "watt second - W x s"),
         "British_thermal_unit_(international_table)": makeEUInformation(
            "BTU",
            "BtuIT",
            "British thermal unit (international table) - 1,055 056 x 10³ J"
         ),
         "15_°C_calorie": makeEUInformation("A1", "cal₁₅", "15 °C calorie - 4,188 46  J"),
         "calorie_(international_table)_": makeEUInformation("D70", "calIT", "calorie (international table)  - 4,186 8 J"),
         "British_thermal_unit_(mean)": makeEUInformation("J39", "Btu", "British thermal unit (mean) - 1,055 87 x 10³ J"),
         "calorie_(mean)": makeEUInformation("J75", "cal", "calorie (mean) - 4,190 02 J"),
         "kilocalorie_(mean)": makeEUInformation("K51", "kcal", "kilocalorie (mean) - 4,190 02 x 10³ J"),
         "kilocalorie_(international_table)": makeEUInformation(
            "E14",
            "kcalIT",
            "kilocalorie (international table) - 4,186 8 x 10³ J"
         ),
         "kilocalorie_(thermochemical)": makeEUInformation("K53", "kcalth", "kilocalorie (thermochemical) - 4,184 x 10³ J"),
         "British_thermal_unit_(39_ºF)_": makeEUInformation(
            "N66",
            "Btu (39 ºF) ",
            "British thermal unit (39 ºF)  - Unit of heat energy according to the Imperial system of units in a reference temperature of 39 °F. 1,059 67  x 10³ J"
         ),
         "British_thermal_unit_(59_ºF)": makeEUInformation(
            "N67",
            "Btu (59 ºF)",
            "British thermal unit (59 ºF) - Unit of heat energy according to the Imperial system of units in a reference temperature of 59 °F. 1,054 80  x 10³ J"
         ),
         "British_thermal_unit_(60_ºF)_": makeEUInformation(
            "N68",
            "Btu (60 ºF) ",
            "British thermal unit (60 ºF)  - Unit of head energy according to the Imperial system of units at a reference temperature of 60 °F. 1,054 68  x 10³ J"
         ),
         "calorie_(20_ºC)_": makeEUInformation(
            "N69",
            "cal₂₀",
            "calorie (20 ºC)  - Unit for quantity of heat, which is to be required for 1 g air free water at a constant pressure from 101,325 kPa, to warm up the pressure of standard atmosphere at sea level, from 19,5 °C on 20,5 °C. 4,181 90 x J"
         ),
         "quad_(1015_BtuIT)": makeEUInformation(
            "N70",
            "quad",
            "quad (1015 BtuIT) - Unit of heat energy according to the imperial system of units. 1,055 056 × 10¹⁸ J"
         ),
         "therm_(EC)": makeEUInformation(
            "N71",
            "thm (EC)",
            "therm (EC) - Unit of heat energy in commercial use, within the EU defined: 1 thm (EC) = 100 000 BtuIT. 1,055 06 × 10⁸ J"
         ),
         "therm_(U.S.)": makeEUInformation(
            "N72",
            "thm (US)",
            "therm (U.S.) - Unit of heat energy in commercial use. 1,054 804 × 10⁸ J"
         )
      },
      /**
       * Gibbs function, Gibbs free energy
       */
      "Gibbs function, Gibbs free energy": {
         "calorie_(thermochemical)": makeEUInformation("D35", "calth", "calorie (thermochemical) - 4,184 J")
      },
      /**
       * heat flow rate
       */
      "heat flow rate": {
         watt: makeEUInformation("WTT", "W", "watt - W"),
         kilowatt: makeEUInformation("KWT", "kW", "kilowatt - 10³ W"),
         "British_thermal_unit_(international_table)_per_hour": makeEUInformation(
            "2I",
            "BtuIT/h",
            "British thermal unit (international table) per hour - 2,930 711x 10⁻¹ W"
         ),
         "British_thermal_unit_(international_table)_per_minute": makeEUInformation(
            "J44",
            "BtuIT/min",
            "British thermal unit (international table) per minute - 17,584 266 W"
         ),
         "British_thermal_unit_(international_table)_per_second": makeEUInformation(
            "J45",
            "BtuIT/s",
            "British thermal unit (international table) per second - 1,055 056 x 10³ W"
         ),
         "British_thermal_unit_(thermochemical)_per_hour": makeEUInformation(
            "J47",
            "Btuth/h",
            "British thermal unit (thermochemical) per hour - 0,292 875 1 W"
         ),
         "British_thermal_unit_(thermochemical)_per_minute": makeEUInformation(
            "J51",
            "Btuth/min",
            "British thermal unit (thermochemical) per minute - 17,572 50 W"
         ),
         "British_thermal_unit_(thermochemical)_per_second": makeEUInformation(
            "J52",
            "Btuth/s",
            "British thermal unit (thermochemical) per second - 1,054 350 x 10³ W"
         ),
         "calorie_(thermochemical)_per_minute": makeEUInformation(
            "J81",
            "calth/min",
            "calorie (thermochemical) per minute - 6,973 333 x 10⁻² W"
         ),
         "calorie_(thermochemical)_per_second": makeEUInformation(
            "J82",
            "calth/s",
            "calorie (thermochemical) per second - 4,184 W"
         ),
         "kilocalorie_(thermochemical)_per_hour": makeEUInformation(
            "E15",
            "kcalth/h",
            "kilocalorie (thermochemical) per hour - 1,162 22 W"
         ),
         "kilocalorie_(thermochemical)_per_minute": makeEUInformation(
            "K54",
            "kcalth/min",
            "kilocalorie (thermochemical) per minute - 69,733 33 W"
         ),
         "kilocalorie_(thermochemical)_per_second": makeEUInformation(
            "K55",
            "kcalth/s",
            "kilocalorie (thermochemical) per second - 4,184 x 10³ W"
         )
      },
      /**
       * density of heat flow rate
       */
      "density of heat flow rate": {
         watt_per_square_metre: makeEUInformation("D54", "W/m²", "watt per square metre - W/m²"),
         watt_per_square_centimetre_: makeEUInformation(
            "N48",
            "W/cm²",
            "watt per square centimetre  - Derived SI unit watt divided by the power of the 0,01-fold the SI base unit metre by exponent 2. 10⁴ W/m²"
         ),
         watt_per_square_inch_: makeEUInformation(
            "N49",
            "W/in²",
            "watt per square inch  - Derived SI unit watt divided by the power of the unit inch according to the Anglo-American and Imperial system of units by exponent 2. 1,550 003 x 10³ W/m²"
         ),
         "British_thermal_unit_(international_table)_per_square_foot_hour": makeEUInformation(
            "N50",
            "BtuIT/(ft²·h)",
            "British thermal unit (international table) per square foot hour - Unit of the surface heat flux according to the Imperial system of units. 3,154 591 W/m²"
         ),
         "British_thermal_unit_(thermochemical)_per_square_foot_hour": makeEUInformation(
            "N51",
            "Btuth/(ft²·h)",
            "British thermal unit (thermochemical) per square foot hour - Unit of the surface heat flux according to the Imperial system of units. 3,152 481 W/m²"
         ),
         "British_thermal_unit_(thermochemical)_per_square_foot_minute": makeEUInformation(
            "N52",
            "Btuth/(ft²·min) ",
            "British thermal unit (thermochemical) per square foot minute - Unit of the surface heat flux according to the Imperial system of units. 1,891 489 x 10² W/m²"
         ),
         "British_thermal_unit_(international_table)_per_square_foot_second": makeEUInformation(
            "N53",
            "BtuIT/(ft²·s)",
            "British thermal unit (international table) per square foot second - Unit of the surface heat flux according to the Imperial system of units. 1,135 653 x 10⁴ W/m²"
         ),
         "British_thermal_unit_(thermochemical)_per_square_foot_second": makeEUInformation(
            "N54",
            "Btuth/(ft²·s)",
            "British thermal unit (thermochemical) per square foot second - Unit of the surface heat flux according to the Imperial system of units. 1,134 893 x 10⁴ W/m²"
         ),
         "British_thermal_unit_(international_table)_per_square_inch_second": makeEUInformation(
            "N55",
            "BtuIT/(in²·s)",
            "British thermal unit (international table) per square inch second - Unit of the surface heat flux according to the Imperial system of units. 1,634 246 x 10⁶ W/m²"
         ),
         "calorie_(thermochemical)_per_square_centimetre_minute": makeEUInformation(
            "N56",
            "calth/(cm²·min)",
            "calorie (thermochemical) per square centimetre minute - Unit of the surface heat flux according to the Imperial system of units. 6,973 333 x 10² W/m²"
         ),
         "calorie_(thermochemical)_per_square_centimetre_second": makeEUInformation(
            "N57",
            "calth/(cm²·s)",
            "calorie (thermochemical) per square centimetre second - Unit of the surface heat flux according to the Imperial system of units. 4,184 x 10⁴ W/m²"
         )
      },
      /**
       * thermal conductivity
       */
      "thermal conductivity": {
         watt_per_metre_kelvin: makeEUInformation("D53", "W/(m·K)", "watt per metre kelvin - W/(m x K)"),
         watt_per_metre_degree_Celsius: makeEUInformation(
            "N80",
            "W/(m·°C)",
            "watt per metre degree Celsius - Derived SI unit watt divided by the product of the SI base unit metre and the unit for temperature degree Celsius. W/(m x K)"
         ),
         kilowatt_per_metre_kelvin: makeEUInformation(
            "N81",
            "kW/(m·K)",
            "kilowatt per metre kelvin - 1000-fold of the derived SI unit watt divided by the product of the SI base unit metre and the SI base unit kelvin. 10³ W/(m x K)"
         ),
         kilowatt_per_metre_degree_Celsius: makeEUInformation(
            "N82",
            "kW/(m·°C)",
            "kilowatt per metre degree Celsius - 1000-fold of the derived SI unit watt divided by the product of the SI base unit metre and the unit for temperature degree Celsius. 10³ W/(m x K)"
         ),
         "British_thermal_unit_(international_table)_per_second_foot_degree_Rankine": makeEUInformation(
            "A22",
            "BtuIT/(s·ft·°R)",
            "British thermal unit (international table) per second foot degree Rankine - 6 230,64 W/(m x K)"
         ),
         "calorie_(international_table)_per_second_centimetre_kelvin": makeEUInformation(
            "D71",
            "calIT/(s·cm·K)",
            "calorie (international table) per second centimetre kelvin - 418,68 W/(m x K)"
         ),
         "calorie_(thermochemical)_per_second_centimetre_kelvin": makeEUInformation(
            "D38",
            "calth/(s·cm·K)",
            "calorie (thermochemical) per second centimetre kelvin - 418,4 W/(m x K)"
         ),
         "British_thermal_unit_(international_table)_foot_per_hour square_foot_degree_Fahrenheit": makeEUInformation(
            "J40",
            "BtuIT·ft/(h·ft²·°F)",
            "British thermal unit (international table) foot per hour square foot degree Fahrenheit - 1,730 735 W/(m x K)"
         ),
         "British_thermal_unit_(international_table)_inch_per_hour_square foot_degree_Fahrenheit": makeEUInformation(
            "J41",
            "BtuIT·in/(h·ft²·°F)",
            "British thermal unit (international table) inch per hour square foot degree Fahrenheit - 0,144 227 9 W/(m x K)"
         ),
         "British_thermal_unit_(international_table)_inch_per_second_square foot_degree_Fahrenheit": makeEUInformation(
            "J42",
            "BtuIT·in/(s·ft²·°F)",
            "British thermal unit (international table) inch per second square foot degree Fahrenheit - 5,192 204 x 10² W/(m x K)"
         ),
         "British_thermal_unit_(thermochemical)_foot_per_hour_square foot_degree_Fahrenheit": makeEUInformation(
            "J46",
            "Btuth·ft/(h·ft²·°F)",
            "British thermal unit (thermochemical) foot per hour square foot degree Fahrenheit - 1,729 577 W/(m x K)"
         ),
         "British_thermal_unit_(thermochemical)_inch_per_hour_square foot_degree_Fahrenheit": makeEUInformation(
            "J48",
            "Btuth·in/(h·ft²·°F)",
            "British thermal unit (thermochemical) inch per hour square foot degree Fahrenheit - 0,144 131 4 W/(m x K)"
         ),
         "British_thermal_unit_(thermochemical)_inch_per_second square_foot_degree_Fahrenheit": makeEUInformation(
            "J49",
            "Btuth·in/(s·ft²·°F)",
            "British thermal unit (thermochemical) inch per second square foot degree Fahrenheit - 5,188 732 x 10² W/(m x K)"
         ),
         "calorie_(thermochemical)_per_centimetre_second_degree_Celsius": makeEUInformation(
            "J78",
            "calth/(cm·s·°C)",
            "calorie (thermochemical) per centimetre second degree Celsius - 4,184 x 10² W/(m x K)"
         ),
         "kilocalorie_(international_table)_per_hour_metre_degree_Celsius": makeEUInformation(
            "K52",
            "kcal/(m·h·°C)",
            "kilocalorie (international table) per hour metre degree Celsius - 1,163 J/(m x s x K)"
         )
      },
      /**
       * coefficient of heat transfer
       */
      "coefficient of heat transfer": {
         watt_per_square_metre_kelvin: makeEUInformation("D55", "W/(m²·K)", "watt per square metre kelvin - W/(m² x K)")
      },
      /**
       * surface coefficient of heat transfer
       */
      "surface coefficient of heat transfer": {
         kilowatt_per_square_metre_kelvin: makeEUInformation(
            "N78",
            "kW/(m²·K)",
            "kilowatt per square metre kelvin - 1000-fold of the derived SI unit watt divided by the product of the power of the SI base unit metre by exponent 2 and the SI base unit kelvin. 10³ W/(m² x K)"
         ),
         "calorie_(international_table)_per_second_square_centimetre_kelvin": makeEUInformation(
            "D72",
            "calIT/(s·cm²·K)",
            "calorie (international table) per second square centimetre kelvin - 4,186 8 x 10⁴ W/(m² x K)"
         ),
         "calorie_(thermochemical)_per_second_square_centimetre_kelvin": makeEUInformation(
            "D39",
            "calth/(s·cm²·K)",
            "calorie (thermochemical) per second square centimetre kelvin - 4,184 x10⁴ W/(m² x K)"
         ),
         "British_thermal_unit_(international_table)_per_second_square_foot_degree_Rankine": makeEUInformation(
            "A20",
            "BtuIT/(s·ft²·°R)",
            "British thermal unit (international table) per second square foot degree Rankine - 20 441,7 W/(m² x K)"
         ),
         "British_thermal_unit_(international_table)_per_hour_square_foot_degree_Rankine": makeEUInformation(
            "A23",
            "BtuIT/(h·ft²·°R)",
            "British thermal unit (international table) per hour square foot degree Rankine - 5,678 26 W/ (m² x K)"
         ),
         "British_thermal_unit_(international_table)_per_hour_square_foot_degree_Fahrenheit": makeEUInformation(
            "N74",
            "BtuIT/(h·ft²·ºF)",
            "British thermal unit (international table) per hour square foot degree Fahrenheit - Unit of the heat transition coefficient according to the Imperial system of units. 5,678 263 W/(m² x K)"
         ),
         "British_thermal_unit_(thermochemical)_per_hour_square_foot_degree_Fahrenheit": makeEUInformation(
            "N75",
            "Btuth/(h·ft²·ºF)",
            "British thermal unit (thermochemical) per hour square foot degree Fahrenheit - Unit of the heat transition coefficient according to the imperial system of units. 5,674 466 W/(m² x K)"
         ),
         "British_thermal_unit_(international_table)_per_second_square_foot_degree_Fahrenheit": makeEUInformation(
            "N76",
            "BtuIT/(s·ft²·ºF)",
            "British thermal unit (international table) per second square foot degree Fahrenheit - Unit of the heat transition coefficient according to the imperial system of units. 2,044 175 x 10⁴ W/(m² x K)"
         ),
         "British_thermal_unit_(thermochemical)_per_second_square_foot_degree_Fahrenheit": makeEUInformation(
            "N77",
            "Btuth/(s·ft²·ºF) ",
            "British thermal unit (thermochemical) per second square foot degree Fahrenheit - Unit of the heat transition coefficient according to the imperial system of units. 2,042 808 x 10⁴ W/(m² x K)"
         )
      },
      /**
       * thermal insulance, coefficient of thermal insulation
       */
      "thermal insulance, coefficient of thermal insulation": {
         square_metre_kelvin_per_watt: makeEUInformation("D19", "m²·K/W", "square metre kelvin per watt - m² x K/W"),
         "degree_Fahrenheit_hour_square_foot_per_British_thermal_unit_(thermochemical)": makeEUInformation(
            "J19",
            "°F·h·ft²/Btuth",
            "degree Fahrenheit hour square foot per British thermal unit (thermochemical) - 0,176 228 m² x K/W"
         ),
         "degree_Fahrenheit_hour_square_foot_per_British_thermal_unit_(international_table)": makeEUInformation(
            "J22",
            "°F·h·ft²/BtuIT",
            "degree Fahrenheit hour square foot per British thermal unit (international table) - 0,176 110 2 m² x K/W"
         ),
         clo: makeEUInformation("J83", "clo", "clo - 0,155 m² x K/W"),
         "square_metre_hour_degree_Celsius_per_kilocalorie_(international_table)": makeEUInformation(
            "L14",
            "m²·h·°C/kcal",
            "square metre hour degree Celsius per kilocalorie (international table) - 0,859 845 2 m² x s x K/J"
         )
      },
      /**
       * thermal resistance
       */
      "thermal resistance": {
         kelvin_per_watt: makeEUInformation("B21", "K/W", "kelvin per watt - K/W"),
         kelvin_metre_per_watt: makeEUInformation("H35", "K·m/W", "kelvin metre per watt - K x m⁻¹ x kg⁻¹ x s³"),
         "degree_Fahrenheit_hour_per_British_thermal_unit_(international_table)": makeEUInformation(
            "N84",
            "ºF/(BtuIT/h)",
            "degree Fahrenheit hour per British thermal unit (international table) - Non SI-conforming unit of the thermal resistance according to the Imperial system of units. 1,895 634 K/W"
         ),
         "degree_Fahrenheit_hour_per_British_thermal_unit_(thermochemical)": makeEUInformation(
            "N85",
            "ºF/(Btuth/h)",
            "degree Fahrenheit hour per British thermal unit (thermochemical) - Non SI-conforming unit of the thermal resistance according to the Imperial system of units. 1,896 903 K/W"
         ),
         "degree_Fahrenheit_second_per_British_thermal_unit_(international_table)": makeEUInformation(
            "N86",
            "ºF/(BtuIT/s)",
            "degree Fahrenheit second per British thermal unit (international table) - Non SI-conforming unit of the thermal resistance according to the Imperial system of units. 5,265 651 x 10⁻⁴ K/W"
         ),
         "degree_Fahrenheit_second_per_British_thermal_unit_(thermochemical)": makeEUInformation(
            "N87",
            "ºF/(Btuth/s)",
            "degree Fahrenheit second per British thermal unit (thermochemical) - Non SI-conforming unit of the thermal resistance according to the Imperial system of units. 5,269 175 x 10⁻⁴ K/W"
         ),
         "degree_Fahrenheit_hour_square_foot_per_British_thermal_unit_(international_table)_inch": makeEUInformation(
            "N88",
            "ºF·h·ft²/(BtuIT·in)",
            "degree Fahrenheit hour square foot per British thermal unit (international table) inch - Unit of specific thermal resistance according to the Imperial system of units. 6,933 472 K x m/W"
         ),
         "degree_Fahrenheit_hour_square_foot_per_British_thermal_unit_(thermochemical)_inch": makeEUInformation(
            "N89",
            "ºF·h·ft²/(Btuth·in)",
            "degree Fahrenheit hour square foot per British thermal unit (thermochemical) inch - Unit of specific thermal resistance according to the Imperial system of units. 6,938 112 K x m/W"
         )
      },
      /**
       * thermal conductance
       */
      "thermal conductance": {
         watt_per_kelvin: makeEUInformation("D52", "W/K", "watt per kelvin - W/K")
      },
      /**
       * thermal diffusivity
       */
      "thermal diffusivity": {
         square_metre_per_second: makeEUInformation(
            "S4",
            "m²/s",
            "square metre per second - Synonym: metre squared per second (square metres/second US) m²/s"
         ),
         square_foot_per_second: makeEUInformation(
            "S3",
            "ft²/s",
            "square foot per second - Synonym: foot squared per second 0,092 903 04 m²/s"
         ),
         millimetre_per_degree_Celcius_metre: makeEUInformation(
            "E97",
            "mm/(°C·m)",
            "millimetre per degree Celcius metre - 10⁻³ K⁻¹"
         ),
         millimetre_per_kelvin: makeEUInformation("F53", "mm/K", "millimetre per kelvin - 10⁻³ m x K⁻¹"),
         metre_per_degree_Celcius_metre: makeEUInformation(
            "N83",
            "m/(°C·m)",
            "metre per degree Celcius metre - SI base unit metre divided by the product of the unit degree Celsius and the SI base unit metre. K⁻¹"
         )
      },
      /**
       * heat capacity, entropy
       */
      "heat capacity, entropy": {
         joule_per_kelvin: makeEUInformation("JE", "J/K", "joule per kelvin - J/K"),
         kilojoule_per_kelvin: makeEUInformation("B41", "kJ/K", "kilojoule per kelvin - 10³ J/K"),
         "British_thermal_unit_(international_table)_per_pound_degree_Fahrenheit": makeEUInformation(
            "J43",
            "BtuIT/(lb·°F)",
            "British thermal unit (international table) per pound degree Fahrenheit - 4,186 8 x 10³ J/(kg x K)"
         ),
         "British_thermal_unit_(thermochemical)_per_pound_degree_Fahrenheit": makeEUInformation(
            "J50",
            "Btuth/(lb·°F)",
            "British thermal unit (thermochemical) per pound degree Fahrenheit - 4,184 x 10³ J/(kg x K)"
         ),
         "calorie_(international_table)_per_gram_degree_Celsius": makeEUInformation(
            "J76",
            "calIT/(g·°C)",
            "calorie (international table) per gram degree Celsius - 4,186 8 x 10³ J/(kg x K)"
         ),
         "calorie_(thermochemical)_per_gram_degree_Celsius": makeEUInformation(
            "J79",
            "calth/(g·°C)",
            "calorie (thermochemical) per gram degree Celsius - 4,184 x 10³ J/(kg x K)"
         ),
         "British_thermal_unit_(international_table)_per_degree_Fahrenheit": makeEUInformation(
            "N60",
            "BtuIT/ºF",
            "British thermal unit (international table) per degree Fahrenheit - Unit of the heat capacity according to the Imperial system of units. 1,899 101 x 10³ J/K"
         ),
         "British_thermal_unit_(thermochemical)_per_degree_Fahrenheit": makeEUInformation(
            "N61",
            "Btuth/ºF",
            "British thermal unit (thermochemical) per degree Fahrenheit - Unit of the heat capacity according to the Imperial system of units. 1,897 830 x 10³ J/K"
         ),
         "British_thermal_unit_(international_table)_per_degree_Rankine": makeEUInformation(
            "N62",
            "BtuIT/ºR",
            "British thermal unit (international table) per degree Rankine - Unit of the heat capacity according to the Imperial system of units. 1,899 101 x 10³ J/K"
         ),
         "British_thermal_unit_(thermochemical)_per_degree_Rankine": makeEUInformation(
            "N63",
            "Btuth/ºR",
            "British thermal unit (thermochemical) per degree Rankine - Unit of the heat capacity according to the Imperial system of units. 1,897 830 x 10³ J/K"
         ),
         "British_thermal_unit_(thermochemical)_per_pound_degree_Rankine": makeEUInformation(
            "N64",
            "(Btuth/°R)/lb",
            "British thermal unit (thermochemical) per pound degree Rankine - Unit of the heat capacity (British thermal unit according to the international table according to the Rankine degree) according to the Imperial system of units divided by the unit avoirdupois pound according to the avoirdupois system of units. 4,184 x 10³ J/(kg x K)"
         ),
         "kilocalorie_(international_table)_per_gram_kelvin": makeEUInformation(
            "N65",
            "(kcalIT/K)/g",
            "kilocalorie (international table) per gram kelvin - Unit of the mass-related heat capacity as quotient 1000-fold of the calorie (international table) divided by the product of the 0,001-fold of the SI base units kilogram and kelvin. 4,186 8 x 10⁶ J/(kg x K)"
         )
      },
      /**
       * specific heat capacity at: - constant pressure, -constant volume,- saturation
       */
      "specific heat capacity at: - constant pressure, -constant volume,- saturation": {
         joule_per_kilogram_kelvin: makeEUInformation("B11", "J/(kg·K)", "joule per kilogram kelvin - J/(kg x K)"),
         kilojoule_per_kilogram_kelvin: makeEUInformation("B43", "kJ/(kg·K)", "kilojoule per kilogram kelvin - 10³ J/(kg x K)"),
         "British_thermal_unit_(international_table)_per_pound_degree_Rankine": makeEUInformation(
            "A21",
            "Btu/IT(lb·°R)",
            "British thermal unit (international table) per pound degree Rankine - 4 186,8 J/(kg x K)"
         ),
         "calorie_(international_table)_per_gram_kelvin": makeEUInformation(
            "D76",
            "calIT/(g·K)",
            "calorie (international table) per gram kelvin - 4 186,8 J/(kg x K)"
         ),
         "calorie_(thermochemical)_per_gram_kelvin": makeEUInformation(
            "D37",
            "calth/(g·K)",
            "calorie (thermochemical) per gram kelvin - 4,184 x 10³ J/(kg x K)"
         )
      },
      /**
       * ratio of the specific heat capacities, ratio of the massic heat capacity, isentropic exponent
       */
      "ratio of the specific heat capacities, ratio of the massic heat capacity, isentropic exponent": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * massieu function, planck function
       */
      "massieu function, planck function": {
         joule_per_kelvin: makeEUInformation("JE", "J/K", "joule per kelvin - J/K")
      },
      /**
       * massic energy, specific energy
       */
      "massic energy, specific energy": {
         joule_per_kilogram: makeEUInformation("J2", "J/kg", "joule per kilogram - J/kg")
      },
      /**
       * massic thermodynamic energy
       */
      "massic thermodynamic energy": {
         joule_per_gram: makeEUInformation("D95", "J/g", "joule per gram - J/(10⁻³ x kg)"),
         kilojoule_per_gram: makeEUInformation("Q31", "kJ/g", "kilojoule per gram - 10⁶ J/kg")
      },
      /**
       * specific thermodynamic energy
       */
      "specific thermodynamic energy": {
         megajoule_per_kilogram: makeEUInformation("JK", "MJ/kg", "megajoule per kilogram - 10⁶ J/kg")
      },
      /**
       * massic enthalpy, specific enthalpy
       */
      "massic enthalpy, specific enthalpy": {
         kilojoule_per_kilogram: makeEUInformation("B42", "kJ/kg", "kilojoule per kilogram - 10³ J/kg")
      },
      /**
       * massic Helmholtz free energy
       */
      "massic Helmholtz free energy": {
         "British_thermal_unit_(international_table)_per_pound": makeEUInformation(
            "AZ",
            "BtuIT/lb",
            "British thermal unit (international table) per pound - 2 326 J/kg"
         )
      },
      /**
       * specific Helmholtz free energy
       */
      "specific Helmholtz free energy": {
         "calorie_(international_table)_per_gram": makeEUInformation(
            "D75",
            "calIT/g",
            "calorie (international table) per gram - 4 186,8 J/kg"
         )
      },
      /**
       * massic Helmholtz free energy,
       */
      "massic Helmholtz free energy,": {
         "British_thermal_unit_(thermochemical)_per_pound": makeEUInformation(
            "N73",
            "Btuth/lb",
            "British thermal unit (thermochemical) per pound - Unit of the heat energy according to the Imperial system of units divided the unit avoirdupois pound according to the avoirdupois system of units. 2,324 444 x 10³ J/kg"
         )
      },
      /**
       * specific Helmholtz function, massic Gibbs free energy, specific Gibbs free energy
       */
      "specific Helmholtz function, massic Gibbs free energy, specific Gibbs free energy": {
         "calorie_(thermochemical)_per_gram": makeEUInformation(
            "B36",
            "calth/g",
            "calorie (thermochemical) per gram - 4 184 J/kg"
         )
      },
      /**
       * energy density
       */
      "energy density": {
         "British_thermal_unit_(international_table)_per_cubic_foot_": makeEUInformation(
            "N58",
            "BtuIT/ft³",
            "British thermal unit (international table) per cubic foot  - Unit of the energy density according to the Imperial system of units. 3,725 895 x10⁴ J/m³"
         ),
         "British_thermal_unit_(thermochemical)_per_cubic_foot": makeEUInformation(
            "N59",
            "Btuth/ft³",
            "British thermal unit (thermochemical) per cubic foot - Unit of the energy density according to the Imperial system of units. 3,723 403 x10⁴ J/m³"
         )
      }
   },
   /**
    * Electricity and Magnetism
    */
   "Electricity and Magnetism": {
      /**
       * electric current, magnetic potential difference, magnetomotive force,current linkage
       */
      "electric current, magnetic potential difference, magnetomotive force,current linkage": {
         ampere: makeEUInformation("AMP", "A", "ampere - A"),
         kiloampere: makeEUInformation("B22", "kA", "kiloampere - 10³ A"),
         megaampere: makeEUInformation("H38", "MA", "megaampere - 10⁶ A"),
         milliampere: makeEUInformation("4K", "mA", "milliampere - 10⁻³ A"),
         microampere: makeEUInformation("B84", "µA", "microampere - 10⁻⁶ A"),
         nanoampere: makeEUInformation("C39", "nA", "nanoampere - 10⁻⁹ A"),
         picoampere: makeEUInformation("C70", "pA", "picoampere - 10⁻¹² A"),
         biot: makeEUInformation(
            "N96",
            "Bi",
            "biot - CGS (Centimetre-Gram-Second system) unit of the electric power which is defined by a force of 2 dyn per cm between two parallel conductors of infinite length with negligible cross-section in the distance of 1 cm. 10¹ A"
         ),
         gilbert: makeEUInformation(
            "N97",
            "Gi",
            "gilbert - CGS (Centimetre-Gram-Second system) unit of the magnetomotive force, which is defined by the work to increase the magnetic potential of a positive common pol with 1 erg. 7,957 747 x 10⁻¹ A"
         )
      },
      /**
       * electric charge, quantity of electricity, electric flux (flux of displacement)
       */
      "electric charge, quantity of electricity, electric flux (flux of displacement)": {
         coulomb: makeEUInformation("COU", "C", "coulomb - A x s"),
         ampere_second: makeEUInformation("A8", "A·s", "ampere second - C"),
         ampere_squared_second: makeEUInformation("H32", "A²·s", "ampere squared second - A² x s"),
         ampere_hour: makeEUInformation(
            "AMH",
            "A·h",
            "ampere hour - A unit of electric charge defining the amount of charge accumulated by a steady flow of one ampere for one hour. 3,6 x 10³ C"
         ),
         "kiloampere_hour_(thousand_ampere_hour)": makeEUInformation(
            "TAH",
            "kA·h",
            "kiloampere hour (thousand ampere hour) - 3,6 x 10⁶ C"
         ),
         megacoulomb: makeEUInformation("D77", "MC", "megacoulomb - 10⁶ C"),
         millicoulomb: makeEUInformation("D86", "mC", "millicoulomb - 10⁻³ C"),
         kilocoulomb: makeEUInformation("B26", "kC", "kilocoulomb - 10³ C"),
         microcoulomb: makeEUInformation("B86", "µC", "microcoulomb - 10⁻⁶ C"),
         nanocoulomb: makeEUInformation("C40", "nC", "nanocoulomb - 10⁻⁹ C"),
         picocoulomb: makeEUInformation("C71", "pC", "picocoulomb - 10⁻¹² C"),
         milliampere_hour: makeEUInformation(
            "E09",
            "mA·h",
            "milliampere hour - A unit of power load delivered at the rate of one thousandth of an ampere over a period of one hour. 3,6 C"
         ),
         ampere_minute: makeEUInformation(
            "N95",
            "A·min",
            "ampere minute - A unit of electric charge defining the amount of charge accumulated by a steady flow of one ampere for one minute.. 60 C"
         ),
         franklin: makeEUInformation(
            "N94",
            "Fr",
            "franklin - CGS (Centimetre-Gram-Second system) unit of the electrical charge, where the charge amounts to exactly 1 Fr where the force of 1 dyn on an equal load is performed at a distance of 1 cm. 3,335 641 x 10⁻¹⁰ C"
         )
      },
      /**
       * volume density of charge, charge density, volumic charge
       */
      "volume density of charge, charge density, volumic charge": {
         coulomb_per_cubic_metre: makeEUInformation("A29", "C/m³", "coulomb per cubic metre - C/m³"),
         gigacoulomb_per_cubic_metre: makeEUInformation("A84", "GC/m³", "gigacoulomb per cubic metre - 10⁹ C/m³"),
         coulomb_per_cubic_millimetre: makeEUInformation("A30", "C/mm³", "coulomb per cubic millimetre - 10⁹ C/m³"),
         megacoulomb_per_cubic_metre: makeEUInformation("B69", "MC/m³", "megacoulomb per cubic metre - 10⁶ C/m³"),
         coulomb_per_cubic_centimetre: makeEUInformation("A28", "C/cm³", "coulomb per cubic centimetre - 10⁶ C/m³"),
         kilocoulomb_per_cubic_metre: makeEUInformation("B27", "kC/m³", "kilocoulomb per cubic metre - 10³ C/m³"),
         millicoulomb_per_cubic_metre: makeEUInformation("D88", "mC/m³", "millicoulomb per cubic metre - 10⁻³ C/m³"),
         microcoulomb_per_cubic_metre: makeEUInformation("B87", "µC/m³", "microcoulomb per cubic metre - 10⁻⁶ C/m³")
      },
      /**
       * surface density of charge, electric flux density, displacement electric polarization
       */
      "surface density of charge, electric flux density, displacement electric polarization": {
         coulomb_per_square_metre: makeEUInformation("A34", "C/m²", "coulomb per square metre - C/m²"),
         megacoulomb_per_square_metre: makeEUInformation("B70", "MC/m²", "megacoulomb per square metre - 10⁶ C/m²"),
         coulomb_per_square_millimetre: makeEUInformation("A35", "C/mm²", "coulomb per square millimetre - 10⁶ C/m²"),
         coulomb_per_square_centimetre: makeEUInformation("A33", "C/cm²", "coulomb per square centimetre - 10⁴ C/m²"),
         kilocoulomb_per_square_metre: makeEUInformation("B28", "kC/m²", "kilocoulomb per square metre - 10³ C/m²"),
         millicoulomb_per_square_metre: makeEUInformation("D89", "mC/m²", "millicoulomb per square metre - 10⁻³ C/m²"),
         microcoulomb_per_square_metre: makeEUInformation("B88", "µC/m²", "microcoulomb per square metre - 10⁻⁶ C/m²")
      },
      /**
       * electric field strength
       */
      "electric field strength": {
         volt_per_metre: makeEUInformation("D50", "V/m", "volt per metre - V/m"),
         volt_second_per_metre: makeEUInformation("H45", "V·s/m", "volt second per metre - m x kg x s⁻² x A⁻¹"),
         volt_squared_per_kelvin_squared: makeEUInformation("D45", "V²/K²", "volt squared per kelvin squared - V²/K²"),
         volt_per_millimetre: makeEUInformation("D51", "V/mm", "volt per millimetre - 10³ V/m"),
         volt_per_microsecond: makeEUInformation("H24", "V/µs", "volt per microsecond - 10⁶ V/s"),
         millivolt_per_minute: makeEUInformation(
            "H62",
            "mV/min",
            "millivolt per minute - 1,666 666 667 × 10⁻⁵ m² x kg x s⁻⁴ x A⁻¹"
         ),
         volt_per_second: makeEUInformation("H46", "V/s", "volt per second - m² x kg x s⁻⁴ x A⁻¹"),
         megavolt_per_metre: makeEUInformation("B79", "MV/m", "megavolt per metre - 10⁶ V/m"),
         kilovolt_per_metre: makeEUInformation("B55", "kV/m", "kilovolt per metre - 10³ V/m"),
         volt_per_centimetre: makeEUInformation("D47", "V/cm", "volt per centimetre - 10² m⁻¹ x V"),
         millivolt_per_metre: makeEUInformation("C30", "mV/m", "millivolt per metre - 10⁻³ V/m"),
         microvolt_per_metre: makeEUInformation("C3", "µV/m", "microvolt per metre - 10⁻⁶ V/m"),
         volt_per_bar: makeEUInformation("G60", "V/bar", "volt per bar - 10⁻⁵ m³ x s⁻¹ x A⁻¹"),
         volt_per_pascal: makeEUInformation(
            "N98",
            "V/Pa",
            "volt per pascal - Derived SI unit volt divided by the derived SI unit pascal. m³ x s⁻¹ x A⁻¹"
         ),
         volt_per_litre_minute: makeEUInformation(
            "F87",
            "V/(l·min)",
            "volt per litre minute - 1,666 67 × 10¹ kg x m⁻¹ x s⁻⁴ x A⁻¹"
         ),
         "volt_square_inch_per_pound-force": makeEUInformation(
            "H22",
            "V/(lbf/in²)",
            "volt square inch per pound-force - 1,450 377 439 8 × 10⁻⁴ m³ x s⁻¹ x A⁻¹"
         ),
         volt_per_inch: makeEUInformation("H23", "V/in", "volt per inch - 3,937 007 874 × 10¹ m x kg x s⁻³ x A⁻¹")
      },
      /**
       * electric potential, potential difference, tension, voltage, electromotive force
       */
      "electric potential, potential difference, tension, voltage, electromotive force": {
         volt: makeEUInformation("VLT", "V", "volt - V"),
         megavolt: makeEUInformation("B78", "MV", "megavolt - 10⁶ V"),
         kilovolt: makeEUInformation("KVT", "kV", "kilovolt - 10³ V"),
         millivolt: makeEUInformation("2Z", "mV", "millivolt - 10⁻³ V"),
         microvolt: makeEUInformation("D82", "µV", "microvolt - 10⁻⁶ V"),
         picovolt: makeEUInformation("N99", "pV", "picovolt - 0,000 000 000 001-fold of the derived SI unit volt. 10⁻¹² V")
      },
      /**
       * capacitance
       */
      capacitance: {
         farad: makeEUInformation("FAR", "F", "farad - F"),
         attofarad: makeEUInformation("H48", "aF", "attofarad - 10⁻¹⁸ m⁻² x kg⁻¹ x s⁴ x A²"),
         millifarad: makeEUInformation("C10", "mF", "millifarad - 10⁻³ F"),
         microfarad: makeEUInformation("4O", "µF", "microfarad - 10⁻⁶ F"),
         nanofarad: makeEUInformation("C41", "nF", "nanofarad - 10⁻⁹ F"),
         picofarad: makeEUInformation("4T", "pF", "picofarad - 10⁻¹² F"),
         kilofarad: makeEUInformation("N90", "kF", "kilofarad - 1000-fold of the derived SI unit farad. 10³ F")
      },
      /**
       * permittivity, permittivity of vacuum, (electric constant)
       */
      "permittivity, permittivity of vacuum, (electric constant)": {
         farad_per_metre: makeEUInformation("A69", "F/m", "farad per metre - kg⁻¹ x m⁻³ x s⁴ x A²"),
         microfarad_per_kilometre: makeEUInformation("H28", "µF/km", "microfarad per kilometre - 10⁻⁹ F/m"),
         farad_per_kilometre: makeEUInformation("H33", "F/km", "farad per kilometre - 10⁻³ F/m"),
         microfarad_per_metre: makeEUInformation("B89", "µF/m", "microfarad per metre - 10⁻⁶ F/m"),
         nanofarad_per_metre: makeEUInformation("C42", "nF/m", "nanofarad per metre - 10⁻⁹ F/m"),
         picofarad_per_metre: makeEUInformation("C72", "pF/m", "picofarad per metre - 10⁻¹² F/m")
      },
      /**
       * relative permittivity
       */
      "relative permittivity": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * electric susceptibility
       */
      "electric susceptibility": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * electric dipole moment
       */
      "electric dipole moment": {
         coulomb_metre: makeEUInformation("A26", "C·m", "coulomb metre - A x s x m")
      },
      /**
       * current density
       */
      "current density": {
         ampere_per_square_metre: makeEUInformation("A41", "A/m²", "ampere per square metre - A/m²"),
         ampere_per_kilogram: makeEUInformation("H31", "A/kg", "ampere per kilogram - A x kg⁻¹"),
         megaampere_per_square_metre: makeEUInformation("B66", "MA/m²", "megaampere per square metre - 10⁶ A/m²"),
         ampere_per_square_millimetre: makeEUInformation("A7", "A/mm²", "ampere per square millimetre - 10⁶ A/m²"),
         ampere_per_square_centimetre: makeEUInformation("A4", "A/cm²", "ampere per square centimetre - 10⁴ A/m²"),
         kiloampere_per_square_metre: makeEUInformation("B23", "kA/m²", "kiloampere per square metre - 10³ A/m²"),
         milliampere_per_litre_minute: makeEUInformation(
            "G59",
            "mA/(l·min)",
            "milliampere per litre minute - 1,666 67 × 10⁻² m⁻³ x s⁻¹ x A"
         ),
         ampere_per_pascal: makeEUInformation(
            "N93",
            "A/Pa",
            "ampere per pascal - SI base unit ampere divided by the derived SI unit pascal. kg⁻¹ x m x s² x A"
         ),
         "milliampere_per_pound-force_per_square_inch": makeEUInformation(
            "F57",
            "mA/(lbf/in²)",
            "milliampere per pound-force per square inch - 1,450 38 × 10⁻⁷ kg⁻¹ x m x s² x A"
         )
      },
      /**
       * linear electric current density, lineic electric current, magnetic field strength
       */
      "linear electric current density, lineic electric current, magnetic field strength": {
         milliampere_per_bar: makeEUInformation("F59", "mA/bar", "milliampere per bar - 10⁻⁸ kg⁻¹ x m x s² x A"),
         ampere_per_metre: makeEUInformation("AE", "A/m", "ampere per metre - A/m"),
         kiloampere_per_metre: makeEUInformation("B24", "kA/m", "kiloampere per metre - 10³ A/m"),
         ampere_per_millimetre: makeEUInformation("A3", "A/mm", "ampere per millimetre - 10³ A/m"),
         ampere_per_centimetre: makeEUInformation("A2", "A/cm", "ampere per centimetre - 10² A/m"),
         milliampere_per_millimetre: makeEUInformation("F76", "mA/mm", "milliampere per millimetre - m⁻¹ x A"),
         milliampere_per_inch: makeEUInformation("F08", "mA/in", "milliampere per inch - 3,937 007 874 015 75 x 10⁻² A x m⁻¹")
      },
      /**
       * lineic charge
       */
      "lineic charge": {
         coulomb_per_metre: makeEUInformation(
            "P10",
            "C/m",
            "coulomb per metre - Derived SI unit coulomb divided by the SI base unit metre. m⁻¹ x s x A"
         )
      },
      /**
       * magnetic flux density, magnetic induction, magnetic polarization
       */
      "magnetic flux density, magnetic induction, magnetic polarization": {
         tesla: makeEUInformation("D33", "T", "tesla - T"),
         millitesla: makeEUInformation("C29", "mT", "millitesla - 10⁻³ T"),
         microtesla: makeEUInformation("D81", "µT", "microtesla - 10⁻⁶ T"),
         nanotesla: makeEUInformation("C48", "nT", "nanotesla - 10⁻⁹ T"),
         kilotesla: makeEUInformation("P13", "kT", "kilotesla - 1000-fold of the derived SI unit tesla. 10³ T"),
         gamma: makeEUInformation("P12", "γ", "gamma - Unit of magnetic flow density. 10⁻⁹ T")
      },
      /**
       * magnetic flux
       */
      "magnetic flux": {
         weber: makeEUInformation("WEB", "Wb", "weber - Wb"),
         milliweber: makeEUInformation("C33", "mWb", "milliweber - 10⁻³ Wb"),
         kiloweber: makeEUInformation("P11", "kWb", "kiloweber - 1000 fold of the derived SI unit weber. 10³ Wb")
      },
      /**
       * magnetic vector potential
       */
      "magnetic vector potential": {
         weber_per_metre: makeEUInformation("D59", "Wb/m", "weber per metre - Wb/m"),
         kiloweber_per_metre: makeEUInformation("B56", "kWb/m", "kiloweber per metre - 10³ Wb/m"),
         weber_per_millimetre: makeEUInformation("D60", "Wb/mm", "weber per millimetre - 10³ Wb/m")
      },
      /**
       * self inductance, mutual inductance, permeance
       */
      "self inductance, mutual inductance, permeance": {
         henry: makeEUInformation("81", "H", "henry - H"),
         millihenry: makeEUInformation("C14", "mH", "millihenry - 10⁻³ H"),
         microhenry: makeEUInformation("B90", "µH", "microhenry - 10⁻⁶ H"),
         nanohenry: makeEUInformation("C43", "nH", "nanohenry - 10⁻⁹ H"),
         picohenry: makeEUInformation("C73", "pH", "picohenry - 10⁻¹² H"),
         henry_per_kiloohm: makeEUInformation("H03", "H/kΩ", "henry per kiloohm - 10⁻³ s"),
         henry_per_ohm: makeEUInformation("H04", "H/Ω", "henry per ohm - s"),
         microhenry_per_kiloohm: makeEUInformation("G98", "µH/kΩ", "microhenry per kiloohm - 10⁻⁹ s"),
         microhenry_per_ohm: makeEUInformation("G99", "µH/Ω", "microhenry per ohm - 10⁻⁶ s"),
         millihenry_per_kiloohm: makeEUInformation("H05", "mH/kΩ", "millihenry per kiloohm - 10⁻⁶ s"),
         millihenry_per_ohm: makeEUInformation("H06", "mH/Ω", "millihenry per ohm - 10⁻³ s"),
         kilohenry: makeEUInformation("P24", "kH", "kilohenry - 1000-fold of the derived SI unit henry. 10³ H")
      },
      /**
       * coupling coefficient, leakage coefficient
       */
      "coupling coefficient, leakage coefficient": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * number of turns in a winding, number of phases, number of pairs of poles
       */
      "number of turns in a winding, number of phases, number of pairs of poles": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * permeability, permeability of vacuum, magnetic constant
       */
      "permeability, permeability of vacuum, magnetic constant": {
         henry_per_metre: makeEUInformation("A98", "H/m", "henry per metre - H/m"),
         microhenry_per_metre: makeEUInformation("B91", "µH/m", "microhenry per metre - 10⁻⁶ H/m"),
         nanohenry_per_metre: makeEUInformation("C44", "nH/m", "nanohenry per metre - 10⁻⁹ H/m")
      },
      /**
       * relative permeability
       */
      "relative permeability": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * magnetic susceptibility
       */
      "magnetic susceptibility": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * electromagnetic moment, magnetic moment, (magnetic area moment)
       */
      "electromagnetic moment, magnetic moment, (magnetic area moment)": {
         ampere_square_metre: makeEUInformation("A5", "A·m²", "ampere square metre - A x m²")
      },
      /**
       * magnetization
       */
      magnetization: {
         ampere_per_metre: makeEUInformation("AE", "A/m", "ampere per metre - A/m")
      },
      /**
       * electromagnetic energy density, volumic electromagnetic energy
       */
      "electromagnetic energy density, volumic electromagnetic energy": {
         joule_per_cubic_metre: makeEUInformation("B8", "J/m³", "joule per cubic metre - J/m³")
      },
      /**
       * Poynting vector
       */
      "Poynting vector": {
         watt_per_square_metre: makeEUInformation("D54", "W/m²", "watt per square metre - W/m²")
      },
      /**
  * phase velocity of electromagnetic
waves, phase speed of electromagnetic waves
  */
      "phase velocity of electromagnetic  waves, phase speed of electromagnetic waves": {
         metre_per_second: makeEUInformation("MTS", "m/s", "metre per second - m/s")
      },
      /**
       * resistance (to direct current), impedance, (complex impedances), modulus of impedance, resistance (to alternating current), reactance
       */
      "resistance (to direct current), impedance, (complex impedances), modulus of impedance, resistance (to alternating current), reactance":
      {
         ohm: makeEUInformation("OHM", "Ω", "ohm - Ω"),
         gigaohm: makeEUInformation("A87", "GΩ", "gigaohm - 10⁹ Ω"),
         megaohm: makeEUInformation("B75", "MΩ", "megaohm - 10⁶ Ω"),
         teraohm: makeEUInformation("H44", "TΩ", "teraohm - 10¹² Ω"),
         kiloohm: makeEUInformation("B49", "kΩ", "kiloohm - 10³ Ω"),
         milliohm: makeEUInformation("E45", "mΩ", "milliohm - 10⁻³ Ω"),
         microohm: makeEUInformation("B94", "µΩ", "microohm - 10⁻⁶ Ω"),
         nanoohm: makeEUInformation("P22", "nΩ", "nanoohm - 0,000 000 001-fold of the derived SI unit ohm. 10⁻⁹ Ω")
      },
      /**
       * resistance load per unit length
       */
      "resistance load per unit length ": {
         gigaohm_per_metre: makeEUInformation("M26", "GΩ/m", "gigaohm per metre - 10⁹ Ω/m")
      },
      /**
       * conductance (for direct current), admittance, (complex admittance), modulus of admittance,(admittance), conductance (for alternating current)
       */
      "conductance (for direct current), admittance, (complex admittance), modulus of admittance,(admittance), conductance (for alternating current)":
      {
         siemens: makeEUInformation("SIE", "S", "siemens - A/V"),
         kilosiemens: makeEUInformation("B53", "kS", "kilosiemens - 10³ S"),
         millisiemens: makeEUInformation("C27", "mS", "millisiemens - 10⁻³ S"),
         microsiemens: makeEUInformation("B99", "µS", "microsiemens - 10⁻⁶ S"),
         microsiemens_per_centimetre: makeEUInformation("G42", "µS/cm", "microsiemens per centimetre - 10⁻⁴ S/m"),
         microsiemens_per_metre: makeEUInformation("G43", "µS/m", "microsiemens per metre - 10⁻⁶ S/m"),
         picosiemens: makeEUInformation(
            "N92",
            "pS",
            "picosiemens - 0,000 000 000 001-fold of the derived SI unit siemens. 10⁻¹² S"
         )
      },
      /**
       * susceptance
       */
      susceptance: {
         mho: makeEUInformation("NQ", "", "mho - S"),
         micromho: makeEUInformation("NR", "", "micromho - 10⁻⁶ S")
      },
      /**
       * resistivity
       */
      resistivity: {
         ohm_metre: makeEUInformation("C61", "Ω·m", "ohm metre - Ω x m"),
         gigaohm_metre: makeEUInformation("A88", "GΩ·m", "gigaohm metre - 10⁹ Ω x m"),
         megaohm_metre: makeEUInformation("B76", "MΩ·m", "megaohm metre - 10⁶ Ω x m"),
         megaohm_kilometre: makeEUInformation("H88", "MΩ·km", "megaohm kilometre - 10⁹ Ω x m"),
         kiloohm_metre: makeEUInformation("B50", "kΩ·m", "kiloohm metre - 10³ Ω x m"),
         ohm_centimetre: makeEUInformation("C60", "Ω·cm", "ohm centimetre - 10⁻² Ω x m "),
         milliohm_metre: makeEUInformation("C23", "mΩ·m", "milliohm metre - 10⁻³ Ω x m"),
         microohm_metre: makeEUInformation("B95", "µΩ·m", "microohm metre - 10⁻⁶ Ω x m"),
         nanoohm_metre: makeEUInformation("C46", "nΩ·m", "nanoohm metre - 10⁻⁹ Ω·x m"),
         ohm_kilometre: makeEUInformation("M24", "Ω·km", "ohm kilometre - 10³ Ω x m"),
         "ohm_circular-mil_per_foot_": makeEUInformation(
            "P23",
            "Ω·cmil/ft ",
            "ohm circular-mil per foot  - Unit of resistivity. 1,662 426 x 10⁻⁹ Ω x m"
         )
      },
      /**
       * lineic resistance
       */
      "lineic resistance": {
         ohm_per_kilometre: makeEUInformation("F56", "Ω/km", "ohm per kilometre - 10⁻³ Ω/m"),
         ohm_per_metre: makeEUInformation("H26", "Ω/m", "ohm per metre - Ω/m"),
         megaohm_per_metre: makeEUInformation("H37", "MΩ/m", "megaohm per metre - 10⁶ Ω/m"),
         milliohm_per_metre: makeEUInformation("F54", "mΩ/m", "milliohm per metre - 10⁻³ Ω/m"),
         megaohm_per_kilometre: makeEUInformation("H36", "MΩ/km", "megaohm per kilometre - 10³ Ω/m"),
         "ohm_per_mile_(statute_mile)": makeEUInformation("F55", "Ω/mi", "ohm per mile (statute mile) - 6,213 71 × 10⁻⁴  Ω/m")
      },
      /**
       * conductivity
       */
      conductivity: {
         siemens_per_metre: makeEUInformation("D10", "S/m", "siemens per metre - S/m"),
         siemens_per_centimetre: makeEUInformation("H43", "S/cm", "siemens per centimetre - 10² S/m"),
         millisiemens_per_centimetre: makeEUInformation("H61", "mS/cm", "millisiemens per centimetre - 10⁻¹ S/m"),
         megasiemens_per_metre: makeEUInformation("B77", "MS/m", "megasiemens per metre - 10⁶ S/m"),
         kilosiemens_per_metre: makeEUInformation("B54", "kS/m", "kilosiemens per metre - 10³ S/m"),
         nanosiemens_per_metre: makeEUInformation("G45", "nS/m", "nanosiemens per metre - 10⁻⁹ S/m"),
         nanosiemens_per_centimetre: makeEUInformation("G44", "nS/cm", "nanosiemens per centimetre - 10⁻⁷ S/m"),
         picosiemens_per_metre: makeEUInformation("L42", "pS/m", "picosiemens per metre - 10⁻¹² S/m")
      },
      /**
       * reluctance
       */
      reluctance: {
         reciprocal_henry: makeEUInformation("C89", "H⁻¹", "reciprocal henry - H⁻¹")
      },
      /**
       * phase difference, phase displacement, loss angle
       */
      "phase difference, phase displacement, loss angle": {
         radian: makeEUInformation("C81", "rad", "radian - rad")
      },
      /**
       * power (for direct current), active power
       */
      "power (for direct current), active power": {
         watt: makeEUInformation("WTT", "W", "watt - W"),
         joule_per_second: makeEUInformation(
            "P14",
            "J/s",
            "joule per second - Quotient of the derived SI unit joule divided by the SI base unit second. W"
         ),
         kilowatt: makeEUInformation("KWT", "kW", "kilowatt - 10³ W"),
         megawatt: makeEUInformation(
            "MAW",
            "MW",
            "megawatt - A unit of power defining the rate of energy transferred or consumed when a current of 1000 amperes flows due to a potential of 1000 volts at unity power factor. 10⁶ W"
         ),
         gigawatt: makeEUInformation("A90", "GW", "gigawatt - 10⁹ W"),
         terawatt: makeEUInformation("D31", "TW", "terawatt - 10¹² W"),
         milliwatt: makeEUInformation("C31", "mW", "milliwatt - 10⁻³ W"),
         joule_per_minute: makeEUInformation(
            "P15",
            "J/min",
            "joule per minute - Quotient from the derived SI unit joule divided by the unit minute. 1,666 67 × 10⁻² W"
         ),
         joule_per_hour: makeEUInformation(
            "P16",
            "J/h",
            "joule per hour - Quotient from the derived SI unit joule divided by the unit hour. 2,777 78 × 10⁻⁴ W"
         ),
         joule_per_day: makeEUInformation(
            "P17",
            "J/d",
            "joule per day - Quotient from the derived SI unit joule divided by the unit day. 1,157 41 × 10⁻⁵ W"
         ),
         kilojoule_per_second: makeEUInformation(
            "P18",
            "kJ/s",
            "kilojoule per second - Quotient from the 1000-fold of the derived SI unit joule divided by the SI base unit second. 10³ W"
         ),
         kilojoule_per_minute: makeEUInformation(
            "P19",
            "kJ/min",
            "kilojoule per minute - Quotient from the 1000-fold of the derived SI unit joule divided by the unit minute. 1,666 67 × 10 W"
         ),
         kilojoule_per_hour: makeEUInformation(
            "P20",
            "kJ/h",
            "kilojoule per hour - Quotient from the 1000-fold of the derived SI unit joule divided by the unit hour. 2,777 78 x 10⁻¹ W"
         ),
         kilojoule_per_day: makeEUInformation(
            "P21",
            "kJ/d",
            "kilojoule per day - Quotient from the 1000-fold of the derived SI unit joule divided by the unit day. 1,157 41 x 10⁻² W"
         ),
         microwatt: makeEUInformation("D80", "µW", "microwatt - 10⁻⁶ W"),
         "horsepower_(electric)": makeEUInformation("K43", "electric hp", "horsepower (electric) - 746 W"),
         nanowatt: makeEUInformation("C49", "nW", "nanowatt - 10⁻⁹ W"),
         picowatt: makeEUInformation("C75", "pW", "picowatt - 10⁻¹² W")
      },
      /**
       * apparent power
       */
      "apparent power": {
         "volt_-_ampere": makeEUInformation("D46", "V·A", "volt - ampere - W"),
         "megavolt_-_ampere": makeEUInformation("MVA", "MV·A", "megavolt - ampere - 10⁶ V x A"),
         "kilovolt_-_ampere": makeEUInformation("KVA", "kV·A", "kilovolt - ampere - 10³ V x A"),
         "millivolt_-_ampere": makeEUInformation("M35", "mV·A", "millivolt - ampere - 10⁻³ V x A")
      },
      /**
       * reactive power
       */
      "reactive power": {
         var: makeEUInformation("D44", "var", "var - The name of the unit is an acronym for volt-ampere-reactive. V x A"),
         "kilovolt_ampere_(reactive)": makeEUInformation(
            "K5",
            "kvar",
            "kilovolt ampere (reactive) - Use kilovar (common code KVR) 10³ V x A"
         ),
         kilovar: makeEUInformation("KVR", "kvar", "kilovar - 10³ V x A"),
         megavar: makeEUInformation(
            "MAR",
            "kvar",
            "megavar - A unit of electrical reactive power represented by a current of one thousand amperes flowing due a potential difference of one thousand volts where the sine of the phase angle between them is 1. 10³ V x A"
         )
      },
      /**
       * active energy
       */
      "active energy": {
         joule: makeEUInformation("JOU", "J", "joule - J"),
         watt_hour: makeEUInformation("WHR", "W·h", "watt hour - 3,6 x 10³ J")
      },
      /**
       * coefficient, performance characteristic
       */
      "coefficient, performance characteristic": {
         reciprocal_joule: makeEUInformation("N91", "1/J", "reciprocal joule - Reciprocal of the derived SI unit joule. 1/J"),
         "reciprocal_volt_-_ampere_reciprocal_second": makeEUInformation(
            "M30",
            "1/(V·A·s)",
            "reciprocal volt - ampere reciprocal second - (V x A x s)⁻¹"
         ),
         kilohertz_metre: makeEUInformation("M17", "kHz·m", "kilohertz metre - 10³ Hz x m"),
         gigahertz_metre: makeEUInformation("M18", "GHz·m", "gigahertz metre - 10⁹ Hz x m"),
         megahertz_metre: makeEUInformation("M27", "MHz·m", "megahertz metre - 10⁶ Hz x m"),
         "reciprocal_kilovolt_-_ampere_reciprocal_hour": makeEUInformation(
            "M21",
            "1/kVAh",
            "reciprocal kilovolt - ampere reciprocal hour - 2,777 778 x 10⁻⁷ (V x A x s)⁻¹"
         ),
         hertz_metre: makeEUInformation("H34", "Hz·m", "hertz metre - Hz x m"),
         megahertz_kilometre: makeEUInformation("H39", "MHz·km", "megahertz kilometre - 10⁹ Hz x m")
      }
   },
   /**
    * Light and Related Electromagnetic Radiations
    */
   "Light and Related Electromagnetic Radiations": {
      /**
       * frequency
       */
      frequency: {
         hertz: makeEUInformation("HTZ", "Hz", "hertz - Hz")
      },
      /**
       * circular frequency
       */
      "circular frequency": {
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹"),
         radian_per_second: makeEUInformation("2A", "rad/s", "radian per second - Refer ISO/TC12 SI Guide rad/s")
      },
      /**
       * wavelength
       */
      wavelength: {
         metre: makeEUInformation("MTR", "m", "metre - m"),
         angstrom: makeEUInformation("A11", "Å", "angstrom - 10⁻¹⁰ m")
      },
      /**
       * wavenumber, repetency
       */
      "wavenumber, repetency": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * angular wave number, angular repetency
       */
      "angular wave number, angular repetency": {
         radian_per_metre: makeEUInformation("C84", "rad/m", "radian per metre - rad/m")
      },
      /**
       * velocity (speed) on propagation of electromagnetic waves in vacuo
       */
      "velocity (speed) on propagation of electromagnetic waves in vacuo": {
         metre_per_second: makeEUInformation("MTS", "m/s", "metre per second - m/s")
      },
      /**
       * radiant energy
       */
      "radiant energy": {
         joule: makeEUInformation("JOU", "J", "joule - J")
      },
      /**
       * radiant energy density
       */
      "radiant energy density": {
         joule_per_cubic_metre: makeEUInformation("B8", "J/m³", "joule per cubic metre - J/m³"),
         megajoule_per_cubic_metre: makeEUInformation("JM", "MJ/m³", "megajoule per cubic metre - 10⁶ J/m³")
      },
      /**
       * spectral concentration of radiant energy density (in terms of wavelength),spectral radiant energy density (in terms of wave length)
       */
      "spectral concentration of radiant energy density (in terms of wavelength),spectral radiant energy density (in terms of wave length)":
      {
         joule_per_metre_to_the_fourth_power: makeEUInformation("B14", "J/m⁴", "joule per metre to the fourth power - J/m⁴")
      },
      /**
       * radiant power, (radiant energyflux)
       */
      "radiant power, (radiant energyflux)": {
         watt: makeEUInformation("WTT", "W", "watt - W")
      },
      /**
       * radiant energy fluence, radiance exposure
       */
      "radiant energy fluence, radiance exposure": {
         joule_per_square_metre: makeEUInformation(
            "B13",
            "J/m²",
            "joule per square metre - Synonym: joule per metre squared J/m²"
         ),
         joule_per_square_centimetre: makeEUInformation(
            "E43",
            "J/cm²",
            "joule per square centimetre - A unit of energy defining the number of joules per square centimetre. 10⁴ J/m²"
         ),
         "British_thermal_unit_(international_table)_per_square_foot": makeEUInformation(
            "P37",
            "BtuIT/ft²",
            "British thermal unit (international table) per square foot - Unit of the areal-related energy transmission according to the Imperial system of units. 1,135 653 x 10⁴ J/m²"
         ),
         "British_thermal_unit_(thermochemical)_per_square_foot": makeEUInformation(
            "P38",
            "Btuth/ft²",
            "British thermal unit (thermochemical) per square foot - Unit of the areal-related energy transmission according to the Imperial system of units. 1,134 893 x 10⁴ J/m²"
         ),
         "calorie_(thermochemical)_per_square_centimetre_": makeEUInformation(
            "P39",
            "calth/cm²",
            "calorie (thermochemical) per square centimetre  - Unit of the areal-related energy transmission according to the Imperial system of units. 4,184 x 10⁴ J/m²"
         ),
         langley: makeEUInformation(
            "P40",
            "Ly",
            "langley - CGS (Centimetre-Gram-Second system) unit of the areal-related energy transmission (as a measure of the incident quantity of heat of solar radiation on the earths surface). 4,184 x 10⁴ J/m²"
         )
      },
      /**
       * photon flux
       */
      "photon flux": {
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹")
      },
      /**
       * photon intensity
       */
      "photon intensity": {
         reciprocal_second_per_steradian: makeEUInformation("D1", "s⁻¹/sr", "reciprocal second per steradian - s⁻¹/sr")
      },
      /**
       * photon luminance, photon radiance
       */
      "photon luminance, photon radiance": {
         reciprocal_second_per_steradian_metre_squared: makeEUInformation(
            "D2",
            "s⁻¹/(sr·m²)",
            "reciprocal second per steradian metre squared - s⁻¹/(sr x m²)"
         )
      },
      /**
       * photon exitance, irradiance
       */
      "photon exitance, irradiance": {
         reciprocal_second_per_metre_squared: makeEUInformation("C99", "s⁻¹/m²", "reciprocal second per metre squared - s⁻¹/m²")
      },
      /**
       * photon exposure
       */
      "photon exposure": {
         reciprocal_square_metre: makeEUInformation(
            "C93",
            "m⁻²",
            "reciprocal square metre - Synonym: reciprocal metre squared m⁻²"
         )
      },
      /**
       * radiant energy, fluence rate, radiant exitance, irradiance, first radiation constant
       */
      "radiant energy, fluence rate, radiant exitance, irradiance, first radiation constant": {
         watt_per_square_metre: makeEUInformation("D54", "W/m²", "watt per square metre - W/m²"),
         watt_per_cubic_metre: makeEUInformation("H47", "W/m³", "watt per cubic metre - m⁻¹ x kg x s⁻³"),
         watt_per_metre: makeEUInformation("H74", "W/m", "watt per metre - W m⁻¹")
      },
      /**
       * radiant intensity
       */
      "radiant intensity": {
         watt_per_steradian: makeEUInformation("D57", "W/sr", "watt per steradian - W/sr")
      },
      /**
       * radiance
       */
      radiance: {
         watt_per_steradian_square_metre: makeEUInformation("D58", "W/(sr·m²)", "watt per steradian square metre - W/(sr x m²)")
      },
      /**
       * Stefan-Boltzmann constant
       */
      "Stefan-Boltzmann constant": {
         watt_per_square_metre_kelvin_to_the_fourth_power: makeEUInformation(
            "D56",
            "W/(m²·K⁴)",
            "watt per square metre kelvin to the fourth power - W/(m² x K⁴)"
         )
      },
      /**
       * second radiation constant
       */
      "second radiation constant": {
         metre_kelvin: makeEUInformation("D18", "m·K", "metre kelvin - m x K")
      },
      /**
       * emissivity, spectral emissivity, emissivity at a specified wavelength, directional spectral emissivity
       */
      "emissivity, spectral emissivity, emissivity at a specified wavelength, directional spectral emissivity": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * luminous intensity
       */
      "luminous intensity": {
         candela: makeEUInformation("CDL", "cd", "candela - cd"),
         kilocandela: makeEUInformation("P33", "kcd", "kilocandela - 1000-fold of the SI base unit candela. 10³ cd"),
         millicandela: makeEUInformation("P34", "mcd", "millicandela - 0,001-fold of the SI base unit candela. 10⁻³ cd"),
         "Hefner-Kerze": makeEUInformation(
            "P35",
            "HK",
            "Hefner-Kerze - Obsolete, non-legal unit of the power in Germany relating to DIN 1301-3:1979: 1 HK = 0,903 cd. 0,903 cd"
         ),
         international_candle_: makeEUInformation(
            "P36",
            "IK",
            "international candle  - Obsolete, non-legal unit of the power in Germany relating to DIN 1301-3:1979: 1 HK = 1,019 cd. 1,019 cd"
         )
      },
      /**
       * luminous flux
       */
      "luminous flux": {
         lumen: makeEUInformation("LUM", "lm", "lumen - cd x sr")
      },
      /**
       * quantity of light
       */
      "quantity of light": {
         lumen_second: makeEUInformation("B62", "lm·s", "lumen second - s x cd x sr"),
         lumen_hour: makeEUInformation("B59", "lm·h", "lumen hour - 3,6 x 10³ s x cd x sr")
      },
      /**
       * luminance
       */
      luminance: {
         candela_per_square_metre: makeEUInformation("A24", "cd/m²", "candela per square metre - cd/m²"),
         candela_per_square_inch_: makeEUInformation(
            "P28",
            "cd/in²",
            "candela per square inch  - SI base unit candela divided by the power of unit inch according to the Anglo-American and Imperial system of units by exponent 2. 1,550 003 x 10³ cd/m²"
         ),
         footlambert: makeEUInformation(
            "P29",
            "ftL",
            "footlambert - Unit of the luminance according to the Anglo-American system of units, defined as emitted or reflected luminance of a lm/ft². 3,426 259 cd/m²"
         ),
         lambert: makeEUInformation(
            "P30",
            "Lb",
            "lambert - CGS (Centimetre-Gram-Second system) unit of luminance, defined as the emitted or reflected luminance by one lumen per square centimetre. 3,183 099 x 10³ cd/m²"
         ),
         stilb: makeEUInformation(
            "P31",
            "sb",
            "stilb - CGS (Centimetre-Gram-Second system) unit of luminance, defined as emitted or reflected luminance by one lumen per square centimetre. 10⁴ cd/m²"
         ),
         candela_per_square_foot: makeEUInformation(
            "P32",
            "cd/ft²",
            "candela per square foot - Base unit SI candela divided by the power of the unit foot according to the Anglo-American and Imperial system of units by exponent 2. 1,076 391 x 10 cd/m²"
         )
      },
      /**
       * luminous exitance
       */
      "luminous exitance": {
         lumen_per_square_metre: makeEUInformation("B60", "lm/m²", "lumen per square metre - cd x sr/m²")
      },
      /**
       * illuminance
       */
      illuminance: {
         lux: makeEUInformation("LUX", "lx", "lux - cd x sr / m²"),
         kilolux: makeEUInformation("KLX", "klx", "kilolux - A unit of illuminance equal to one thousand lux. 10³ cd x sr / m²"),
         lumen_per_square_foot_: makeEUInformation(
            "P25",
            "lm/ft²",
            "lumen per square foot  - Derived SI unit lumen divided by the power of the unit foot according to the Anglo-American and Imperial system of units by exponent 2. 1,076 391 x 10¹ cd x sr / m²"
         ),
         phot: makeEUInformation(
            "P26",
            "ph",
            "phot - CGS (Centimetre-Gram-Second system) unit of the illuminance, defined as lumen by square centimetre. 10⁴ cd x sr / m²"
         ),
         footcandle: makeEUInformation(
            "P27",
            "ftc",
            "footcandle - Non SI conform traditional unit, defined as density of light which impinges on a surface which has a distance of one foot from a light source, which shines with an intensity of an international candle. 1,076 391 x 10¹ cd x sr / m²"
         )
      },
      /**
       * light exposure
       */
      "light exposure": {
         lux_second: makeEUInformation("B64", "lx·s", "lux second - s x cd x sr / m²"),
         lux_hour: makeEUInformation("B63", "lx·h", "lux hour - 3,6 x 10³ s x cd x sr / m²")
      },
      /**
       * luminious efficacy, spectral luminous efficacy, luminous efficacy at a specified wavelength, maximum spectral luminous efficacy
       */
      "luminious efficacy, spectral luminous efficacy, luminous efficacy at a specified wavelength, maximum spectral luminous efficacy":
      {
         lumen_per_watt: makeEUInformation("B61", "lm/W", "lumen per watt - cd x sr/W")
      },
      /**
       * luminous efficiency, spectral luminous efficiency,luminous efficiency at a specified wavelength
       */
      "luminous efficiency, spectral luminous efficiency,luminous efficiency at a specified wavelength": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * CIE colorimetric functions
       */
      "CIE colorimetric functions": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * coordinates trichromatic
       */
      "coordinates trichromatic": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * spectral absorption factor, spectral absorptance, spectral reflectionfactor,spectral reflectance, spectral transmission factor, spectral transmittance, spectral radiance factor
       */
      "spectral absorption factor, spectral absorptance, spectral reflectionfactor,spectral reflectance, spectral transmission factor, spectral transmittance, spectral radiance factor":
      {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * optical density
       */
      "optical density": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * refractive index
       */
      "refractive index": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * linear attenuation coefficient, linear extinction coefficient,linear absorption coefficient
       */
      "linear attenuation coefficient, linear extinction coefficient,linear absorption coefficient": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * molar absorption coefficient
       */
      "molar absorption coefficient": {
         square_metre_per_mole: makeEUInformation("D22", "m²/mol", "square metre per mole - m²/mol")
      },
      /**
       * object distance, image distance, focal distance
       */
      "object distance, image distance, focal distance": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * vergence, lens power
       */
      "vergence, lens power": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      }
   },
   /**
    * Acoustics
    */
   Acoustics: {
      /**
       * period, periodic time
       */
      "period, periodic time": {
         "second_[unit_of_time]": makeEUInformation("SEC", "s", "second [unit of time] - s")
      },
      /**
       * frequency
       */
      frequency: {
         hertz: makeEUInformation("HTZ", "Hz", "hertz - Hz")
      },
      /**
       * frequency interval
       */
      "frequency interval": {
         octave: makeEUInformation("C59", "", "octave - A unit used in music to describe the ratio in frequency between notes. ")
      },
      /**
       * angular frequency, pulsatance
       */
      "angular frequency, pulsatance": {
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹"),
         radian_per_second: makeEUInformation("2A", "rad/s", "radian per second - Refer ISO/TC12 SI Guide rad/s")
      },
      /**
       * wavelength
       */
      wavelength: {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * repetency, wavenumber
       */
      "repetency, wavenumber": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * angular repetency, angular wavenumber
       */
      "angular repetency, angular wavenumber": {
         radian_per_metre: makeEUInformation("C84", "rad/m", "radian per metre - rad/m")
      },
      /**
       * volumic mass, density, mass density
       */
      "volumic mass, density, mass density": {
         kilogram_per_cubic_metre: makeEUInformation(
            "KMQ",
            "kg/m³",
            "kilogram per cubic metre - A unit of weight expressed in kilograms of a substance that fills a volume of one cubic metre. kg/m³"
         )
      },
      /**
       * static pressure, (instantaneous) sound pressure
       */
      "static pressure, (instantaneous) sound pressure": {
         pascal: makeEUInformation("PAL", "Pa", "pascal - Pa"),
         "bar_[unit_of_pressure]": makeEUInformation("BAR", "bar", "bar [unit of pressure] - 10⁵ Pa"),
         dyne_per_square_centimetre: makeEUInformation("D9", "dyn/cm²", "dyne per square centimetre - 10⁻¹ Pa")
      },
      /**
       * (instantaneous) sound particle displacement
       */
      "(instantaneous) sound particle displacement": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * (instantaneous) sound particle velocity
       */
      "(instantaneous) sound particle velocity": {
         metre_per_second: makeEUInformation("MTS", "m/s", "metre per second - m/s")
      },
      /**
       * (instantaneous) sound particle acceleration
       */
      "(instantaneous) sound particle acceleration": {
         metre_per_second_squared: makeEUInformation("MSK", "m/s²", "metre per second squared - m/s²")
      },
      /**
       * (instantaneous) volume flow rate
       */
      "(instantaneous) volume flow rate": {
         cubic_metre_per_second: makeEUInformation("MQS", "m³/s", "cubic metre per second - m³/s")
      },
      /**
       * velocity of sound (phase velocity), group velocity
       */
      "velocity of sound (phase velocity), group velocity": {
         metre_per_second: makeEUInformation("MTS", "m/s", "metre per second - m/s")
      },
      /**
       * sound energy density, volumic, sound energy
       */
      "sound energy density, volumic, sound energy": {
         joule_per_cubic_metre: makeEUInformation("B8", "J/m³", "joule per cubic metre - J/m³"),
         erg_per_cubic_centimetre: makeEUInformation("A60", "erg/cm³", "erg per cubic centimetre - 10⁻¹ J/m³")
      },
      /**
       * sound power
       */
      "sound power": {
         watt: makeEUInformation("WTT", "W", "watt - W"),
         erg_per_second: makeEUInformation("A63", "erg/s", "erg per second - 10⁻⁷ W")
      },
      /**
       * sound intensity
       */
      "sound intensity": {
         watt_per_square_metre: makeEUInformation("D54", "W/m²", "watt per square metre - W/m²"),
         milliwatt_per_square_metre: makeEUInformation("C32", "mW/m²", "milliwatt per square metre - 10⁻³ W/m²"),
         microwatt_per_square_metre: makeEUInformation("D85", "µW/m²", "microwatt per square metre - 10⁻⁶ W/m²"),
         picowatt_per_square_metre: makeEUInformation("C76", "pW/m²", "picowatt per square metre - 10⁻¹² W/m²"),
         erg_per_second_square_centimetre: makeEUInformation(
            "A64",
            "erg/(s·cm²)",
            "erg per second square centimetre - 10⁻³ W/m²"
         )
      },
      /**
       * characteristic impedance of a medium
       */
      "characteristic impedance of a medium": {
         pascal_second_per_metre: makeEUInformation("C67", "Pa· s/m", "pascal second per metre - Pa x s/m")
      },
      /**
       * surface density of mechanical impedance
       */
      "surface density of mechanical impedance": {
         dyne_second_per_cubic_centimetre: makeEUInformation(
            "A50",
            "dyn·s/cm³",
            "dyne second per cubic centimetre - 10 Pa x s/m"
         )
      },
      /**
       * acoustic impedance
       */
      "acoustic impedance": {
         pascal_second_per_cubic_metre: makeEUInformation("C66", "Pa·s/m³", "pascal second per cubic metre - Pa x s/m³"),
         dyne_second_per_centimetre_to_the_fifth_power: makeEUInformation(
            "A52",
            "dyn·s/cm⁵",
            "dyne second per centimetre to the fifth power - 10⁵ Pa x s/m³"
         ),
         pascal_second_per_litre: makeEUInformation("M32", "Pa·s/l", "pascal second per litre - 10³ Pa x s/m³")
      },
      /**
       * mechanical impedance
       */
      "mechanical impedance": {
         newton_second_per_metre: makeEUInformation("C58", "N·s/m", "newton second per metre - N x s/m"),
         dyne_second_per_centimetre: makeEUInformation("A51", "dyn·s/cm", "dyne second per centimetre - 10⁻³ N x s/m")
      },
      /**
       * sound pressure level, sound power level
       */
      "sound pressure level, sound power level": {
         decibel: makeEUInformation("2N", "dB", "decibel - 0,115 129 3 Np"),
         bel_per_metre: makeEUInformation("P43", "B/m", "bel per metre - Unit bel divided by the SI base unit metre. B/m"),
         decibel_per_kilometre: makeEUInformation("H51", "dB/km", "decibel per kilometre - 10⁻⁴ B/m"),
         decibel_per_metre: makeEUInformation("H52", "dB/m", "decibel per metre - 10⁻¹ B/m")
      },
      /**
       * damping coefficient
       */
      "damping coefficient": {
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹"),
         neper_per_second: makeEUInformation("C51", "Np/s", "neper per second - Np/s")
      },
      /**
       * time constant, relaxation time
       */
      "time constant, relaxation time": {
         "second_[unit_of_time]": makeEUInformation("SEC", "s", "second [unit of time] - s")
      },
      /**
       * logarithmic decrement
       */
      "logarithmic decrement": {
         neper: makeEUInformation("C50", "Np", "neper - Np"),
         "decade_(logarithmic)": makeEUInformation(
            "P41",
            "dec",
            "decade (logarithmic) - 1 Dec := log2 10 ˜ 3,32 according to the logarithm for frequency range between f1 and f2, when f2/f1 = 10. dec"
         )
      },
      /**
       * attenuation coefficient, phase coefficient, propagation coefficient
       */
      "attenuation coefficient, phase coefficient, propagation coefficient": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * dissipation factor, dissipance, reflection factor, reflectance, transmission factor, transmittance, absorption factor, absorbance
       */
      "dissipation factor, dissipance, reflection factor, reflectance, transmission factor, transmittance, absorption factor, absorbance":
      {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * sound reduction index
       */
      "sound reduction index": {
         decibel: makeEUInformation("2N", "dB", "decibel - 0,115 129 3 Np")
      },
      /**
       * equivalent absorption area of a surface or object
       */
      "equivalent absorption area of a surface or object": {
         square_metre: makeEUInformation("MTK", "m²", "square metre - m²")
      },
      /**
       * reverberation time
       */
      "reverberation time": {
         "second_[unit_of_time]": makeEUInformation("SEC", "s", "second [unit of time] - s")
      },
      /**
       * loudness level
       */
      "loudness level": {
         phon: makeEUInformation(
            "C69",
            "",
            "phon - A unit of subjective sound loudness. A sound has loudness p phons if it seems to the listener to be equal in loudness to the sound of a pure tone of frequency 1 kilohertz and strength p decibels. "
         )
      },
      /**
       * loudness
       */
      loudness: {
         sone: makeEUInformation(
            "D15",
            "",
            "sone - A unit of subjective sound loudness. One sone is the loudness of a pure tone of frequency one kilohertz and strength 40 decibels. "
         )
      },
      /**
       * sound exposure
       */
      "sound exposure": {
         pascal_squared_second: makeEUInformation(
            "P42",
            "Pa²·s",
            "pascal squared second - Unit of the set as a product of the power of derived SI unit pascal with exponent 2 and the SI base unit second. m⁻² x kg² x s⁻³"
         )
      }
   },
   /**
    * Physical Chemistry and Molecular Physics
    */
   "Physical Chemistry and Molecular Physics": {
      /**
       * relative atomic mass
       */
      "relative atomic mass": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * relative molecular mass
       */
      "relative molecular mass": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * number of molecules or other elementary entities
       */
      "number of molecules or other elementary entities": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * amount of substance
       */
      "amount of substance": {
         mole: makeEUInformation("C34", "mol", "mole - mol"),
         kilomole: makeEUInformation("B45", "kmol", "kilomole - 10³ mol"),
         millimole: makeEUInformation("C18", "mmol", "millimole - 10⁻³ mol"),
         micromole: makeEUInformation("FH", "µmol", "micromole - 10⁻⁶ mol"),
         nanomole: makeEUInformation("Z9", "nmol", "nanomole - An SI unit of amount of substance equal to 10−9 moles 10⁻9 mol"),
         pound_mole: makeEUInformation(
            "P44",
            "lbmol",
            "pound mole - Non SI-conforming unit of quantity of a substance relating that one pound mole of a chemical composition corresponds to the same number of pounds as the molecular weight of one molecule of this composition in atomic mass units. 453,592 4 mol"
         )
      },
      /**
       * Avogadro constant
       */
      "Avogadro constant": {
         reciprocal_mole: makeEUInformation("C95", "mol⁻¹", "reciprocal mole - mol⁻¹")
      },
      /**
       * molar mass
       */
      "molar mass": {
         kilogram_per_mole: makeEUInformation("D74", "kg/mol", "kilogram per mole - kg/mol"),
         gram_per_mole: makeEUInformation("A94", "g/mol", "gram per mole - 10⁻³ kg/mol")
      },
      /**
       * molar volume
       */
      "molar volume": {
         cubic_metre_per_mole: makeEUInformation("A40", "m³/mol", "cubic metre per mole - m³/mol"),
         cubic_decimetre_per_mole: makeEUInformation("A37", "dm³/mol", "cubic decimetre per mole - 10⁻³ m³/mol"),
         cubic_centimetre_per_mole: makeEUInformation("A36", "cm³/mol", "cubic centimetre per mole - 10⁻⁶ m³/mol"),
         litre_per_mole: makeEUInformation("B58", "l/mol", "litre per mole - 10⁻³ m³/mol")
      },
      /**
       * molar thermodynamic energy
       */
      "molar thermodynamic energy": {
         joule_per_mole: makeEUInformation("B15", "J/mol", "joule per mole - J/mol"),
         kilojoule_per_mole: makeEUInformation("B44", "kJ/mol", "kilojoule per mole - 10³ J/mol")
      },
      /**
       * chemical potential
       */
      "chemical potential": {
         joule_per_mole: makeEUInformation("B15", "J/mol", "joule per mole - J/mol")
      },
      /**
       * absolute activity
       */
      "absolute activity": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * affinity (of a chemical reaction)
       */
      "affinity (of a chemical reaction)": {
         joule_per_mole: makeEUInformation("B15", "J/mol", "joule per mole - J/mol")
      },
      /**
       * standard equilibrium constant
       */
      "standard equilibrium constant": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * molar heat capacity, molar entropy, molar gas constant
       */
      "molar heat capacity, molar entropy, molar gas constant": {
         joule_per_mole_kelvin: makeEUInformation("B16", "J/(mol·K)", "joule per mole kelvin - J/(mol x K)")
      },
      /**
       * volumic number of molecules (or particles), number density of molecules  (or particles), molecular concentration of B
       */
      "volumic number of molecules (or particles), number density of molecules  (or particles), molecular concentration of B": {
         reciprocal_cubic_metre: makeEUInformation("C86", "m⁻³", "reciprocal cubic metre - m⁻³"),
         reciprocal_cubic_centimetre: makeEUInformation("H50", "cm⁻³", "reciprocal cubic centimetre - 10⁶ m⁻³"),
         reciprocal_cubic_millimetre: makeEUInformation("L20", "1/mm³", "reciprocal cubic millimetre - 10⁹ m⁻³"),
         reciprocal_cubic_foot: makeEUInformation("K20", "1/ft³", "reciprocal cubic foot - 35,314 66 m⁻³"),
         reciprocal_cubic_inch: makeEUInformation("K49", "1/in³", "reciprocal cubic inch - 6,102 375 9 x 10⁴ m⁻³"),
         reciprocal_litre: makeEUInformation("K63", "1/l", "reciprocal litre - 10³ m⁻³"),
         reciprocal_cubic_yard: makeEUInformation("M10", "1/yd³", "reciprocal cubic yard - 1,307 951 m⁻³")
      },
      /**
       * volumic mass, mass density, density, mass concentration of B, amount of substance, concentration of B
       */
      "volumic mass, mass density, density, mass concentration of B, amount of substance, concentration of B": {
         kilogram_per_cubic_metre: makeEUInformation(
            "KMQ",
            "kg/m³",
            "kilogram per cubic metre - A unit of weight expressed in kilograms of a substance that fills a volume of one cubic metre. kg/m³"
         ),
         mole_per_cubic_metre: makeEUInformation("C36", "mol/m³", "mole per cubic metre - mol/m³"),
         mole_per_litre: makeEUInformation("C38", "mol/l", "mole per litre - 10³ mol/m³"),
         kilogram_per_litre: makeEUInformation("B35", "kg/l or kg/L", "kilogram per litre - 10³ kg/m³"),
         mole_per_cubic_decimetre: makeEUInformation("C35", "mol/dm³", "mole per cubic decimetre - 10³ mol/m³"),
         kilomole_per_cubic_metre: makeEUInformation("B46", "kmol/m³", "kilomole per cubic metre - 10³ mol/m³"),
         mole_per_second: makeEUInformation("E95", "mol/s", "mole per second - s⁻¹ x mol"),
         millimole_per_litre: makeEUInformation("M33", "mmol/l", "millimole per litre - mol/m³"),
         mol_per_kilogram_pascal: makeEUInformation(
            "P51",
            "(mol/kg)/Pa",
            "mol per kilogram pascal - SI base unit mol divided by the product of the SI base unit kilogram and the derived SI unit pascal. m x kg⁻² x s² x mol"
         ),
         mol_per_cubic_metre_pascal: makeEUInformation(
            "P52",
            "(mol/m³)/Pa",
            "mol per cubic metre pascal - SI base unit mol divided by the product of the power from the SI base unit metre with exponent 3 and the derived SI unit pascal. m⁻² x kg⁻¹ x s² x mol"
         ),
         kilomole_per_cubic_metre_kelvin: makeEUInformation(
            "K59",
            "(kmol/m³)/K",
            "kilomole per cubic metre kelvin - 10³ (mol/m³)/K"
         ),
         kilomole_per_cubic_metre_bar: makeEUInformation(
            "K60",
            "(kmol/m³)/bar",
            "kilomole per cubic metre bar - 10⁻² (mol/m³)/Pa"
         ),
         reciprocal_psi: makeEUInformation("K93", "1/psi", "reciprocal psi - 1,450 377 x 10⁻⁴ Pa⁻¹"),
         mole_per_kilogram_kelvin: makeEUInformation("L24", "(mol/kg)/K", "mole per kilogram kelvin - (mol/kg)/K"),
         mole_per_kilogram_bar: makeEUInformation("L25", "(mol/kg)/bar", "mole per kilogram bar - 10⁻⁵ (mol/kg)/Pa"),
         mole_per_litre_kelvin: makeEUInformation("L26", "(mol/l)/K", "mole per litre kelvin - 10³ (mol/m³)/K"),
         mole_per_litre_bar: makeEUInformation("L27", "(mol/l)/bar", "mole per litre bar - 10⁻² (mol/m³)/Pa"),
         mole_per_cubic_metre_kelvin: makeEUInformation("L28", "(mol/m³)/K", "mole per cubic metre kelvin - (mol/m³)/K"),
         mole_per_cubic_metre_bar: makeEUInformation("L29", "(mol/m³)/bar", "mole per cubic metre bar - 10⁻⁵ (mol/m³)/Pa")
      },
      /**
       * mole fraction of B, mole ratio of solute B
       */
      "mole fraction of B, mole ratio of solute B": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * molality of solute B
       */
      "molality of solute B": {
         mole_per_kilogram: makeEUInformation("C19", "mol/kg", "mole per kilogram - mol/kg")
      },
      /**
       * volumic dose
       */
      "volumic dose": {
         second_per_cubic_metre: makeEUInformation("D93", "s/m³", "second per cubic metre - s/m³")
      },
      /**
       * ionic strength
       */
      "ionic strength": {
         millimole_per_kilogram: makeEUInformation("D87", "mmol/kg", "millimole per kilogram - 10⁻³ mol/kg"),
         millimole_per_gram: makeEUInformation("H68", "mmol/g", "millimole per gram - mol x kg⁻¹"),
         kilomole_per_kilogram: makeEUInformation(
            "P47",
            "kmol/kg",
            "kilomole per kilogram - 1000-fold of the SI base unit mol divided by the SI base unit kilogram. 10³ mol/kg"
         ),
         pound_mole_per_pound: makeEUInformation(
            "P48",
            "lbmol/lb",
            "pound mole per pound - Non SI-conforming unit of the material molar flux divided by the avoirdupois pound for mass according to the avoirdupois unit system. 10³ mol/kg"
         )
      },
      /**
       * degree of dissociation
       */
      "degree of dissociation": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * partial pressure of B (in a gaseous mixture), fugacity of B (in a gaseous mixture), osmotic pressure
       */
      "partial pressure of B (in a gaseous mixture), fugacity of B (in a gaseous mixture), osmotic pressure": {
         pascal: makeEUInformation("PAL", "Pa", "pascal - Pa")
      },
      /**
       * standard absolute activity of B (in a gaseous mixture)
       */
      "standard absolute activity of B (in a gaseous mixture)": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * activity coefficient of B (in a liquid as a solid mixture)
       */
      "activity coefficient of B (in a liquid as a solid mixture)": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * standard absolute activity of B (in a liquid or a solid mixture)
       */
      "standard absolute activity of B (in a liquid or a solid mixture)": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * activity coefficient of solute B (especially in a dilute solution),standard absolute activity of solute B (especially in a dilute solution)
       */
      "activity coefficient of solute B (especially in a dilute solution),standard absolute activity of solute B (especially in a dilute solution)":
      {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * activity of solvent A, relative activity of solvent A (especially in a dilute solution), osmotic coefficient of the solvent A (especially in a dilute solution), standard absolute activity of solvent A (especially in a dilute solution)
       */
      "activity of solvent A, relative activity of solvent A (especially in a dilute solution), osmotic coefficient of the solvent A (especially in a dilute solution), standard absolute activity of solvent A (especially in a dilute solution)":
      {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * catalytic activity
       */
      "catalytic activity": {
         katal: makeEUInformation(
            "KAT",
            "kat",
            "katal - A unit of catalytic activity defining the catalytic activity of enzymes and other catalysts. s⁻¹ x mol"
         ),
         kilomole_per_second: makeEUInformation("E94", "kmol/s", "kilomole per second - 10³ s⁻¹ x mol"),
         pound_mole_per_second: makeEUInformation(
            "P45",
            "lbmol/s",
            "pound mole per second - Non SI-conforming unit of the power of the amount of substance non-SI compliant unit of the molar flux relating that a pound mole of a chemical composition the same number of pound corresponds like the molecular weight of a molecule of this composition in atomic mass units. 4,535 924 x 10² mol/s"
         ),
         pound_mole_per_minute: makeEUInformation(
            "P46",
            "lbmol/h",
            "pound mole per minute - Non SI-conforming unit of the power of the amount of substance non-SI compliant unit of the molar flux relating that a pound mole of a chemical composition the same number of pound corresponds like the molecular weight of a molecule of this composition in atomic mass units. 7,559 873 mol/s"
         )
      },
      /**
       * stoichiometric number of B
       */
      "stoichiometric number of B": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * mass of molecule
       */
      "mass of molecule": {
         kilogram: makeEUInformation("KGM", "kg", "kilogram - A unit of mass equal to one thousand grams. kg"),
         unified_atomic_mass_unit: makeEUInformation("D43", "u", "unified atomic mass unit - 1,660 538 782 x 10⁻²⁷ kg")
      },
      /**
       * electric dipole moment of molecule
       */
      "electric dipole moment of molecule": {
         coulomb_metre: makeEUInformation("A26", "C·m", "coulomb metre - A x s x m")
      },
      /**
       * electric polarizability of a molecule
       */
      "electric polarizability of a molecule": {
         coulomb_metre_squared_per_volt: makeEUInformation("A27", "C·m²/V", "coulomb metre squared per volt - A² x  s⁴/kg")
      },
      /**
       * microcanonical partition function, canonical partition function, grand-canonical partition function, grand partition function, molecular partition function, partition function of a molecule
       */
      "microcanonical partition function, canonical partition function, grand-canonical partition function, grand partition function, molecular partition function, partition function of a molecule":
      {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * statistical weight
       */
      "statistical weight": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Boltzmann constant
       */
      "Boltzmann constant": {
         joule_per_kelvin: makeEUInformation("JE", "J/K", "joule per kelvin - J/K")
      },
      /**
       * mean free path
       */
      "mean free path": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * diffusion coefficient
       */
      "diffusion coefficient": {
         square_metre_per_second: makeEUInformation(
            "S4",
            "m²/s",
            "square metre per second - Synonym: metre squared per second (square metres/second US) m²/s"
         )
      },
      /**
       * thermal diffusion ratio, thermal diffusion factor
       */
      "thermal diffusion ratio, thermal diffusion factor": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * thermal diffusion coefficient
       */
      "thermal diffusion coefficient": {
         square_metre_per_second: makeEUInformation(
            "S4",
            "m²/s",
            "square metre per second - Synonym: metre squared per second (square metres/second US) m²/s"
         )
      },
      /**
       * proton number
       */
      "proton number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * elementary charge
       */
      "elementary charge": {
         coulomb: makeEUInformation("COU", "C", "coulomb - A x s")
      },
      /**
       * charge number of ion
       */
      "charge number of ion": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Faraday constant
       */
      "Faraday constant": {
         coulomb_per_mole: makeEUInformation("A32", "C/mol", "coulomb per mole - A x s/mol")
      },
      /**
       * electrolytic conductivity
       */
      "electrolytic conductivity": {
         siemens_per_metre: makeEUInformation("D10", "S/m", "siemens per metre - S/m")
      },
      /**
       * molar conductivity
       */
      "molar conductivity": {
         siemens_square_metre_per_mole: makeEUInformation("D12", "S·m²/mol", "siemens square metre per mole - S x m²/mol")
      },
      /**
       * molar flux
       */
      "molar flux": {
         kilomole_per_hour: makeEUInformation("K58", "kmol/h", "kilomole per hour - 2,777 78 x 10⁻¹ mol/s"),
         kilomole_per_minute: makeEUInformation("K61", "kmol/min", "kilomole per minute - 16,666 7 mol/s"),
         mole_per_hour: makeEUInformation("L23", "mol/h", "mole per hour - 2,777 78 x 10⁻⁴ mol/s"),
         mole_per_minute: makeEUInformation("L30", "mol/min", "mole per minute - 1,666 67 x 10⁻² mol/s")
      },
      /**
       * transport number of ion B, current fraction of ion B
       */
      "transport number of ion B, current fraction of ion B": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * angle of optical rotation
       */
      "angle of optical rotation": {
         radian: makeEUInformation("C81", "rad", "radian - rad")
      },
      /**
       * molar optical rotatory power
       */
      "molar optical rotatory power": {
         radian_square_metre_per_mole: makeEUInformation("C82", "rad·m²/mol", "radian square metre per mole - rad x m²/mol")
      },
      /**
       * massic optical, rotatory power, specific optical rotatory power
       */
      "massic optical, rotatory power, specific optical rotatory power": {
         radian_square_metre_per_kilogram: makeEUInformation(
            "C83",
            "rad·m²/kg",
            "radian square metre per kilogram - rad x m²/kg"
         )
      },
      /**
       * magnetic dipole moment
       */
      "magnetic dipole moment": {
         newton_square_metre_per_ampere: makeEUInformation(
            "P49",
            "N·m²/A",
            "newton square metre per ampere - Product of the derived SI unit newton and the power of SI base unit metre with exponent 2 divided by the SI base unit ampere. m³ x kg x s⁻²  x A⁻¹"
         ),
         weber_metre: makeEUInformation(
            "P50",
            "Wb·m",
            "weber metre - Product of the derived SI unit weber and SI base unit metre. m³ x kg x s⁻²  x A⁻¹"
         )
      },
      /**
       * acidity and alkalinity
       */
      "acidity and alkalinity": {
         "pH_(potential_of_Hydrogen)": makeEUInformation(
            "Q30",
            "pH",
            "pH (potential of Hydrogen) - The activity of the (solvated) hydrogen ion (a logarithmic measure used to state the acidity or alkalinity of a chemical solution). -log10(mol/l)"
         )
      }
   },
   /**
    * Atomic and Nuclear Physics
    */
   "Atomic and Nuclear Physics": {
      /**
       * proton number, atomic number
       */
      "proton number, atomic number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * neutron number
       */
      "neutron number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * nucleon number, mass number
       */
      "nucleon number, mass number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * mass of atom (of a nuclide x), nuclidic mass
       */
      "mass of atom (of a nuclide x), nuclidic mass": {
         kilogram: makeEUInformation("KGM", "kg", "kilogram - A unit of mass equal to one thousand grams. kg")
      },
      /**
       * mass of atom (of a nuclide x), nuclidic mass, unified atomic mass constant
       */
      "mass of atom (of a nuclide x), nuclidic mass, unified atomic mass constant": {
         unified_atomic_mass_unit: makeEUInformation("D43", "u", "unified atomic mass unit - 1,660 538 782 x 10⁻²⁷ kg")
      },
      /**
       * (rest) mass of electron, (rest) mass of proton, (rest) mass of neutron
       */
      "(rest) mass of electron, (rest) mass of proton, (rest) mass of neutron": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * mass excess
       */
      "mass excess": {
         kilogram: makeEUInformation("KGM", "kg", "kilogram - A unit of mass equal to one thousand grams. kg")
      },
      /**
       * mass defect
       */
      "mass defect": {
         unified_atomic_mass_unit: makeEUInformation("D43", "u", "unified atomic mass unit - 1,660 538 782 x 10⁻²⁷ kg")
      },
      /**
       * relative mass excess, relative mass defect
       */
      "relative mass excess, relative mass defect": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * packing fraction, binding fraction
       */
      "packing fraction, binding fraction": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * elementary charge
       */
      "elementary charge": {
         coulomb: makeEUInformation("COU", "C", "coulomb - A x s")
      },
      /**
       * Planck constant
       */
      "Planck constant": {
         joule_second: makeEUInformation("B18", "J·s", "joule second - J x s")
      },
      /**
       * Bohr radius
       */
      "Bohr radius": {
         metre: makeEUInformation("MTR", "m", "metre - m"),
         angstrom: makeEUInformation("A11", "Å", "angstrom - 10⁻¹⁰ m")
      },
      /**
       * Rydberg constant
       */
      "Rydberg constant": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * Hartree energy
       */
      "Hartree energy": {
         joule: makeEUInformation("JOU", "J", "joule - J")
      },
      /**
       * magnetic moment of particle, Bohr magneton, nuclear magneton ornucleus
       */
      "magnetic moment of particle, Bohr magneton, nuclear magneton ornucleus": {
         ampere_square_metre: makeEUInformation("A5", "A·m²", "ampere square metre - A x m²")
      },
      /**
       * gyromagnetic coefficient, (gyromagnetic ratio)
       */
      "gyromagnetic coefficient, (gyromagnetic ratio)": {
         ampere_square_metre_per_joule_second: makeEUInformation(
            "A10",
            "A·m²/(J·s)",
            "ampere square metre per joule second - (A x s)/kg"
         )
      },
      /**
       * g-factor of atom or electron, g-factor of nucleus
       */
      "g-factor of atom or electron, g-factor of nucleus": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Larmor angular frequency
       */
      "Larmor angular frequency": {
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹")
      },
      /**
       * nuclear precession, cyclotron angular frequency
       */
      "nuclear precession, cyclotron angular frequency": {
         radian_per_second: makeEUInformation("2A", "rad/s", "radian per second - Refer ISO/TC12 SI Guide rad/s")
      },
      /**
       * nuclear quadrupole moment
       */
      "nuclear quadrupole moment": {
         square_metre: makeEUInformation("MTK", "m²", "square metre - m²")
      },
      /**
       * nuclear radius, electron radius, Compton wavelength
       */
      "nuclear radius, electron radius, Compton wavelength": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * orbital angular momentum quantum number
       */
      "orbital angular momentum quantum number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * spin angular momentum quantum number
       */
      "spin angular momentum quantum number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * total angular momentum quantum number
       */
      "total angular momentum quantum number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * nuclear spin quantum number
       */
      "nuclear spin quantum number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * hyperfine structure quantum number
       */
      "hyperfine structure quantum number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * principle quantum number
       */
      "principle quantum number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * magnetic quantum number
       */
      "magnetic quantum number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * fine structure constant
       */
      "fine structure constant": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * mean life, half life
       */
      "mean life, half life": {
         "second_[unit_of_time]": makeEUInformation("SEC", "s", "second [unit of time] - s")
      },
      /**
       * level width, alpha disintegration energy
       */
      "level width, alpha disintegration energy": {
         joule: makeEUInformation("JOU", "J", "joule - J")
      },
      /**
       * maximum beta particle energy, beta disintegration energy
       */
      "maximum beta particle energy, beta disintegration energy": {
         electronvolt: makeEUInformation("A53", "eV", "electronvolt - 1,602 176 487 x 10⁻¹⁹ J")
      },
      /**
       * internal conversion factor
       */
      "internal conversion factor": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * activity
       */
      activity: {
         curie: makeEUInformation("CUR", "Ci", "curie - 3,7 x 10¹⁰ Bq"),
         millicurie: makeEUInformation("MCU", "mCi", "millicurie - 3,7 x 10⁷ Bq"),
         microcurie: makeEUInformation("M5", "µCi", "microcurie - 3,7 x 10⁴ Bq"),
         kilocurie: makeEUInformation("2R", "kCi", "kilocurie - 3,7 x 10¹³ Bq"),
         becquerel: makeEUInformation("BQL", "Bq", "becquerel - 27,027 x 10⁻¹² Ci"),
         gigabecquerel: makeEUInformation("GBQ", "GBq", "gigabecquerel - 10⁹ Bq"),
         kilobecquerel: makeEUInformation("2Q", "kBq", "kilobecquerel - 10³ Bq"),
         megabecquerel: makeEUInformation("4N", "MBq", "megabecquerel - 10⁶ Bq"),
         microbecquerel: makeEUInformation("H08", "µBq", "microbecquerel - 10⁻⁶ Bq")
      },
      /**
       * specific activity in a sample
       */
      "specific activity in a sample": {
         curie_per_kilogram: makeEUInformation("A42", "Ci/kg", "curie per kilogram - 3,7 x 10¹⁰ Bq/kg"),
         becquerel_per_kilogram: makeEUInformation("A18", "Bq/kg", "becquerel per kilogram - 27,027 x 10⁻¹² Ci/kg"),
         megabecquerel_per_kilogram: makeEUInformation("B67", "MBq/kg", "megabecquerel per kilogram - 10⁶ Bq/kg"),
         kilobecquerel_per_kilogram: makeEUInformation("B25", "kBq/kg", "kilobecquerel per kilogram - 10³ Bq/kg")
      },
      /**
       * volumic activity, activity concentration
       */
      "volumic activity, activity concentration": {
         becquerel_per_cubic_metre: makeEUInformation("A19", "Bq/m³", "becquerel per cubic metre - Bq/m³")
      },
      /**
       * decay constant, disintegration constant
       */
      "decay constant, disintegration constant": {
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹")
      }
   },
   /**
    * Nuclear Reactions and Ionizing Radiations
    */
   "Nuclear Reactions and Ionizing Radiations": {
      /**
       * reaction energy
       */
      "reaction energy": {
         joule: makeEUInformation("JOU", "J", "joule - J")
      },
      /**
       * resonance energy
       */
      "resonance energy": {
         electronvolt: makeEUInformation("A53", "eV", "electronvolt - 1,602 176 487 x 10⁻¹⁹ J")
      },
      /**
       * average energy loss per ion, pair formed, (average energy  loss per elementary charge of the same sign produced)
       */
      "average energy loss per ion, pair formed, (average energy  loss per elementary charge of the same sign produced)": {
         erg: makeEUInformation("A57", "erg", "erg - 10⁻⁷J")
      },
      /**
       * cross-section
       */
      "cross-section": {
         square_metre: makeEUInformation("MTK", "m²", "square metre - m²")
      },
      /**
       * total cross-section
       */
      "total cross-section": {
         barn: makeEUInformation("A14", "b", "barn - 10⁻²⁸ m²")
      },
      /**
       * angular cross-section
       */
      "angular cross-section": {
         square_metre_per_steradian: makeEUInformation("D24", "m²/sr", "square metre per steradian - m²/sr"),
         barn_per_steradian: makeEUInformation("A17", "b/sr", "barn per steradian - 1 x 10⁻²⁸ m²/sr")
      },
      /**
       * spectral cross-section
       */
      "spectral cross-section": {
         square_metre_per_joule: makeEUInformation("D20", "m²/J", "square metre per joule - m²/J"),
         barn_per_electronvolt: makeEUInformation("A15", "b/eV", "barn per electronvolt - 6,241 51 x 10⁻¹⁰ m²/J"),
         square_centimetre_per_erg: makeEUInformation("D16", "cm²/erg", "square centimetre per erg - 10³ m²/J")
      },
      /**
       * spectral angular cross-section
       */
      "spectral angular cross-section": {
         square_metre_per_steradian_joule: makeEUInformation(
            "D25",
            "m²/(sr·J)",
            "square metre per steradian joule - m²/(sr x J)"
         ),
         barn_per_steradian_electronvolt: makeEUInformation(
            "A16",
            "b/(sr·eV)",
            "barn per steradian electronvolt - 6,241 51 x 10⁻¹⁰ m²/(sr xJ)"
         ),
         square_centimetre_per_steradian_erg: makeEUInformation(
            "D17",
            "cm²/(sr·erg)",
            "square centimetre per steradian erg - 10³ m²/(sr x J)"
         )
      },
      /**
       * macroscopic cross-section, volumic cross-section, volumic total cross-section, macroscopic total cross-section
       */
      "macroscopic cross-section, volumic cross-section, volumic total cross-section, macroscopic total cross-section": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * particle fluence
       */
      "particle fluence": {
         reciprocal_square_metre: makeEUInformation(
            "C93",
            "m⁻²",
            "reciprocal square metre - Synonym: reciprocal metre squared m⁻²"
         ),
         reciprocal_square_inch: makeEUInformation(
            "P78",
            "1/in²",
            "reciprocal square inch - Complement of the power of the unit inch according to the Anglo-American and Imperial system of units by exponent 2. 1,550 003 x 10³ m⁻²"
         )
      },
      /**
       * particle fluence rate, (partical flux density), neutron fluence rate, (neutronflux density), current density of particles
       */
      "particle fluence rate, (partical flux density), neutron fluence rate, (neutronflux density), current density of particles":
      {
         reciprocal_metre_squared_reciprocal_second: makeEUInformation(
            "B81",
            "m⁻²/s",
            "reciprocal metre squared reciprocal second - m⁻²/s"
         )
      },
      /**
       * energy fluence
       */
      "energy fluence": {
         joule_per_square_metre: makeEUInformation(
            "B13",
            "J/m²",
            "joule per square metre - Synonym: joule per metre squared J/m²"
         )
      },
      /**
       * energy fluence rate, (energy flux density)
       */
      "energy fluence rate, (energy flux density)": {
         watt_per_square_metre: makeEUInformation("D54", "W/m²", "watt per square metre - W/m²"),
         erg_per_square_centimetre_second: makeEUInformation(
            "A65",
            "erg/(cm²·s)",
            "erg per square centimetre second - 10⁻³ W/m²"
         )
      },
      /**
       * linear attenuation coefficient
       */
      "linear attenuation coefficient": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * mass attenuation coefficient
       */
      "mass attenuation coefficient": {
         square_metre_per_kilogram: makeEUInformation("D21", "m²/kg", "square metre per kilogram - m²/kg")
      },
      /**
       * molar attenuation coefficient
       */
      "molar attenuation coefficient": {
         square_metre_per_mole: makeEUInformation("D22", "m²/mol", "square metre per mole - m²/mol")
      },
      /**
       * atomic attenuation coefficient
       */
      "atomic attenuation coefficient": {
         square_metre: makeEUInformation("MTK", "m²", "square metre - m²")
      },
      /**
       * slowing down area, diffusion area, migration area
       */
      "slowing down area, diffusion area, migration area": {
         square_metre: makeEUInformation("MTK", "m²", "square metre - m²")
      },
      /**
       * half-thickness, half-value thickness
       */
      "half-thickness, half-value thickness": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * mean linear range, mean free path
       */
      "mean linear range, mean free path": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * slowing-down length, diffusion length, migration length
       */
      "slowing-down length, diffusion length, migration length": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * neutron yield per fission, neutron yield per absorption
       */
      "neutron yield per fission, neutron yield per absorption": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * fast fission factor
       */
      "fast fission factor": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * thermal utilization factor
       */
      "thermal utilization factor": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * non leakage probability
       */
      "non leakage probability": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * multiplication factor, infinite medium multiplication factor, effective multiplication factor
       */
      "multiplication factor, infinite medium multiplication factor, effective multiplication factor": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * diffusion coefficient for neutron fluence rate, (diffusion coefficient for neutron flux density)
       */
      "diffusion coefficient for neutron fluence rate, (diffusion coefficient for neutron flux density)": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * total linear stopping power
       */
      "total linear stopping power": {
         joule_per_metre: makeEUInformation("B12", "J/m", "joule per metre - J/m"),
         electronvolt_per_metre: makeEUInformation("A54", "eV/m", "electronvolt per metre - 1,602 176 487 x 10⁻¹⁹ J/m"),
         erg_per_centimetre: makeEUInformation("A58", "erg/cm", "erg per centimetre - 10⁻⁵ J/m")
      },
      /**
       * total atomic stopping power
       */
      "total atomic stopping power": {
         joule_square_metre: makeEUInformation("D73", "J·m²", "joule square metre - J x m²"),
         electronvolt_square_metre: makeEUInformation(
            "A55",
            "eV·m²",
            "electronvolt square metre - 1,602 176 487 x 10⁻¹⁹ J x m²"
         ),
         erg_square_centimetre: makeEUInformation("A66", "erg·cm²", "erg square centimetre - 10⁻¹¹ J x m²")
      },
      /**
       * total mass stopping power
       */
      "total mass stopping power": {
         joule_square_metre_per_kilogram: makeEUInformation("B20", "J·m²/kg", "joule square metre per kilogram - J x m²/kg"),
         electronvolt_square_metre_per_kilogram: makeEUInformation(
            "A56",
            "eV·m²/kg",
            "electronvolt square metre per kilogram - 1,602 176 487 x 10⁻¹⁹ J x m²/kg"
         ),
         erg_square_centimetre_per_gram: makeEUInformation("A67", "erg·cm²/g", "erg square centimetre per gram - 10⁻⁸ J x m²/kg")
      },
      /**
       * mean mass range
       */
      "mean mass range": {
         kilogram_per_square_metre: makeEUInformation("28", "kg/m²", "kilogram per square metre - kg/m²")
      },
      /**
       * linear ionization by a particle, total ionization by a particle
       */
      "linear ionization by a particle, total ionization by a particle": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * mobility
       */
      mobility: {
         square_metre_per_volt_second: makeEUInformation("D26", "m²/(V·s)", "square metre per volt second - m²/(V x s)"),
         metre_per_volt_second: makeEUInformation("H58", "m/(V·s)", "metre per volt second - m⁻¹ x kg⁻¹ x s² x A")
      },
      /**
       * ion number density, ion density, neutron number density
       */
      "ion number density, ion density, neutron number density": {
         reciprocal_cubic_metre: makeEUInformation("C86", "m⁻³", "reciprocal cubic metre - m⁻³")
      },
      /**
       * recombination coefficient
       */
      "recombination coefficient": {
         cubic_metre_per_second: makeEUInformation("MQS", "m³/s", "cubic metre per second - m³/s")
      },
      /**
       * neutron speed
       */
      "neutron speed": {
         metre_per_second: makeEUInformation("MTS", "m/s", "metre per second - m/s")
      },
      /**
       * diffusion coefficient, diffusion coefficient for neutron number density
       */
      "diffusion coefficient, diffusion coefficient for neutron number density": {
         square_metre_per_second: makeEUInformation(
            "S4",
            "m²/s",
            "square metre per second - Synonym: metre squared per second (square metres/second US) m²/s"
         )
      },
      /**
       * neutron source density
       */
      "neutron source density": {
         reciprocal_second_per_cubic_metre: makeEUInformation("C98", "s⁻¹/m³", "reciprocal second per cubic metre - s⁻¹/m³")
      },
      /**
       * slowing down density
       */
      "slowing down density": {
         reciprocal_cubic_metre_per_second: makeEUInformation(
            "C87",
            "m⁻³/s",
            "reciprocal cubic metre per second - Synonym: reciprocal second per cubic metre m⁻³/s"
         )
      },
      /**
       * resonance escape probability
       */
      "resonance escape probability": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * lethargy
       */
      lethargy: {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * average logarithmic energy decrement
       */
      "average logarithmic energy decrement": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * reactivity
       */
      reactivity: {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * reactor time constant
       */
      "reactor time constant": {
         "second_[unit_of_time]": makeEUInformation("SEC", "s", "second [unit of time] - s")
      },
      /**
       * activity
       */
      activity: {
         becquerel: makeEUInformation("BQL", "Bq", "becquerel - 27,027 x 10⁻¹² Ci"),
         curie: makeEUInformation("CUR", "Ci", "curie - 3,7 x 10¹⁰ Bq")
      },
      /**
       * energy imparted, mean energy imparted
       */
      "energy imparted, mean energy imparted": {
         joule: makeEUInformation("JOU", "J", "joule - J")
      },
      /**
       * specific energy imparted, massic energy imparted
       */
      "specific energy imparted, massic energy imparted": {
         gray: makeEUInformation("A95", "Gy", "gray - m²/s²"),
         milligray: makeEUInformation("C13", "mGy", "milligray - 10⁻³ Gy")
      },
      /**
       * absorbed dose
       */
      "absorbed dose": {
         rad: makeEUInformation("C80", "rad", "rad - 10⁻² Gy")
      },
      /**
       * kerma
       */
      kerma: {
         erg_per_gram: makeEUInformation("A61", "erg/g", "erg per gram - 10⁻⁴ J/kg")
      },
      /**
       * dose equivalent
       */
      "dose equivalent": {
         sievert: makeEUInformation("D13", "Sv", "sievert - m²/s²"),
         millisievert: makeEUInformation("C28", "mSv", "millisievert - 10⁻³ Sv"),
         rem: makeEUInformation("D91", "rem", "rem - 10⁻² Sv"),
         milliroentgen_aequivalent_men: makeEUInformation("L31", "mrem", "milliroentgen aequivalent men - 10⁻⁵ Sv")
      },
      /**
       * absorbed dose rate
       */
      "absorbed dose rate": {
         gray_per_second: makeEUInformation("A96", "Gy/s", "gray per second - m²/s³"),
         milligray_per_second: makeEUInformation(
            "P54",
            "mGy/s",
            "milligray per second - 0,001-fold of the derived SI unit gray divided by the SI base unit second. 10⁻³ Gy/s"
         ),
         microgray_per_second: makeEUInformation(
            "P55",
            "µGy/s",
            "microgray per second - 0,000 001-fold of the derived SI unit gray divided by the SI base unit second. 10⁻⁶ Gy/s"
         ),
         nanogray_per_second: makeEUInformation(
            "P56",
            "nGy/s",
            "nanogray per second - 0,000 000 001-fold of the derived SI unit gray divided by the SI base unit second. 10⁻⁹ Gy/s"
         ),
         gray_per_minute: makeEUInformation(
            "P57",
            "Gy/min",
            "gray per minute - SI derived unit gray divided by the unit minute. 1,666 67 × 10⁻² Gy/s"
         ),
         milligray_per_minute: makeEUInformation(
            "P58",
            "mGy/min",
            "milligray per minute - 0,001-fold of the derived SI unit gray divided by the unit minute. 1,666 67 × 10⁻⁵ Gy/s"
         ),
         microgray_per_minute: makeEUInformation(
            "P59",
            "µGy/min",
            "microgray per minute - 0,000 001-fold of the derived SI unit gray divided by the unit minute. 1,666 67 × 10⁻⁸ Gy/s"
         ),
         nanogray_per_minute: makeEUInformation(
            "P60",
            "nGy/min",
            "nanogray per minute - 0,000 000 001-fold of the derived SI unit gray divided by the unit minute. 1,666 67 × 10⁻¹¹ Gy/s"
         ),
         gray_per_hour: makeEUInformation(
            "P61",
            "Gy/h",
            "gray per hour - SI derived unit gray divided by the unit hour. 2,777 78 × 10⁻⁴ Gy/s"
         ),
         milligray_per_hour: makeEUInformation(
            "P62",
            "mGy/h",
            "milligray per hour - 0,001-fold of the derived SI unit gray divided by the unit hour. 2,777 78 × 10⁻⁷ Gy/s"
         ),
         microgray_per_hour: makeEUInformation(
            "P63",
            "µGy/h",
            "microgray per hour - 0,000 001-fold of the derived SI unit gray divided by the unit hour. 2,777 78 × 10⁻¹⁰ Gy/s"
         ),
         nanogray_per_hour: makeEUInformation(
            "P64",
            "nGy/h",
            "nanogray per hour - 0,000 000 001-fold of the derived SI unit gray divided by the unit hour. 2,777 78 × 10⁻¹³ Gy/s"
         )
      },
      /**
       * kerma rate
       */
      "kerma rate": {
         erg_per_gram_second: makeEUInformation("A62", "erg/g·s", "erg per gram second - 10⁻⁴ W/kg")
      },
      /**
       * linear energy transfer
       */
      "linear energy transfer": {
         joule_per_metre: makeEUInformation("B12", "J/m", "joule per metre - J/m"),
         electronvolt_per_metre: makeEUInformation("A54", "eV/m", "electronvolt per metre - 1,602 176 487 x 10⁻¹⁹ J/m"),
         erg_per_centimetre: makeEUInformation("A58", "erg/cm", "erg per centimetre - 10⁻⁵ J/m")
      },
      /**
       * mass energy transfer coefficient
       */
      "mass energy transfer coefficient": {
         square_metre_per_kilogram: makeEUInformation("D21", "m²/kg", "square metre per kilogram - m²/kg")
      },
      /**
       * exposure
       */
      exposure: {
         coulomb_per_kilogram: makeEUInformation("CKG", "C/kg", "coulomb per kilogram - A x s/kg"),
         millicoulomb_per_kilogram: makeEUInformation("C8", "mC/kg", "millicoulomb per kilogram - 10⁻³ C/kg"),
         roentgen: makeEUInformation("2C", "R", "roentgen - 2,58 x 10⁻⁴ C/kg"),
         milliroentgen: makeEUInformation("2Y", "mR", "milliroentgen - 2,58 x 10⁻⁷ C/kg"),
         coulomb_square_metre_per_kilogram: makeEUInformation("J53", "C·m²/kg", "coulomb square metre per kilogram - C x m²/kg"),
         kiloroentgen: makeEUInformation("KR", "kR", "kiloroentgen - 2,58 x 10⁻¹ C/kg")
      },
      /**
       * exposure rate
       */
      "exposure rate": {
         coulomb_per_kilogram_second: makeEUInformation("A31", "C/(kg·s)", "coulomb per kilogram second - A/kg"),
         roentgen_per_second: makeEUInformation("D6", "R/s", "roentgen per second - 2,58 x 10⁻⁴ C/(kg x s)")
      },
      /**
       * equivalence dose output
       */
      "equivalence dose output": {
         sievert_per_second: makeEUInformation(
            "P65",
            "Sv/s",
            "sievert per second - Derived SI unit sievert divided by the SI base unit second. Sv/s"
         ),
         millisievert_per_second: makeEUInformation(
            "P66",
            "mSv/s",
            "millisievert per second - 0,001-fold of the derived SI unit sievert divided by the SI base unit second. 10⁻³ Sv/s"
         ),
         microsievert_per_second: makeEUInformation(
            "P67",
            "µSv/s",
            "microsievert per second - 0,000 001-fold of the derived SI unit sievert divided by the SI base unit second. 10⁻⁶ Sv/s"
         ),
         nanosievert_per_second: makeEUInformation(
            "P68",
            "nSv/s",
            "nanosievert per second - 0,000 000 001-fold of the derived SI unit sievert divided by the SI base unit second. 10⁻⁹ Sv/s"
         ),
         rem_per_second: makeEUInformation(
            "P69",
            "rem/s",
            "rem per second - Unit for the equivalent tin rate relating to DIN 1301-3:1979: 1 rem/s = 0,01 J/(kg·s) = 1 Sv/s. 10⁻² Sv/s"
         ),
         sievert_per_hour: makeEUInformation(
            "P70",
            "Sv/h",
            "sievert per hour - Derived SI unit sievert divided by the unit hour. 2,777 78 × 10⁻⁴ Sv/s"
         ),
         millisievert_per_hour: makeEUInformation(
            "P71",
            "mSv/h",
            "millisievert per hour - 0,001-fold of the derived SI unit sievert divided by the unit hour. 0,277 777 778 × 10⁻⁷ Sv/s"
         ),
         microsievert_per_hour: makeEUInformation(
            "P72",
            "µSv/h",
            "microsievert per hour - 0,000 001-fold of the derived SI unit sievert divided by the unit hour. 0,277 777 778 × 10⁻¹⁰ Sv/s"
         ),
         nanosievert_per_hour: makeEUInformation(
            "P73",
            "nSv/h",
            "nanosievert per hour - 0,000 000 001-fold of the derived SI unit sievert divided by the unit hour. 0,277 777 778 × 10⁻¹³ Sv/s"
         ),
         sievert_per_minute: makeEUInformation(
            "P74",
            "Sv/min",
            "sievert per minute - Derived SI unit sievert divided by the unit minute. 0,016 666 Sv/s"
         ),
         millisievert_per_minute: makeEUInformation(
            "P75",
            "mSv/min",
            "millisievert per minute - 0,001-fold of the derived SI unit sievert divided by the unit minute. 1,666 666 667 × 10⁻⁵ Sv/s"
         ),
         microsievert_per_minute: makeEUInformation(
            "P76",
            "µSv/min",
            "microsievert per minute - 0,000 001-fold of the derived SI unit sievert divided by the unit minute. 1,666 666 667 × 10⁻⁸ Sv/s"
         ),
         nanosievert_per_minute: makeEUInformation(
            "P77",
            "nSv/min",
            "nanosievert per minute - 0,000 000 001-fold of the derived SI unit sievert divided by the unit minute. 1,666 666 667 × 10⁻¹¹ Sv/s"
         )
      }
   },
   /**
    * Characteristic Numbers (dimensionless parameters)
    */
   "Characteristic Numbers (dimensionless parameters)": {
      /**
       * Reynolds number
       */
      "Reynolds number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Euler number
       */
      "Euler number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Froude number
       */
      "Froude number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Grashof number
       */
      "Grashof number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Weber number
       */
      "Weber number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Mach number
       */
      "Mach number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Knudsen number
       */
      "Knudsen number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Strouhal number
       */
      "Strouhal number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Fourier number
       */
      "Fourier number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Peclet number
       */
      "Peclet number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Rayleigh number
       */
      "Rayleigh number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Nusselt number
       */
      "Nusselt number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Stanton number
       */
      "Stanton number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Fourier number for mass transfer
       */
      "Fourier number for mass transfer": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Peclet number for mass transfer
       */
      "Peclet number for mass transfer": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Grashof number for mass transfer
       */
      "Grashof number for mass transfer": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Nusselt number for mass transfer
       */
      "Nusselt number for mass transfer": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Stanton number for mass transfer
       */
      "Stanton number for mass transfer": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Prandtl number
       */
      "Prandtl number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Schmidt number
       */
      "Schmidt number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Lewis number
       */
      "Lewis number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * magnetic Reynolds number
       */
      "magnetic Reynolds number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Alfven number
       */
      "Alfven number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Hartmann number
       */
      "Hartmann number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Cowling number
       */
      "Cowling number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      }
   },
   /**
    * Solid State Physics
    */
   "Solid State Physics": {
      /**
       * mobility ratio
       */
      "mobility ratio": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * lattice vector, fundamental lattice vector
       */
      "lattice vector, fundamental lattice vector": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * lattice plane spacing, Burgers vector
       */
      "lattice plane spacing, Burgers vector": {
         angstrom: makeEUInformation("A11", "Å", "angstrom - 10⁻¹⁰ m")
      },
      /**
       * Bragg angle
       */
      "Bragg angle": {
         radian: makeEUInformation("C81", "rad", "radian - rad"),
         "degree_[unit_of_angle]": makeEUInformation("DD", "°", "degree [unit of angle] - 1,745 329 x 10⁻² rad")
      },
      /**
       * order of reflexion
       */
      "order of reflexion": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * short-range order parameter, long-range order parameter
       */
      "short-range order parameter, long-range order parameter": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * relaxation time, carrier life time
       */
      "relaxation time, carrier life time": {
         "second_[unit_of_time]": makeEUInformation("SEC", "s", "second [unit of time] - s")
      },
      /**
       * magnetic flux quantum
       */
      "magnetic flux quantum": {
         weber: makeEUInformation("WEB", "Wb", "weber - Wb"),
         unit_pole_: makeEUInformation(
            "P53",
            "unit pole ",
            "unit pole  - CGS (Centimetre-Gram-Second system) unit for magnetic flux of a magnetic pole (according to the interaction of identical poles of 1 dyn at a distance of a cm). 1,256 637 x 10⁻⁷ Wb"
         )
      },
      /**
       * particle position vector, equilibrium position vector of ion or atom, displacement vector of ion or atom
       */
      "particle position vector, equilibrium position vector of ion or atom, displacement vector of ion or atom": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * Debye-Walle factor
       */
      "Debye-Walle factor": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * mean free path of phonons or electrons, London penetration depth, coherence length, diffusion length
       */
      "mean free path of phonons or electrons, London penetration depth, coherence length, diffusion length": {
         metre: makeEUInformation("MTR", "m", "metre - m")
      },
      /**
       * angular repetency, angular wave number
       */
      "angular repetency, angular wave number": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * Fermi angular repetency, Fermi angular wave number
       */
      "Fermi angular repetency, Fermi angular wave number": {
         reciprocal_angstrom: makeEUInformation("C85", "Å⁻¹", "reciprocal angstrom - 10¹⁰ m⁻¹")
      },
      /**
       * Debye angular repetency, Debye angular wave number
       */
      "Debye angular repetency, Debye angular wave number": {
         radian_per_metre: makeEUInformation("C84", "rad/m", "radian per metre - rad/m")
      },
      /**
       * angular reciprocal lattice vector, fundamental reciprocal lattice vector
       */
      "angular reciprocal lattice vector, fundamental reciprocal lattice vector": {
         reciprocal_metre: makeEUInformation("C92", "m⁻¹", "reciprocal metre - m⁻¹")
      },
      /**
       * Debye angular frequency
       */
      "Debye angular frequency": {
         radian_per_second: makeEUInformation("2A", "rad/s", "radian per second - Refer ISO/TC12 SI Guide rad/s"),
         reciprocal_second: makeEUInformation("C97", "s⁻¹", "reciprocal second - s⁻¹")
      },
      /**
       * Debye temperature, Curie temperature, Néel temperature, Fermi temperature, Super conductor transition temperature
       */
      "Debye temperature, Curie temperature, Néel temperature, Fermi temperature, Super conductor transition temperature": {
         kelvin: makeEUInformation("KEL", "K", "kelvin - Refer ISO 80000-5 (Quantities and units — Part 5: Thermodynamics) K")
      },
      /**
       * spectral concentration of vibrational modes (in terms of angular frequency)
       */
      "spectral concentration of vibrational modes (in terms of angular frequency)": {
         second_per_cubic_metre_radian: makeEUInformation("D94", "s/(rad·m³)", "second per cubic metre radian - s/(rad x m³)")
      },
      /**
       * Grüneisen parameter
       */
      "Grüneisen parameter": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Madelung constant
       */
      "Madelung constant": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * Landau-Ginzburg number
       */
      "Landau-Ginzburg number": {
         one: makeEUInformation("C62", "1", "one - Synonym: unit 1")
      },
      /**
       * density of states
       */
      "density of states": {
         reciprocal_joule_per_cubic_metre: makeEUInformation("C90", "J⁻¹/m³", "reciprocal joule per cubic metre - J⁻¹/m³"),
         reciprocal_electron_volt_per_cubic_metre: makeEUInformation(
            "C88",
            "eV⁻¹/m³",
            "reciprocal electron volt per cubic metre - 6,241 46 x 10¹⁸ J⁻¹/m³"
         )
      },
      /**
       * residual resistivity
       */
      "residual resistivity": {
         ohm_metre: makeEUInformation("C61", "Ω·m", "ohm metre - Ω x m")
      },
      /**
       * Hall coefficient
       */
      "Hall coefficient": {
         cubic_metre_per_coulomb: makeEUInformation("A38", "m³/C", "cubic metre per coulomb - m³/A x s")
      },
      /**
       * thermoelectromotive force between substances a and b, Peltier coefficient for substances a and b
       */
      "thermoelectromotive force between substances a and b, Peltier coefficient for substances a and b": {
         volt: makeEUInformation("VLT", "V", "volt - V")
      },
      /**
       * thermodynamic critical magnetic flux density, lower critical magnetic flux density, upper critical magnetic flux density
       */
      "thermodynamic critical magnetic flux density, lower critical magnetic flux density, upper critical magnetic flux density":
      {
         tesla: makeEUInformation("D33", "T", "tesla - T")
      },
      /**
       * Seebeck coefficient for substances a and b
       */
      "Seebeck coefficient for substances a and b": {
         volt_per_kelvin: makeEUInformation("D48", "V/K", "volt per kelvin - V/K")
      },
      /**
       * Thompson coefficient
       */
      "Thompson coefficient": {
         millivolt_per_kelvin: makeEUInformation("D49", "mV/K", "millivolt per kelvin - 10⁻³ V/K")
      },
      /**
       * work function
       */
      "work function": {
         joule: makeEUInformation("JOU", "J", "joule - J")
      },
      /**
       * Fermi energy
       */
      "Fermi energy": {
         electronvolt: makeEUInformation("A53", "eV", "electronvolt - 1,602 176 487 x 10⁻¹⁹ J")
      },
      /**
       * gap energy
       */
      "gap energy": {
         femtojoule: makeEUInformation("A70", "fJ", "femtojoule - 10⁻¹⁵ J")
      },
      /**
       * donor ionization energy, acceptor ionization energy, exchange intergral, superconductor energy gap, electron affinity
       */
      "donor ionization energy, acceptor ionization energy, exchange intergral, superconductor energy gap, electron affinity": {
         attojoule: makeEUInformation("A13", "aJ", "attojoule - 10⁻¹⁸ J")
      },
      /**
       * Richardson constant
       */
      "Richardson constant": {
         ampere_per_square_metre_kelvin_squared: makeEUInformation(
            "A6",
            "A/(m²·K²)",
            "ampere per square metre kelvin squared - A/(m² x K²)"
         )
      },
      /**
       * electron number density, volumic electron number, hole number density, volumic hole number, donor number density, volumic donor number, intrinsic number density, volumic intrinsis number, acceptor number density, volumic acceptor number
       */
      "electron number density, volumic electron number, hole number density, volumic hole number, donor number density, volumic donor number, intrinsic number density, volumic intrinsis number, acceptor number density, volumic acceptor number":
      {
         reciprocal_cubic_metre: makeEUInformation("C86", "m⁻³", "reciprocal cubic metre - m⁻³")
      },
      /**
       * effective mass
       */
      "effective mass": {
         kilogram: makeEUInformation("KGM", "kg", "kilogram - A unit of mass equal to one thousand grams. kg")
      }
   },
   /**
    * Miscellaneous
    */
   Miscellaneous: {
      /**
       * burst index
       */
      "burst index": {
         kilopascal_square_metre_per_gram: makeEUInformation("33", "kPa·m²/g", "kilopascal square metre per gram - 10⁶ m/s²"),
         pascal_square_metre_per_kilogram: makeEUInformation(
            "P79",
            "Pa/(kg/m²)",
            "pascal square metre per kilogram - Unit of the burst index as derived unit for pressure pascal related to the substance, represented as a quotient from the SI base unit kilogram divided by the power of the SI base unit metre by exponent 2. m/s²"
         )
      },
      /**
       * hardness index
       */
      "hardness index": {
         kilopascal_per_millimetre: makeEUInformation("34", "kPa/mm", "kilopascal per millimetre - 10⁶ kg/(m² x s²)"),
         pascal_per_metre: makeEUInformation("H42", "Pa/m", "pascal per metre - m⁻² kg x s⁻²"),
         picopascal_per_kilometre: makeEUInformation("H69", "pPa/km", "picopascal per kilometre - 10⁻¹⁵ m⁻² x kg x s⁻²"),
         millipascal_per_metre: makeEUInformation(
            "P80",
            "mPa/m",
            "millipascal per metre - 0,001-fold of the derived SI unit pascal divided by the SI base unit metre. 10⁻³ kg/(m² x s²)"
         ),
         kilopascal_per_metre: makeEUInformation(
            "P81",
            "kPa/m",
            "kilopascal per metre - 1000-fold of the derived SI unit pascal divided by the SI base unit metre. 10³ kg/(m² x s²)"
         ),
         hectopascal_per_metre: makeEUInformation(
            "P82",
            "hPa/m",
            "hectopascal per metre - 100-fold of the derived SI unit pascal divided by the SI base unit metre. 10² kg/(m² x s²)"
         ),
         standard_atmosphere_per_metre: makeEUInformation(
            "P83",
            "Atm/m",
            "standard atmosphere per metre - Outdated unit of the pressure divided by the SI base unit metre. 1,013 25 x 10⁵ kg/(m² x s²)"
         ),
         technical_atmosphere_per_metre: makeEUInformation(
            "P84",
            "at/m",
            "technical atmosphere per metre - Obsolete and non-legal unit of the pressure which is generated by a 10 metre water column divided by the SI base unit metre. 9,806 65 x 10⁴  kg/(m² x s²)"
         ),
         torr_per_metre: makeEUInformation(
            "P85",
            "Torr/m",
            "torr per metre - CGS (Centimetre-Gram-Second system) unit of the pressure divided by the SI base unit metre. 1,333 224 x 10² kg/(m² x s²)"
         ),
         psi_per_inch: makeEUInformation(
            "P86",
            "psi/in",
            "psi per inch - Compound unit for pressure (pound-force according to the Anglo-American unit system divided by the power of the unit inch according to the Anglo-American and Imperial system of units with the exponent 2) divided by the unit inch according to the Anglo-American and Imperial system of units . 2,714 471 x 10⁵ kg/(m² x s²)"
         )
      },
      /**
       * porosity
       */
      porosity: {
         millilitre_per_square_centimetre_second: makeEUInformation(
            "35",
            "ml/(cm²·s)",
            "millilitre per square centimetre second - 10⁻² m/s"
         ),
         cubic_foot_per_minute_per_square_foot: makeEUInformation(
            "36",
            "ft³/(min/ft²)",
            "cubic foot per minute per square foot - Conversion factor required "
         ),
         cubic_metre_per_second_square_metre: makeEUInformation(
            "P87",
            "(m³/s)/m²",
            "cubic metre per second square metre - Unit of volume flow cubic meters by second related to the transmission surface in square metres. m/s"
         )
      }
   }
};
