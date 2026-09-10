// Automatically generated file, do not modify
import { EUInformation } from "node-opcua-types";
import { makeEUInformation }  from "node-opcua-data-access";
export const categorizedUnits = { 
 /**
  * Space and Time
  */
 'Space_and_Time': {
   /**
    * angle (plane)
    */
   'angle': {
       'radian': makeEUInformation("C81","rad","radian"),
       'milliradian': makeEUInformation("C25","mrad","milliradian"),
       'microradian': makeEUInformation("B97","µrad","microradian"),
       'degree[unit_of_angle]': makeEUInformation("DD","°","degree [unit of angle]"),
       'minute[unit_of_angle]': makeEUInformation("D61","'","minute [unit of angle]"),
       'second[unit_of_angle]': makeEUInformation("D62","\"\"","second [unit of angle]"),
       'grade': makeEUInformation("A91","gon","gon"),
       'gon': makeEUInformation("A91","gon","gon"),
       'mil': makeEUInformation("M43","mil","mil"),
       'revolution': makeEUInformation("M44","rev","revolution"),
    },
   /**
    * solid angle
    */
   'solid_angle': {
       'steradian': makeEUInformation("D27","sr","steradian"),
       'inch_per_two_pi_radiant': makeEUInformation("H57","in/revolution","inch per two pi radiant"),
       'degree_per_second': makeEUInformation("E96","°/s","degree per second"),
       'degree_per_metre': makeEUInformation("H27","°/m","degree per metre"),
       'metre_per_radiant': makeEUInformation("M55","m/rad","metre per radiant"),
    },
   /**
    * length, breadth, height, thickness, radius, radius of curvature, cartesian coordinates, diameter, length of path, distance
    */
   'length': {
       'metre': makeEUInformation("MTR","m","metre"),
       'decimetre': makeEUInformation("DMT","dm","decimetre"),
       'centimetre': makeEUInformation("CMT","cm","centimetre"),
       'micrometre(micron)': makeEUInformation("4H","µm","micrometre (micron)"),
       'millimetre': makeEUInformation("MMT","mm","millimetre"),
       'hectometre': makeEUInformation("HMT","hm","hectometre"),
       'kilometre': makeEUInformation("KMT","km","kilometre"),
       'nanometre': makeEUInformation("C45","nm","nanometre"),
       'picometre': makeEUInformation("C52","pm","picometre"),
       'femtometre': makeEUInformation("A71","fm","femtometre"),
       'decametre': makeEUInformation("A45","dam","decametre"),
       'nautical_mile': makeEUInformation("NMI","n mile","nautical mile"),
       'angstrom': makeEUInformation("A11","Å","angstrom"),
       'astronomical_unit': makeEUInformation("A12","ua","astronomical unit"),
       'parsec': makeEUInformation("C63","pc","parsec"),
       'metre_per_kelvin': makeEUInformation("F52","m/K","metre per kelvin"),
       'micrometre_per_kelvin': makeEUInformation("F50","µm/K","micrometre per kelvin"),
       'centimetre_per_kelvin': makeEUInformation("F51","cm/K","centimetre per kelvin"),
       'millimetre_per_bar': makeEUInformation("G06","mm/bar","millimetre per bar"),
       'gram_millimetre': makeEUInformation("H84","g·mm","gram millimetre"),
       'centimetre_per_bar': makeEUInformation("G04","cm/bar","centimetre per bar"),
       'metre_per_bar': makeEUInformation("G05","m/bar","metre per bar"),
       'French_gauge': makeEUInformation("H79","Fg","French gauge"),
       'fathom': makeEUInformation("AK","fth","fathom"),
       'Gunters_chain': makeEUInformation("X1","ch (UK)","Gunter's chain"),
       'inch': makeEUInformation("INH","in","inch"),
       'micro-inch': makeEUInformation("M7","µin","micro-inch"),
       'foot': makeEUInformation("FOT","ft","foot"),
       'yard': makeEUInformation("YRD","yd","yard"),
       'mile(statute_mile)': makeEUInformation("SMI","mile","mile (statute mile)"),
       'milli-inch': makeEUInformation("77","mil","milli-inch"),
       'light_year': makeEUInformation("B57","ly","light year"),
       'rod[unit_of_distance]': makeEUInformation("F49","rd (US)","rod [unit of distance]"),
       'megametre': makeEUInformation("MAM","Mm","megametre"),
       'foot_per_degree_Fahrenheit': makeEUInformation("K13","ft/°F","foot per degree Fahrenheit"),
       'foot_per_psi': makeEUInformation("K17","ft/psi","foot per psi"),
       'inch_per_degree_Fahrenheit': makeEUInformation("K45","in/°F","inch per degree Fahrenheit"),
       'inch_per_psi': makeEUInformation("K46","in/psi","inch per psi"),
       'yard_per_degree_Fahrenheit': makeEUInformation("L98","yd/°F","yard per degree Fahrenheit"),
       'yard_per_psi': makeEUInformation("L99","yd/psi","yard per psi"),
       'chain(based_on_U.S._survey_foot)': makeEUInformation("M49","ch (US survey)","chain (based on U.S. survey foot)"),
       'furlong': makeEUInformation("M50","fur","furlong"),
       'foot(U.S._survey)_': makeEUInformation("M51","ft (US survey)","foot (U.S. survey)"),
       'mile(based_on_U.S._survey_foot)_': makeEUInformation("M52","mi (US survey)","mile (based on U.S. survey foot)"),
       'metre_per_pascal': makeEUInformation("M53","m/Pa","metre per pascal"),
       'american_wire_gauge': makeEUInformation("AWG","AWG","american wire gauge"),
    },
   /**
    * area
    */
   'area': {
       'square_metre': makeEUInformation("MTK","m²","square metre"),
       'square_kilometre': makeEUInformation("KMK","km²","square kilometre"),
       'square_micrometre(square_micron)': makeEUInformation("H30","µm²","square micrometre (square micron)"),
       'square_metre_per_newton': makeEUInformation("H59","m²/N","square metre per newton"),
       'decare': makeEUInformation("DAA","daa","decare"),
       'square_centimetre': makeEUInformation("CMK","cm²","square centimetre"),
       'square_decimetre': makeEUInformation("DMK","dm²","square decimetre"),
       'square_decametre': makeEUInformation("H16","dam²","square decametre"),
       'square_hectometre': makeEUInformation("H18","hm²","square hectometre"),
       'square_millimetre': makeEUInformation("MMK","mm²","square millimetre"),
       'are': makeEUInformation("ARE","a","are"),
       'hectare': makeEUInformation("HAR","ha","hectare"),
       'square_inch': makeEUInformation("INK","in²","square inch"),
       'square_foot': makeEUInformation("FTK","ft²","square foot"),
       'square_yard': makeEUInformation("YDK","yd²","square yard"),
       'square_mile(statute_mile)': makeEUInformation("MIK","mi²","square mile (statute mile)"),
       'square_mile(based_on_U.S._survey_foot)_': makeEUInformation("M48","mi² (US survey)","square mile (based on U.S. survey foot)"),
       'acre': makeEUInformation("ACR","acre","acre"),
       'circular_mil_': makeEUInformation("M47","cmil","circular mil"),
    },
   /**
    * volume
    */
   'volume': {
       'cubic_metre': makeEUInformation("MTQ","m³","cubic metre"),
       'megalitre': makeEUInformation("MAL","Ml","megalitre"),
       'litre': makeEUInformation("LTR","l","litre"),
       'cubic_millimetre': makeEUInformation("MMQ","mm³","cubic millimetre"),
       'cubic_centimetre': makeEUInformation("CMQ","cm³","cubic centimetre"),
       'cubic_decimetre': makeEUInformation("DMQ","dm³","cubic decimetre"),
       'millilitre': makeEUInformation("MLT","ml","millilitre"),
       'hectolitre': makeEUInformation("HLT","hl","hectolitre"),
       'centilitre': makeEUInformation("CLT","cl","centilitre"),
       'cubic_decametre': makeEUInformation("DMA","dam³","cubic decametre"),
       'cubic_hectometre': makeEUInformation("H19","hm³","cubic hectometre"),
       'cubic_kilometre': makeEUInformation("H20","km³","cubic kilometre"),
       'cubic_metre_per_pascal': makeEUInformation("M71","m³/Pa","cubic metre per pascal"),
       'decilitre': makeEUInformation("DLT","dl","decilitre"),
       'microlitre': makeEUInformation("4G","µl","microlitre"),
       'kilolitre': makeEUInformation("K6","kl","kilolitre"),
       'decalitre': makeEUInformation("A44","dal","decalitre"),
       'cubic_centimetre_per_bar': makeEUInformation("G94","cm³/bar","cubic centimetre per bar"),
       'litre_per_bar': makeEUInformation("G95","l/bar","litre per bar"),
       'cubic_metre_per_bar': makeEUInformation("G96","m³/bar","cubic metre per bar"),
       'millilitre_per_bar': makeEUInformation("G97","ml/bar","millilitre per bar"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 5I. displayName/description below are node-opcua's own, from UNECE rec20. */
       'standard_cubic_foot': makeEUInformation("5I","std","standard cubic foot - Use standard (common code WSD) (4,672 m³)"),
       'cubic_inch': makeEUInformation("INQ","in³","cubic inch"),
       'cubic_foot': makeEUInformation("FTQ","ft³","cubic foot"),
       'cubic_yard': makeEUInformation("YDQ","yd³","cubic yard"),
       'gallon(UK)': makeEUInformation("GLI","gal (UK)","gallon (UK)"),
       'gallon(US)': makeEUInformation("GLL","gal (US)","gallon (US)"),
       'pint(US)': makeEUInformation("PT","pt (US)","pint (US)"),
       'pint(UK)': makeEUInformation("PTI","pt (UK)","pint (UK)"),
       'quart(UK)': makeEUInformation("QTI","qt (UK)","quart (UK)"),
       'liquid_pint(US)': makeEUInformation("PTL","liq pt (US)","liquid pint (US)"),
       'liquid_quart(US)': makeEUInformation("QTL","liq qt (US)","liquid quart (US)"),
       'dry_pint(US)': makeEUInformation("PTD","dry pt (US)","dry pint (US)"),
       'fluid_ounce(UK)': makeEUInformation("OZI","fl oz (UK)","fluid ounce (UK)"),
       'quart(US)': makeEUInformation("QT","qt (US)","quart (US)"),
       'barrel(UK_petroleum)': makeEUInformation("J57","bbl (UK liq.)","barrel (UK petroleum)"),
       'cubic_foot_per_degree_Fahrenheit': makeEUInformation("K21","ft³/°F","cubic foot per degree Fahrenheit"),
       'cubic_foot_per_psi': makeEUInformation("K23","ft³/psi","cubic foot per psi"),
       'peck(UK)': makeEUInformation("L43","pk (UK)","peck (UK)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code L61. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pint(US_dry)': makeEUInformation("L61","pt (US dry)","pint (US dry) - Use dry pint (common code PTD) (5,506 105 x 10⁻⁴ m³)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code L62. displayName/description below are node-opcua's own, from UNECE rec20. */
       'quart(US_dry)': makeEUInformation("L62","qt (US dry)","quart (US dry) - Use dry quart (US) (common code QTD) (1,101 221 x 10⁻³ m³)"),
       'ton(UK_shipping)': makeEUInformation("L84","British shipping ton","ton (UK shipping)"),
       'ton(US_shipping)': makeEUInformation("L86","(US) shipping ton","ton (US shipping)"),
       'cubic_yard_per_degree_Fahrenheit': makeEUInformation("M11","yd³/°F","cubic yard per degree Fahrenheit"),
       'cubic_yard_per_psi': makeEUInformation("M14","yd³/psi","cubic yard per psi"),
       'fluid_ounce(US)': makeEUInformation("OZA","fl oz (US)","fluid ounce (US)"),
       'bushel(UK)': makeEUInformation("BUI","bushel (UK)","bushel (UK)"),
       'bushel(US)': makeEUInformation("BUA","bu (US)","bushel (US)"),
       'barrel(US)': makeEUInformation("BLL","barrel (US)","barrel (US)"),
       'dry_barrel(US)': makeEUInformation("BLD","bbl (US)","dry barrel (US)"),
       'dry_gallon(US)': makeEUInformation("GLD","dry gal (US)","dry gallon (US)"),
       'dry_quart(US)': makeEUInformation("QTD","dry qt (US)","dry quart (US)"),
       'stere': makeEUInformation("G26","st","stere"),
       'cup[unit_of_volume]': makeEUInformation("G21","cup (US)","cup [unit of volume]"),
       'tablespoon(US)': makeEUInformation("G24","tablespoon (US)","tablespoon (US)"),
       'teaspoon(US)': makeEUInformation("G25","teaspoon (US)","teaspoon (US)"),
       'peck': makeEUInformation("G23","pk (US)","peck"),
       'acre-foot(based_on_U.S._survey_foot)': makeEUInformation("M67","acre-ft (US survey)","acre-foot (based on U.S. survey foot)"),
       'cord(128_ft3)': makeEUInformation("M68","cord","cord (128 ft3)"),
       'cubic_mile(UK_statute)': makeEUInformation("M69","mi³","cubic mile (UK statute)"),
       'ton(register_)': makeEUInformation("M70","RT","ton"),
       'femtolitre': makeEUInformation("Q32","fl","femtolitre"),
       'picolitre': makeEUInformation("Q33","pl","picolitre"),
       'nanolitre': makeEUInformation("Q34","nl","nanolitre"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NM3. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Normalised_cubic_metre': makeEUInformation("NM3","","Normalised cubic metre - Normalised cubic metre (temperature 0°C and pressure 101325 millibars ) (m3)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SM3. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Standard_cubic_metre': makeEUInformation("SM3","","Standard cubic metre - Standard cubic metre (temperature 15°C and pressure 101325 millibars ) (m3)"),
    },
   /**
    * volume per temperature
    */
   'volume_per_temperature': {
       'cubic_centimetre_per_kelvin': makeEUInformation("G27","cm³/K","cubic centimetre per kelvin"),
       'cubic_metre_per_kelvin': makeEUInformation("G29","m³/K","cubic metre per kelvin"),
       'litre_per_kelvin': makeEUInformation("G28","l/K","litre per kelvin"),
       'millilitre_per_kelvin': makeEUInformation("G30","ml/K","millilitre per kelvin"),
    },
   /**
    * volume ratio
    */
   'volume_ratio': {
       'microlitre_per_litre': makeEUInformation("J36","µl/l","microlitre per litre"),
       'cubic_centimetre_per_cubic_metre': makeEUInformation("J87","cm³/m³","cubic centimetre per cubic metre"),
       'cubic_decimetre_per_cubic_metre': makeEUInformation("J91","dm³/m³","cubic decimetre per cubic metre"),
       'litre_per_litre': makeEUInformation("K62","l/l","litre per litre"),
       'millilitre_per_litre': makeEUInformation("L19","ml/l","millilitre per litre"),
       'cubic_millimetre_per_cubic_metre': makeEUInformation("L21","mm³/m³","cubic millimetre per cubic metre"),
    },
   /**
    * time
    */
   'time': {
       'second[unit_of_time]': makeEUInformation("SEC","s","second [unit of time]"),
       'minute[unit_of_time]': makeEUInformation("MIN","min","minute [unit of time]"),
       'hour': makeEUInformation("HUR","h","hour"),
       'day': makeEUInformation("DAY","d","day"),
       'kilosecond': makeEUInformation("B52","ks","kilosecond"),
       'millisecond': makeEUInformation("C26","ms","millisecond"),
       'picosecond': makeEUInformation("H70","ps","picosecond"),
       'microsecond': makeEUInformation("B98","µs","microsecond"),
       'nanosecond': makeEUInformation("C47","ns","nanosecond"),
       'week': makeEUInformation("WEE","wk","week"),
       'month': makeEUInformation("MON","mo","month"),
       'year': makeEUInformation("ANN","y","year"),
       'tropical_year': makeEUInformation("D42","y (tropical)","tropical year"),
       'common_year': makeEUInformation("L95","y (365 days)","common year"),
       'sidereal_year': makeEUInformation("L96","y (sidereal)","sidereal year"),
       'shake': makeEUInformation("M56","shake","shake"),
    },
   /**
    * angular velocity
    */
   'angular_velocity': {
       'radian_per_second': makeEUInformation("2A","rad/s","radian per second"),
       'revolution_per_minute_': makeEUInformation("M46","r/min","revolution per minute"),
    },
   /**
    * angular acceleration
    */
   'angular_acceleration': {
       'radian_per_second_squared': makeEUInformation("2B","rad/s²","radian per second squared"),
       'degree[unit_of_angle]_per_second_squared': makeEUInformation("M45","°/s²","degree [unit of angle] per second squared"),
    },
   /**
    * velocity, phase velocity, group velocity
    */
   'velocity': {
       'metre_per_second': makeEUInformation("MTS","m/s","metre per second"),
       'knot': makeEUInformation("KNT","kn","knot"),
       'kilometre_per_hour': makeEUInformation("KMH","km/h","kilometre per hour"),
       'millimetre_per_second': makeEUInformation("C16","mm/s","millimetre per second"),
       'centimetre_per_second': makeEUInformation("2M","cm/s","centimetre per second"),
       'centimetre_per_hour': makeEUInformation("H49","cm/h","centimetre per hour"),
       'millimetre_per_minute': makeEUInformation("H81","mm/min","millimetre per minute"),
       'metre_per_minute': makeEUInformation("2X","m/min","metre per minute"),
       'metre_per_second_pascal': makeEUInformation("M59","(m/s)/Pa","metre per second pascal"),
       'millimetre_per_year': makeEUInformation("H66","mm/y","millimetre per year"),
       'millimetre_per_hour': makeEUInformation("H67","mm/h","millimetre per hour"),
       'foot_per_minute': makeEUInformation("FR","ft/min","foot per minute"),
       'inch_per_second': makeEUInformation("IU","in/s","inch per second"),
       'foot_per_second': makeEUInformation("FS","ft/s","foot per second"),
       'mile_per_hour(statute_mile)': makeEUInformation("HM","mile/h","mile per hour (statute mile)"),
       'centimetre_per_second_kelvin': makeEUInformation("J84","(cm/s)/K","centimetre per second kelvin"),
       'centimetre_per_second_bar': makeEUInformation("J85","(cm/s)/bar","centimetre per second bar"),
       'foot_per_hour': makeEUInformation("K14","ft/h","foot per hour"),
       'foot_per_second_degree_Fahrenheit': makeEUInformation("K18","(ft/s)/°F","foot per second degree Fahrenheit"),
       'foot_per_second_psi': makeEUInformation("K19","(ft/s)/psi","foot per second psi"),
       'inch_per_second_degree_Fahrenheit': makeEUInformation("K47","(in/s)/°F","inch per second degree Fahrenheit"),
       'inch_per_second_psi': makeEUInformation("K48","(in/s)/psi","inch per second psi"),
       'metre_per_second_kelvin': makeEUInformation("L12","(m/s)/K","metre per second kelvin"),
       'metre_per_second_bar': makeEUInformation("L13","(m/s)/bar","metre per second bar"),
       'millilitre_per_square_centimetre_minute': makeEUInformation("M22","(ml/min)/cm²","millilitre per square centimetre minute"),
       'mile_per_minute_': makeEUInformation("M57","mi/min","mile per minute"),
       'mile_per_second_': makeEUInformation("M58","mi/s","mile per second"),
       'metre_per_hour': makeEUInformation("M60","m/h","metre per hour"),
       'inch_per_year': makeEUInformation("M61","in/y","inch per year"),
       'kilometre_per_second_': makeEUInformation("M62","km/s","kilometre per second"),
       'inch_per_minute': makeEUInformation("M63","in/min","inch per minute"),
       'yard_per_second': makeEUInformation("M64","yd/s","yard per second"),
       'yard_per_minute': makeEUInformation("M65","yd/min","yard per minute"),
       'yard_per_hour': makeEUInformation("M66","yd/h","yard per hour"),
    },
   /**
    * acceleration, acceleration of free fall, acceleration due to gravity
    */
   'acceleration': {
       'metre_per_second_squared': makeEUInformation("MSK","m/s²","metre per second squared"),
       'gal': makeEUInformation("A76","Gal","gal"),
       'milligal': makeEUInformation("C11","mGal","milligal"),
       'kilometre_per_second_squared': makeEUInformation("M38","km/s²","kilometre per second squared"),
       'centimetre_per_second_squared': makeEUInformation("M39","cm/s²","centimetre per second squared"),
       'millimetre_per_second_squared': makeEUInformation("M41","mm/s²","millimetre per second squared"),
       'foot_per_second_squared': makeEUInformation("A73","ft/s²","foot per second squared"),
       'inch_per_second_squared': makeEUInformation("IV","in/s²","inch per second squared"),
       'standard_acceleration_of_free_fall': makeEUInformation("K40","gn","standard acceleration of free fall"),
       'yard_per_second_squared': makeEUInformation("M40","yd/s²","yard per second squared"),
       'mile(statute_mile)_per_second_squared': makeEUInformation("M42","mi/s²","mile (statute mile) per second squared"),
    },
   /**
    * curvature
    */
   'curvature': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
  },
 /**
  * Periodic and related phenomena
  */
 'Periodic_and_related_phenomena': {
   /**
    * frequency
    */
   'frequency': {
       'hertz': makeEUInformation("HTZ","Hz","hertz"),
       'kilohertz': makeEUInformation("KHZ","kHz","kilohertz"),
       'megahertz': makeEUInformation("MHZ","MHz","megahertz"),
       'terahertz': makeEUInformation("D29","THz","terahertz"),
       'gigahertz': makeEUInformation("A86","GHz","gigahertz"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MTZ. displayName/description below are node-opcua's own, from UNECE rec20. */
       'millihertz': makeEUInformation("MTZ","mHz","millihertz - A unit of frequency equal to 0.001 cycle per second (10-3 Hz)"),
       'reciprocal_hour': makeEUInformation("H10","1/h","reciprocal hour"),
       'reciprocal_month': makeEUInformation("H11","1/mo","reciprocal month"),
       'reciprocal_year': makeEUInformation("H09","1/y","reciprocal year"),
       'reciprocal_week': makeEUInformation("H85","1/wk","reciprocal week"),
       'oscillations_per_minute': makeEUInformation("OPM","o/min","oscillations per minute"),
    },
   /**
    * rotational frequency
    */
   'rotational_frequency': {
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
       'revolutions_per_second': makeEUInformation("RPS","r/s","revolutions per second"),
       'revolutions_per_minute': makeEUInformation("RPM","r/min","revolutions per minute"),
       'reciprocal_minute': makeEUInformation("C94","min⁻¹","reciprocal minute"),
    },
   /**
    * angular frequency, pulsatance
    */
   'angular_frequency': {
       'radian_per_second': makeEUInformation("2A","rad/s","radian per second"),
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
    },
   /**
    * wavelength
    */
   'wavelength': {
       'metre': makeEUInformation("MTR","m","metre"),
       'angstrom': makeEUInformation("A11","Å","angstrom"),
    },
   /**
    * wave number, attenuation coefficient, phase coefficient, propagation coefficient, repetency
    */
   'wave_number': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * level of a field quantity, level of a power quantity
    */
   'level_of_a_field_quantity': {
       'neper': makeEUInformation("C50","Np","neper"),
       'decibel': makeEUInformation("2N","dB","decibel"),
       'bel': makeEUInformation("M72","B","bel"),
    },
   /**
    * damping coefficient
    */
   'damping_coefficient': {
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
       'neper_per_second': makeEUInformation("C51","Np/s","neper per second"),
    },
   /**
    * logarithmic decrement
    */
   'logarithmic_decrement': {
       'neper': makeEUInformation("C50","Np","neper"),
    },
  },
 /**
  * Mechanics
  */
 'Mechanics': {
   /**
    * mass
    */
   'mass': {
       'kilogram': makeEUInformation("KGM","kg","kilogram"),
       'microgram': makeEUInformation("MC","µg","microgram"),
       'decagram': makeEUInformation("DJ","dag","decagram"),
       'decigram': makeEUInformation("DG","dg","decigram"),
       'gram': makeEUInformation("GRM","g","gram"),
       'centigram': makeEUInformation("CGM","cg","centigram"),
       'tonne(metric_ton)': makeEUInformation("TNE","t","tonne (metric ton)"),
       'decitonne': makeEUInformation("DTN","dt or dtn","decitonne"),
       'milligram': makeEUInformation("MGM","mg","milligram"),
       'hectogram': makeEUInformation("HGM","hg","hectogram"),
       'kilotonne': makeEUInformation("KTN","kt","kilotonne"),
       'megagram': makeEUInformation("2U","Mg","megagram"),
       'pound': makeEUInformation("LBR","lb","pound"),
       'grain': makeEUInformation("GRN","gr","grain"),
       'ounce(avoirdupois)': makeEUInformation("ONZ","oz","ounce (avoirdupois)"),
       'hundred_weight(UK)': makeEUInformation("CWI","cwt (UK)","hundred weight (UK)"),
       'hundred_pound(cwt)_/_hundred_weight_(US)': makeEUInformation("CWA","cwt (US)","hundred pound (cwt) / hundred weight (US)"),
       'ton(UK)_or_long_ton_(US)': makeEUInformation("LTN","ton (UK)","ton (UK) or long ton (US)"),
       'stone(UK)': makeEUInformation("STI","st","stone (UK)"),
       'ton(US)_or_short_ton_(UK/US)': makeEUInformation("STN","ton (US)","ton (US) or short ton (UK/US)"),
       'troy_ounce_or_apothecary_ounce': makeEUInformation("APZ","tr oz","troy ounce or apothecary ounce"),
       'slug': makeEUInformation("F13","slug","slug"),
       'pound(avoirdupois)_per_degree_Fahrenheit': makeEUInformation("K64","lb/°F","pound (avoirdupois) per degree Fahrenheit"),
       'tonne_per_kelvin': makeEUInformation("L69","t/K","tonne per kelvin"),
       'ton_short_per_degree_Fahrenheit': makeEUInformation("L87","ton (US)/°F","ton short per degree Fahrenheit"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code M85. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ton(assay)': makeEUInformation("M85","","ton, assay - Non SI-conforming unit of the mass used in the mineralogy to determine the concentration of precious metals in ore according to the mass of the precious metal in milligrams in a sample of the mass of an assay sound (number of troy ounces in a short ton (1 000 lb)). (2,916 667 x 10⁻² kg)"),
       'pfund': makeEUInformation("M86","pfd","pfund"),
    },
   /**
    * density, mass density, volumic mass
    */
   'density': {
       'kilogram_per_cubic_metre': makeEUInformation("KMQ","kg/m³","kilogram per cubic metre"),
       'gram_per_cubic_centimetre': makeEUInformation("23","g/cm³","gram per cubic centimetre"),
       'tonne_per_cubic_metre': makeEUInformation("D41","t/m³","tonne per cubic metre"),
       'gram_per_millilitre': makeEUInformation("GJ","g/ml","gram per millilitre"),
       'kilogram_per_litre': makeEUInformation("B35","kg/l or kg/L","kilogram per litre"),
       'gram_per_litre': makeEUInformation("GL","g/l","gram per litre"),
       'gram_per_cubic_metre': makeEUInformation("A93","g/m³","gram per cubic metre"),
       'milligram_per_cubic_metre': makeEUInformation("GP","mg/m³","milligram per cubic metre"),
       'megagram_per_cubic_metre': makeEUInformation("B72","Mg/m³","megagram per cubic metre"),
       'kilogram_per_cubic_decimetre': makeEUInformation("B34","kg/dm³","kilogram per cubic decimetre"),
       'milligram_per_gram': makeEUInformation("H64","mg/g","milligram per gram"),
       'microgram_per_litre': makeEUInformation("H29","µg/l","microgram per litre"),
       'milligram_per_litre': makeEUInformation("M1","mg/l","milligram per litre"),
       'microgram_per_cubic_metre': makeEUInformation("GQ","µg/m³","microgram per cubic metre"),
       'gram_per_cubic_centimetre_bar': makeEUInformation("G11","g/(cm³·bar)","gram per cubic centimetre bar"),
       'gram_per_cubic_centimetre_kelvin': makeEUInformation("G33","g/(cm³·K)","gram per cubic centimetre kelvin"),
       'gram_per_cubic_decimetre': makeEUInformation("F23","g/dm³","gram per cubic decimetre"),
       'gram_per_cubic_decimetre_bar': makeEUInformation("G12","g/(dm³·bar)","gram per cubic decimetre bar"),
       'gram_per_cubic_decimetre_kelvin': makeEUInformation("G34","g/(dm³·K)","gram per cubic decimetre kelvin"),
       'gram_per_cubic_metre_bar': makeEUInformation("G14","g/(m³·bar)","gram per cubic metre bar"),
       'gram_per_cubic_metre_kelvin': makeEUInformation("G36","g/(m³·K)","gram per cubic metre kelvin"),
       'gram_per_litre_bar': makeEUInformation("G13","g/(l·bar)","gram per litre bar"),
       'gram_per_litre_kelvin': makeEUInformation("G35","g/(l·K)","gram per litre kelvin"),
       'gram_per_millilitre_bar': makeEUInformation("G15","g/(ml·bar)","gram per millilitre bar"),
       'gram_per_millilitre_kelvin': makeEUInformation("G37","g/(ml·K)","gram per millilitre kelvin"),
       'kilogram_per_cubic_centimetre': makeEUInformation("G31","kg/cm³","kilogram per cubic centimetre"),
       'kilogram_per_cubic_centimetre_bar': makeEUInformation("G16","kg/(cm³·bar)","kilogram per cubic centimetre bar"),
       'kilogram_per_cubic_centimetre_kelvin': makeEUInformation("G38","kg/(cm³·K)","kilogram per cubic centimetre kelvin"),
       'kilogram_per_cubic_metre_bar': makeEUInformation("G18","kg/(m³·bar)","kilogram per cubic metre bar"),
       'kilogram_per_cubic_metre_kelvin': makeEUInformation("G40","kg/(m³·K)","kilogram per cubic metre kelvin"),
       'kilogram_per_cubic_decimetre_kelvin': makeEUInformation("H54","(kg/dm³)/K","kilogram per cubic decimetre kelvin"),
       'kilogram_per_cubic_decimetre_bar': makeEUInformation("H55","(kg/dm³)/bar","kilogram per cubic decimetre bar"),
       'gram_per_kelvin': makeEUInformation("F14","g/K","gram per kelvin"),
       'kilogram_per_kelvin': makeEUInformation("F15","kg/K","kilogram per kelvin"),
       'kilogram_per_kilomole': makeEUInformation("F24","kg/kmol","kilogram per kilomol"),
       'kilogram_per_litre_bar': makeEUInformation("G17","kg/(l·bar)","kilogram per litre bar"),
       'kilogram_per_litre_kelvin': makeEUInformation("G39","kg/(l·K)","kilogram per litre kelvin"),
       'kilogram_per_bar': makeEUInformation("H53","kg/bar","kilogram per bar"),
       'kilogram_square_centimetre': makeEUInformation("F18","kg·cm²","kilogram square centimetre"),
       'kilogram_square_millimetre': makeEUInformation("F19","kg·mm²","kilogram square millimetre"),
       'gram_per_bar': makeEUInformation("F74","g/bar","gram per bar"),
       'milligram_per_bar': makeEUInformation("F75","mg/bar","milligram per bar"),
       'milligram_per_kelvin': makeEUInformation("F16","mg/K","milligram per kelvin"),
       'kilogram_per_cubic_metre_pascal': makeEUInformation("M73","(kg/m³)/Pa","kilogram per cubic metre pascal"),
       'pound_per_cubic_foot': makeEUInformation("87","lb/ft³","pound per cubic foot"),
       'pound_per_gallon(US)': makeEUInformation("GE","lb/gal (US)","pound per gallon (US)"),
       'pound_per_cubic_inch': makeEUInformation("LA","lb/in³","pound per cubic inch"),
       'ounce(avoirdupois)_per_cubic_yard': makeEUInformation("G32","oz/yd³","ounce (avoirdupois) per cubic yard"),
       'microgram_per_cubic_metre_kelvin': makeEUInformation("J34","(µg/m³)/K","microgram per cubic metre kelvin"),
       'microgram_per_cubic_metre_bar': makeEUInformation("J35","(µg/m³)/bar","microgram per cubic metre bar"),
       'grain_per_gallon(US)': makeEUInformation("K41","gr/gal (US)","grain per gallon (US)"),
       'pound(avoirdupois)_per_cubic_foot_degree_Fahrenheit': makeEUInformation("K69","(lb/ft³)/°F","pound (avoirdupois) per cubic foot degree Fahrenheit"),
       'pound(avoirdupois)_per_cubic_foot_psi': makeEUInformation("K70","(lb/ft³)/psi","pound (avoirdupois) per cubic foot psi"),
       'pound(avoirdupois)_per_gallon_(UK)': makeEUInformation("K71","lb/gal (UK)","pound (avoirdupois) per gallon (UK)"),
       'pound(avoirdupois)_per_cubic_inch_degree_Fahrenheit': makeEUInformation("K75","(lb/in³)/°F","pound (avoirdupois) per cubic inch degree Fahrenheit"),
       'pound(avoirdupois)_per_cubic_inch_psi': makeEUInformation("K76","(lb/in³)/psi","pound (avoirdupois) per cubic inch psi"),
       'pound_per_cubic_yard': makeEUInformation("K84","lb/yd³","pound per cubic yard"),
       'milligram_per_cubic_metre_kelvin': makeEUInformation("L17","(mg/m³)/K","milligram per cubic metre kelvin"),
       'milligram_per_cubic_metre_bar': makeEUInformation("L18","(mg/m³)/bar","milligram per cubic metre bar"),
       'ounce(avoirdupois)_per_gallon_(UK)': makeEUInformation("L37","oz/gal (UK)","ounce (avoirdupois) per gallon (UK)"),
       'ounce(avoirdupois)_per_gallon_(US)': makeEUInformation("L38","oz/gal (US)","ounce (avoirdupois) per gallon (US)"),
       'ounce(avoirdupois)_per_cubic_inch': makeEUInformation("L39","oz/in³","ounce (avoirdupois) per cubic inch"),
       'slug_per_cubic_foot': makeEUInformation("L65","slug/ft³","slug per cubic foot"),
       'tonne_per_cubic_metre_kelvin': makeEUInformation("L76","(t/m³)/K","tonne per cubic metre kelvin"),
       'tonne_per_cubic_metre_bar': makeEUInformation("L77","(t/m³)/bar","tonne per cubic metre bar"),
       'ton(UK_long)_per_cubic_yard': makeEUInformation("L92","ton.l/yd³ (UK)","ton (UK long) per cubic yard"),
       'ton(US_short)_per_cubic_yard': makeEUInformation("L93","ton.s/yd³ (US)","ton (US short) per cubic yard"),
       'pound(avoirdupois)_per_psi': makeEUInformation("K77","lb/psi","pound (avoirdupois) per psi"),
       'tonne_per_bar': makeEUInformation("L70","t/bar","tonne per bar"),
       'ton_short_per_psi': makeEUInformation("L91","ton (US)/psi","ton short per psi"),
       'kilogram_per_pascal': makeEUInformation("M74","kg/Pa","kilogram per pascal"),
    },
   /**
    * relative density, relative mass density
    */
   'relative_density': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * specific volume, massic volume
    */
   'specific_volume': {
       'cubic_metre_per_kilogram': makeEUInformation("A39","m³/kg","cubic metre per kilogram"),
       'decilitre_per_gram': makeEUInformation("22","dl/g","decilitre per gram"),
       'millilitre_per_cubic_metre': makeEUInformation("H65","ml/m³","millilitre per cubic metre"),
       'litre_per_kilogram': makeEUInformation("H83","l/kg","litre per kilogram"),
       'millilitre_per_kilogram': makeEUInformation("KX","ml/kg","millilitre per kilogram"),
       'square_centimetre_per_gram': makeEUInformation("H15","cm²/g","square centimetre per gram"),
       'cubic_decimetre_per_kilogram': makeEUInformation("N28","dm³/kg","cubic decimetre per kilogram"),
       'cubic_foot_per_pound': makeEUInformation("N29","ft³/lb","cubic foot per pound"),
       'cubic_inch_per_pound': makeEUInformation("N30","in³/lb","cubic inch per pound"),
    },
   /**
    * linear density, linear mass
    */
   'linear_density': {
       'kilogram_per_metre': makeEUInformation("KL","kg/m","kilogram per metre"),
       'gram_per_metre(gram_per_100_centimetres)': makeEUInformation("GF","g/m","gram per metre (gram per 100 centimetres)"),
       'gram_per_millimetre': makeEUInformation("H76","g/mm","gram per millimetre"),
       'kilogram_per_millimetre': makeEUInformation("KW","kg/mm","kilogram per millimetre"),
       'milligram_per_metre': makeEUInformation("C12","mg/m","milligram per metre"),
       'kilogram_per_kilometre': makeEUInformation("M31","kg/km","kilogram per kilometre"),
       'pound_per_foot': makeEUInformation("P2","lb/ft","pound per foot"),
       'pound_per_inch_of_length': makeEUInformation("PO","lb/in","pound per inch of length"),
       'denier_': makeEUInformation("M83","den","denier"),
       'pound_per_yard_': makeEUInformation("M84","lb/yd","pound per yard"),
    },
   /**
    * surface density, areic mass
    */
   'surface_density': {
       'milligram_per_square_metre': makeEUInformation("GO","mg/m²","milligram per square metre"),
       'gram_per_square_centimetre': makeEUInformation("25","g/cm²","gram per square centimetre"),
       'milligram_per_square_centimetre': makeEUInformation("H63","mg/cm²","milligram per square centimetre"),
       'gram_per_square_metre': makeEUInformation("GM","g/m²","gram per square metre"),
       'kilogram_per_square_metre': makeEUInformation("28","kg/m²","kilogram per square metre"),
       'kilogram_per_square_centimetre': makeEUInformation("D5","kg/cm²","kilogram per square centimetre"),
       'ounce_per_square_yard': makeEUInformation("ON","oz/yd²","ounce per square yard"),
       'ounce_per_square_foot': makeEUInformation("37","oz/ft²","ounce per square foot"),
    },
   /**
    * momentum
    */
   'momentum': {
       'kilogram_metre_per_second': makeEUInformation("B31","kg·m/s","kilogram metre per second"),
       'kilogram_centimetre_per_second': makeEUInformation("M98","kg·(cm/s)","kilogram centimetre per second"),
       'gram_centimetre_per_second': makeEUInformation("M99","g·(cm/s)","gram centimetre per second"),
       'pound_foot_per_second': makeEUInformation("N10","lb·(ft/s)","pound foot per second"),
       'pound_inch_per_second': makeEUInformation("N11","lb·(in/s)","pound inch per second"),
    },
   /**
    * moment of momentum, angular momentum
    */
   'moment_of_momentum': {
       'kilogram_metre_squared_per_second': makeEUInformation("B33","kg·m²/s","kilogram metre squared per second"),
    },
   /**
    * moment of inertia (dynamic moment of inertia)
    */
   'moment_of_inertia': {
       'kilogram_metre_squared': makeEUInformation("B32","kg·m²","kilogram metre squared"),
       'pound_inch_squared': makeEUInformation("F20","lb·in²","pound inch squared"),
       'pound(avoirdupois)_square_foot': makeEUInformation("K65","lb·ft²","pound (avoirdupois) square foot"),
    },
   /**
    * force, weight
    */
   'force': {
       'newton': makeEUInformation("NEW","N","newton"),
       'meganewton': makeEUInformation("B73","MN","meganewton"),
       'kilonewton': makeEUInformation("B47","kN","kilonewton"),
       'millinewton': makeEUInformation("C20","mN","millinewton"),
       'micronewton': makeEUInformation("B92","µN","micronewton"),
       'dyne': makeEUInformation("DU","dyn","dyne"),
       'pound-force': makeEUInformation("C78","lbf","pound-force"),
       'kilogram-force': makeEUInformation("B37","kgf","kilogram-force"),
       'kilopond': makeEUInformation("B51","kp","kilopond"),
       'ounce(avoirdupois)-force': makeEUInformation("L40","ozf","ounce (avoirdupois)-force"),
       'ton-force(US_short)': makeEUInformation("L94","ton.sh-force","ton-force (US short)"),
       'kilopound-force': makeEUInformation("M75","kip","kilopound-force"),
       'poundal': makeEUInformation("M76","pdl","poundal"),
       'kilogram_metre_per_second_squared': makeEUInformation("M77","kg·m/s²","kilogram metre per second squared"),
       'pond': makeEUInformation("M78","p","pond"),
    },
   /**
    * force divided by length
    */
   'force_divided_by_length': {
       'pound-force_per_foot': makeEUInformation("F17","lbf/ft","pound-force per foot"),
       'pound-force_per_inch': makeEUInformation("F48","lbf/in","pound-force per inch"),
    },
   /**
    * gravitational constant
    */
   'gravitational_constant': {
       'newton_metre_squared_per_kilogram_squared': makeEUInformation("C54","N·m²/kg²","newton metre squared per kilogram squared"),
    },
   /**
    * moment of force, moment of a couple, torque
    */
   'moment_of_force': {
       'newton_metre': makeEUInformation("NU","N·m","newton metre"),
       'newton_per_ampere': makeEUInformation("H40","N/A","newton per ampere"),
       'meganewton_metre': makeEUInformation("B74","MN·m","meganewton metre"),
       'kilonewton_metre': makeEUInformation("B48","kN·m","kilonewton metre"),
       'millinewton_metre': makeEUInformation("D83","mN·m","millinewton metre"),
       'micronewton_metre': makeEUInformation("B93","µN·m","micronewton metre"),
       'decinewton_metre': makeEUInformation("DN","dN·m","decinewton metre"),
       'centinewton_metre': makeEUInformation("J72","cN·m","centinewton metre"),
       'kilogram_metre': makeEUInformation("M94","kg·m","kilogram metre"),
       'newton_centimetre': makeEUInformation("F88","N·cm","newton centimetre"),
       'newton_metre_per_ampere': makeEUInformation("F90","N·m/A","newton metre per ampere"),
       'newton_metre_per_degree': makeEUInformation("F89","Nm/°","newton metre per degree"),
       'newton_metre_per_kilogram': makeEUInformation("G19","N·m/kg","newton metre per kilogram"),
       'newton_per_millimetre': makeEUInformation("F47","N/mm","newton per millimetre"),
       'newton_metre_per_radian': makeEUInformation("M93","N·m/rad","newton metre per radian"),
       'newton_metre_watt_to_the_power_minus_0,5': makeEUInformation("H41","N·m·W⁻⁰‧⁵","newton metre watt to the power minus 0"),
       'kilogram-force_metre': makeEUInformation("B38","kgf·m","kilogram-force metre"),
       'inch_pound(pound_inch)': makeEUInformation("IA","in·lb","inch pound (pound inch)"),
       'ounce_inch': makeEUInformation("4Q","oz·in","ounce inch"),
       'ounce_foot': makeEUInformation("4R","oz·ft","ounce foot"),
       'pound-force_foot_per_ampere': makeEUInformation("F22","lbf·ft/A","pound-force foot per ampere"),
       'pound-force_inch': makeEUInformation("F21","lbf·in","pound-force inch"),
       'pound-force_foot_per_pound': makeEUInformation("G20","lbf·ft/lb","pound-force foot per pound"),
       'dyne_centimetre': makeEUInformation("J94","dyn·cm","dyne centimetre"),
       'ounce(avoirdupois)-force_inch': makeEUInformation("L41","ozf·in","ounce (avoirdupois)-force inch"),
       'pound-force_foot': makeEUInformation("M92","lbf·ft","pound-force foot"),
       'poundal_foot': makeEUInformation("M95","pdl·ft","poundal foot"),
       'poundal_inch': makeEUInformation("M96","pdl·in","poundal inch"),
       'dyne_metre': makeEUInformation("M97","dyn·m","dyne metre"),
    },
   /**
    * impulse
    */
   'impulse': {
       'newton_second': makeEUInformation("C57","N·s","newton second"),
    },
   /**
    * angular impulse
    */
   'angular_impulse': {
       'newton_metre_second': makeEUInformation("C53","N·m·s","newton metre second"),
    },
   /**
    * pressure, normal stress, shear stress, modulus of elasticity,shear modulus, modulus of rigidity, bulk modulus, modulus of compression
    */
   'pressure': {
       'millipascal': makeEUInformation("74","mPa","millipascal"),
       'megapascal': makeEUInformation("MPA","MPa","megapascal"),
       'pascal': makeEUInformation("PAL","Pa","pascal"),
       'kilopascal': makeEUInformation("KPA","kPa","kilopascal"),
       'bar[unit_of_pressure]': makeEUInformation("BAR","bar","bar [unit of pressure]"),
       'hectobar': makeEUInformation("HBA","hbar","hectobar"),
       'millibar': makeEUInformation("MBR","mbar","millibar"),
       'kilobar': makeEUInformation("KBA","kbar","kilobar"),
       'standard_atmosphere': makeEUInformation("ATM","atm","standard atmosphere"),
       'gigapascal': makeEUInformation("A89","GPa","gigapascal"),
       'micropascal': makeEUInformation("B96","µPa","micropascal"),
       'hectopascal': makeEUInformation("A97","hPa","hectopascal"),
       'decapascal': makeEUInformation("H75","daPa","decapascal"),
       'microbar': makeEUInformation("B85","µbar","microbar"),
       'newton_per_square_metre': makeEUInformation("C55","N/m²","newton per square metre"),
       'newton_per_square_millimetre': makeEUInformation("C56","N/mm²","newton per square millimetre"),
       'pascal_second_per_bar': makeEUInformation("H07","Pa·s/bar","pascal second per bar"),
       'hectopascal_cubic_metre_per_second': makeEUInformation("F94","hPa·m³/s","hectopascal cubic metre per second"),
       'hectopascal_litre_per_second': makeEUInformation("F93","hPa·l/s","hectopascal litre per second"),
       'hectopascal_per_kelvin': makeEUInformation("F82","hPa/K","hectopascal per kelvin"),
       'kilopascal_per_kelvin': makeEUInformation("F83","kPa/K","kilopascal per kelvin"),
       'megapascal_cubic_metre_per_second': makeEUInformation("F98","MPa·m³/s","megapascal cubic metre per second"),
       'megapascal_litre_per_second': makeEUInformation("F97","MPa·l/s","megapascal litre per second"),
       'megapascal_per_kelvin': makeEUInformation("F85","MPa/K","megapascal per kelvin"),
       'millibar_cubic_metre_per_second': makeEUInformation("F96","mbar·m³/s","millibar cubic metre per second"),
       'millibar_litre_per_second': makeEUInformation("F95","mbar·l/s","millibar litre per second"),
       'millibar_per_kelvin': makeEUInformation("F84","mbar/K","millibar per kelvin"),
       'pascal_cubic_metre_per_second': makeEUInformation("G01","Pa·m³/s","pascal cubic metre per second"),
       'pascal_litre_per_second': makeEUInformation("F99","Pa·l/s","pascal litre per second"),
       'pascal_second_per_kelvin': makeEUInformation("F77","Pa.s/K","pascal second per kelvin"),
       'newton_per_square_centimetre': makeEUInformation("E01","N/cm²","newton per square centimetre"),
       'pound_per_square_foot': makeEUInformation("FP","lb/ft²","pound per square foot"),
       'pound-force_per_square_inch': makeEUInformation("PS","lbf/in²","pound-force per square inch"),
       'kilogram-force_per_square_metre': makeEUInformation("B40","kgf/m²","kilogram-force per square metre"),
       'torr': makeEUInformation("UA","Torr","torr"),
       'technical_atmosphere': makeEUInformation("ATT","at","technical atmosphere"),
       'pound_per_square_inch_absolute': makeEUInformation("80","lb/in²","pound per square inch absolute"),
       'conventional_centimetre_of_water': makeEUInformation("H78","cm H₂O","conventional centimetre of water"),
       'conventional_millimetre_of_water': makeEUInformation("HP","mm H₂O","conventional millimetre of water"),
       'conventional_millimetre_of_mercury': makeEUInformation("HN","mm Hg","conventional millimetre of mercury"),
       'inch_of_mercury': makeEUInformation("F79","inHg","inch of mercury"),
       'inch_of_water': makeEUInformation("F78","inH₂O","inch of water"),
       'centimetre_of_mercury': makeEUInformation("J89","cm Hg","centimetre of mercury"),
       'foot_of_water': makeEUInformation("K24","ft H₂O","foot of water"),
       'foot_of_mercury': makeEUInformation("K25","ft Hg","foot of mercury"),
       'gram-force_per_square_centimetre': makeEUInformation("K31","gf/cm²","gram-force per square centimetre"),
       'kilogram-force_per_square_centimetre': makeEUInformation("E42","kgf/cm²","kilogram-force per square centimetre"),
       'kilogram-force_per_square_millimetre': makeEUInformation("E41","kgf·m/cm²","kilogram-force per square millimetre"),
       'pound-force_per_square_foot': makeEUInformation("K85","lbf/ft²","pound-force per square foot"),
       'pound-force_per_square_inch_degree_Fahrenheit': makeEUInformation("K86","psi/°F","pound-force per square inch degree Fahrenheit"),
       'A_unit_of_pressure_defining_the_number_of_kilopounds_force_per_square_inch. Use_kip_per_square_inch(common_code_N20).': makeEUInformation("84","klbf/in²","A unit of pressure defining the number of kilopounds force per square inch.Use kip per square inch (common code N20)."),
       'centimetre_of_mercury(0_ºC)': makeEUInformation("N13","cmHg (0 ºC)","centimetre of mercury (0 ºC)"),
       'centimetre_of_water(4_ºC)': makeEUInformation("N14","cmH₂O (4 °C)","centimetre of water (4 ºC)"),
       'foot_of_water(39.2_ºF)': makeEUInformation("N15","ftH₂O (39","2 ºF)"),
       'inch_of_mercury(32_ºF)': makeEUInformation("N16","inHG (32 ºF)","inch of mercury (32 ºF)"),
       'inch_of_mercury(60_ºF)': makeEUInformation("N17","inHg (60 ºF)","inch of mercury (60 ºF)"),
       'inch_of_water(39.2_ºF)': makeEUInformation("N18","inH₂O (39","2 ºF)"),
       'inch_of_water(60_ºF)': makeEUInformation("N19","inH₂O (60 ºF)","inch of water (60 ºF)"),
       'kip_per_square_inch': makeEUInformation("N20","ksi","kip per square inch"),
       'poundal_per_square_foot_': makeEUInformation("N21","pdl/ft²","poundal per square foot"),
       'ounce(avoirdupois)_per_square_inch_': makeEUInformation("N22","oz/in²","ounce (avoirdupois) per square inch"),
       'conventional_metre_of_water': makeEUInformation("N23","mH₂O","conventional metre of water"),
       'gram_per_square_millimetre': makeEUInformation("N24","g/mm²","gram per square millimetre"),
       'pound_per_square_yard': makeEUInformation("N25","lb/yd²","pound per square yard"),
       'poundal_per_square_inch': makeEUInformation("N26","pdl/in²","poundal per square inch"),
       'kilonewton_per_square_metre': makeEUInformation("KNM","KN/m2","kilonewton per square metre"),
    },
   /**
    * pressure ratio
    */
   'pressure_ratio': {
       'hectopascal_per_bar': makeEUInformation("E99","hPa/bar","hectopascal per bar"),
       'megapascal_per_bar': makeEUInformation("F05","MPa/bar","megapascal per bar"),
       'millibar_per_bar': makeEUInformation("F04","mbar/bar","millibar per bar"),
       'pascal_per_bar': makeEUInformation("F07","Pa/bar","pascal per bar"),
       'kilopascal_per_bar': makeEUInformation("F03","kPa/bar","kilopascal per bar"),
       'psi_per_psi': makeEUInformation("L52","psi/psi","psi per psi"),
       'bar_per_bar': makeEUInformation("J56","bar/bar","bar per bar"),
    },
   /**
    * linear strain, relative elongation, shear strain, volume or bulk strain
    */
   'linear_strain': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * poisson ratio, poisson number
    */
   'poisson_ratio': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * compressibility, bulk compressibility
    */
   'compressibility': {
       'reciprocal_pascal_or_pascal_to_the_power_minus_one': makeEUInformation("C96","Pa⁻¹","reciprocal pascal or pascal to the power minus one"),
       'reciprocal_bar': makeEUInformation("F58","1/bar","reciprocal bar"),
    },
   /**
    * second moment of area, second axial moment of area
    */
   'second_moment_of_area': {
       'metre_to_the_fourth_power': makeEUInformation("B83","m⁴","metre to the fourth power"),
       'millimetre_to_the_fourth_power': makeEUInformation("G77","mm⁴","millimetre to the fourth power"),
    },
   /**
    * second polar moment of area
    */
   'second_polar_moment_of_area': {
       'inch_to_the_fourth_power': makeEUInformation("D69","in⁴","inch to the fourth power"),
       'foot_to_the_fourth_power_': makeEUInformation("N27","ft⁴","foot to the fourth power"),
    },
   /**
    * section modulus
    */
   'section_modulus': {
       'cubic_metre': makeEUInformation("MTQ","m³","cubic metre"),
       'cubic_inch': makeEUInformation("INQ","in³","cubic inch"),
    },
   /**
    * friction factor, coefficient of friction
    */
   'friction_factor': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * viscosity (dynamic viscosity)
    */
   'viscosity': {
       'pascal_second': makeEUInformation("C65","Pa·s","pascal second"),
       'kilogram_per_metre_second': makeEUInformation("N37","kg/(m·s)","kilogram per metre second"),
       'kilogram_per_metre_minute': makeEUInformation("N38","kg/(m·min)","kilogram per metre minute"),
       'millipascal_second': makeEUInformation("C24","mPa·s","millipascal second"),
       'newton_second_per_square_metre': makeEUInformation("N36","(N/m²)·s","newton second per square metre"),
       'kilogram_per_metre_day': makeEUInformation("N39","kg/(m·d)","kilogram per metre day"),
       'kilogram_per_metre_hour': makeEUInformation("N40","kg/(m·h)","kilogram per metre hour"),
       'gram_per_centimetre_second': makeEUInformation("N41","g/(cm·s)","gram per centimetre second"),
       'poise': makeEUInformation("89","P","poise"),
       'centipoise': makeEUInformation("C7","cP","centipoise"),
       'poise_per_bar': makeEUInformation("F06","P/bar","poise per bar"),
       'poise_per_kelvin': makeEUInformation("F86","P/K","poise per kelvin"),
       'micropoise': makeEUInformation("J32","µP","micropoise"),
       'centipoise_per_kelvin': makeEUInformation("J73","cP/K","centipoise per kelvin"),
       'centipoise_per_bar': makeEUInformation("J74","cP/bar","centipoise per bar"),
       'pound_per_foot_hour': makeEUInformation("K67","lb/(ft·h)","pound per foot hour"),
       'pound_per_foot_second': makeEUInformation("K68","lb/(ft·s)","pound per foot second"),
       'pound-force_second_per_square_foot': makeEUInformation("K91","lbf·s/ft²","pound-force second per square foot"),
       'pound-force_second_per_square_inch': makeEUInformation("K92","lbf·s/in²","pound-force second per square inch"),
       'millipascal_second_per_kelvin': makeEUInformation("L15","mPa·s/K","millipascal second per kelvin"),
       'millipascal_second_per_bar': makeEUInformation("L16","mPa·s/bar","millipascal second per bar"),
       'slug_per_foot_second': makeEUInformation("L64","slug/(ft·s)","slug per foot second"),
       'poundal_second_per_square_foot_': makeEUInformation("N34","(pdl/ft²)·s","poundal second per square foot"),
       'poise_per_pascal': makeEUInformation("N35","P/Pa","poise per pascal"),
       'poundal_second_per_square_inch': makeEUInformation("N42","(pdl/in²)·s","poundal second per square inch"),
       'pound_per_foot_minute': makeEUInformation("N43","lb/(ft·min)","pound per foot minute"),
       'pound_per_foot_day': makeEUInformation("N44","lb/(ft·d)","pound per foot day"),
    },
   /**
    * kinematic viscosity
    */
   'kinematic_viscosity': {
       'square_metre_per_second': makeEUInformation("S4","m²/s","square metre per second"),
       'square_metre_per_second_pascal': makeEUInformation("M82","(m²/s)/Pa","square metre per second pascal"),
       'millimetre_squared_per_second': makeEUInformation("C17","mm²/s","millimetre squared per second"),
       'square_metre_per_second_bar': makeEUInformation("G41","m²/(s·bar)","square metre per second bar"),
       'square_metre_per_second_kelvin': makeEUInformation("G09","m²/(s·K)","square metre per second kelvin"),
       'stokes': makeEUInformation("91","St","stokes"),
       'centistokes': makeEUInformation("4C","cSt","centistokes"),
       'stokes_per_bar': makeEUInformation("G46","St/bar","stokes per bar"),
       'stokes_per_kelvin': makeEUInformation("G10","St/K","stokes per kelvin"),
       'square_foot_per_second': makeEUInformation("S3","ft²/s","square foot per second"),
       'square_inch_per_second': makeEUInformation("G08","in²/s","square inch per second"),
       'square_foot_per_hour_': makeEUInformation("M79","ft²/h","square foot per hour"),
       'stokes_per_pascal': makeEUInformation("M80","St/Pa","stokes per pascal"),
       'square_centimetre_per_second': makeEUInformation("M81","cm²/s","square centimetre per second"),
    },
   /**
    * surface tension
    */
   'surface_tension': {
       'newton_per_metre': makeEUInformation("4P","N/m","newton per metre"),
       'millinewton_per_metre': makeEUInformation("C22","mN/m","millinewton per metre"),
       'newton_per_centimetre': makeEUInformation("M23","N/cm","newton per centimetre"),
       'kilonewton_per_metre': makeEUInformation("N31","kN/m","kilonewton per metre"),
       'dyne_per_centimetre': makeEUInformation("DX","dyn/cm","dyne per centimetre"),
       'poundal_per_inch': makeEUInformation("N32","pdl/in","poundal per inch"),
       'pound-force_per_yard': makeEUInformation("N33","lbf/yd","pound-force per yard"),
    },
   /**
    * torsional stiffness, area-related torsional moment
    */
   'torsional_stiffness': {
       'newton_metre_per_square_metre': makeEUInformation("M34","N·m/m²","newton metre per square metre"),
    },
   /**
    * work, energy, potential energy, kinetic energy
    */
   'work': {
       'joule': makeEUInformation("JOU","J","joule"),
       'kilojoule': makeEUInformation("KJO","kJ","kilojoule"),
       'exajoule': makeEUInformation("A68","EJ","exajoule"),
       'petajoule': makeEUInformation("C68","PJ","petajoule"),
       'terajoule': makeEUInformation("D30","TJ","terajoule"),
       'gigajoule': makeEUInformation("GV","GJ","gigajoule"),
       'megajoule': makeEUInformation("3B","MJ","megajoule"),
       'millijoule': makeEUInformation("C15","mJ","millijoule"),
       'femtojoule': makeEUInformation("A70","fJ","femtojoule"),
       'attojoule': makeEUInformation("A13","aJ","attojoule"),
       'watt_hour': makeEUInformation("WHR","W·h","watt hour"),
       'megawatt_hour(1000 kW.h)': makeEUInformation("MWH","MW·h","megawatt hour (1000 kW.h)"),
       'kilowatt_hour': makeEUInformation("KWH","kW·h","kilowatt hour"),
       'gigawatt_hour': makeEUInformation("GWH","GW·h","gigawatt hour"),
       'terawatt_hour': makeEUInformation("D32","TW·h","terawatt hour"),
       'electronvolt': makeEUInformation("A53","eV","electronvolt"),
       'megaelectronvolt': makeEUInformation("B71","MeV","megaelectronvolt"),
       'gigaelectronvolt': makeEUInformation("A85","GeV","gigaelectronvolt"),
       'kiloelectronvolt': makeEUInformation("B29","keV","kiloelectronvolt"),
       'erg': makeEUInformation("A57","erg","erg"),
       'foot_pound-force': makeEUInformation("85","ft·lbf","foot pound-force"),
       'kilogram-force_metre': makeEUInformation("B38","kgf·m","kilogram-force metre"),
       'foot_poundal': makeEUInformation("N46","ft·pdl","foot poundal"),
       'inch_poundal': makeEUInformation("N47","in·pdl","inch poundal"),
    },
   /**
    * work per unit weight
    */
   'work_per_unit_weight': {
       'pound-force_foot_per_pound': makeEUInformation("G20","lbf·ft/lb","pound-force foot per pound"),
    },
   /**
    * power (for direct current), active power
    */
   'power': {
       'watt': makeEUInformation("WTT","W","watt"),
       'kilowatt': makeEUInformation("KWT","kW","kilowatt"),
       'megawatt': makeEUInformation("MAW","MW","megawatt"),
       'gigawatt': makeEUInformation("A90","GW","gigawatt"),
       'milliwatt': makeEUInformation("C31","mW","milliwatt"),
       'microwatt': makeEUInformation("D80","µW","microwatt"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code F80. displayName/description below are node-opcua's own, from UNECE rec20. */
       'water_horse_power': makeEUInformation("F80","","water horse power - A unit of power defining the amount of power required to move a given volume of water against acceleration of gravity to a specified elevation (pressure head). (7,460 43 x 10² W)"),
       'erg_per_second': makeEUInformation("A63","erg/s","erg per second"),
       'foot_pound-force_per_second': makeEUInformation("A74","ft·lbf/s","foot pound-force per second"),
       'kilogram-force_metre_per_second': makeEUInformation("B39","kgf·m/s","kilogram-force metre per second"),
       'metric_horse_power': makeEUInformation("HJ","metric hp","metric horse power"),
       'cheval_vapeur': makeEUInformation("A25","CV","cheval vapeur"),
       'brake_horse_power': makeEUInformation("BHP","BHP","brake horse power"),
       'foot_pound-force_per_hour': makeEUInformation("K15","ft·lbf/h","foot pound-force per hour"),
       'foot_pound-force_per_minute': makeEUInformation("K16","ft·lbf/min","foot pound-force per minute"),
       'horsepower(boiler)': makeEUInformation("K42","boiler hp","horsepower (boiler)"),
       'Pferdestaerke': makeEUInformation("N12","PS","Pferdestaerke"),
    },
   /**
    * mass flow rate
    */
   'mass_flow_rate': {
       'kilogram_per_second': makeEUInformation("KGS","kg/s","kilogram per second"),
       'kilogram_per_square_metre_second': makeEUInformation("H56","kg/(m²·s)","kilogram per square metre second"),
       'kilogram_per_second_pascal': makeEUInformation("M87","(kg/s)/Pa","kilogram per second pascal"),
       'milligram_per_hour': makeEUInformation("4M","mg/h","milligram per hour"),
       'gram_per_day': makeEUInformation("F26","g/d","gram per day"),
       'gram_per_day_bar': makeEUInformation("F62","g/(d·bar)","gram per day bar"),
       'gram_per_day_kelvin': makeEUInformation("F35","g/(d·K)","gram per day kelvin"),
       'gram_per_hour': makeEUInformation("F27","g/h","gram per hour"),
       'gram_per_hour_bar': makeEUInformation("F63","g/(h·bar)","gram per hour bar"),
       'gram_per_hour_kelvin': makeEUInformation("F36","g/(h·K)","gram per hour kelvin"),
       'gram_per_minute': makeEUInformation("F28","g/min","gram per minute"),
       'gram_per_minute_bar': makeEUInformation("F64","g/(min·bar)","gram per minute bar"),
       'gram_per_minute_kelvin': makeEUInformation("F37","g/(min·K)","gram per minute kelvin"),
       'gram_per_second': makeEUInformation("F29","g/s","gram per second"),
       'gram_per_second_bar': makeEUInformation("F65","g/(s·bar)","gram per second bar"),
       'gram_per_second_kelvin': makeEUInformation("F38","g/(s·K)","gram per second kelvin"),
       'kilogram_per_day': makeEUInformation("F30","kg/d","kilogram per day"),
       'kilogram_per_day_bar': makeEUInformation("F66","kg/(d·bar)","kilogram per day bar"),
       'kilogram_per_day_kelvin': makeEUInformation("F39","kg/(d·K)","kilogram per day kelvin"),
       'kilogram_per_hour': makeEUInformation("E93","kg/h","kilogram per hour"),
       'kilogram_per_hour_bar': makeEUInformation("F67","kg/(h·bar)","kilogram per hour bar"),
       'kilogram_per_hour_kelvin': makeEUInformation("F40","kg/(h·K)","kilogram per hour kelvin"),
       'kilogram_per_minute': makeEUInformation("F31","kg/min","kilogram per minute"),
       'kilogram_per_minute_bar': makeEUInformation("F68","kg/(min·bar)","kilogram per minute bar"),
       'kilogram_per_minute_kelvin': makeEUInformation("F41","kg/(min·K)","kilogram per minute kelvin"),
       'kilogram_per_second_bar': makeEUInformation("F69","kg/(s·bar)","kilogram per second bar"),
       'kilogram_per_second_kelvin': makeEUInformation("F42","kg/(s·K)","kilogram per second kelvin"),
       'milligram_per_day': makeEUInformation("F32","mg/d","milligram per day"),
       'milligram_per_day_bar': makeEUInformation("F70","mg/(d·bar)","milligram per day bar"),
       'milligram_per_day_kelvin': makeEUInformation("F43","mg/(d·K)","milligram per day kelvin"),
       'milligram_per_hour_bar': makeEUInformation("F71","mg/(h·bar)","milligram per hour bar"),
       'milligram_per_hour_kelvin': makeEUInformation("F44","mg/(h·K)","milligram per hour kelvin"),
       'milligram_per_minute': makeEUInformation("F33","mg/min","milligram per minute"),
       'milligram_per_minute_bar': makeEUInformation("F72","mg/(min·bar)","milligram per minute bar"),
       'milligram_per_minute_kelvin': makeEUInformation("F45","mg/(min·K)","milligram per minute kelvin"),
       'milligram_per_second': makeEUInformation("F34","mg/s","milligram per second"),
       'milligram_per_second_bar': makeEUInformation("F73","mg/(s·bar)","milligram per second bar"),
       'milligram_per_second_kelvin': makeEUInformation("F46","mg/(s·K)","milligram per second kelvin"),
       'gram_per_hertz': makeEUInformation("F25","g/Hz","gram per hertz"),
       'ton(US)_per_hour': makeEUInformation("4W","ton (US) /h","ton (US) per hour"),
       'pound_per_hour': makeEUInformation("4U","lb/h","pound per hour"),
       'pound(avoirdupois)_per_day': makeEUInformation("K66","lb/d","pound (avoirdupois) per day"),
       'pound(avoirdupois)_per_hour_degree_Fahrenheit': makeEUInformation("K73","(lb/h)/°F","pound (avoirdupois) per hour degree Fahrenheit"),
       'pound(avoirdupois)_per_hour_psi': makeEUInformation("K74","(lb/h)/psi","pound (avoirdupois) per hour psi"),
       'pound(avoirdupois)_per_minute': makeEUInformation("K78","lb/min","pound (avoirdupois) per minute"),
       'pound(avoirdupois)_per_minute_degree_Fahrenheit': makeEUInformation("K79","lb/(min·°F)","pound (avoirdupois) per minute degree Fahrenheit"),
       'pound(avoirdupois)_per_minute_psi': makeEUInformation("K80","(lb/min)/psi","pound (avoirdupois) per minute psi"),
       'pound(avoirdupois)_per_second': makeEUInformation("K81","lb/s","pound (avoirdupois) per second"),
       'pound(avoirdupois)_per_second_degree_Fahrenheit': makeEUInformation("K82","(lb/s)/°F","pound (avoirdupois) per second degree Fahrenheit"),
       'pound(avoirdupois)_per_second_psi': makeEUInformation("K83","(lb/s)/psi","pound (avoirdupois) per second psi"),
       'ounce(avoirdupois)_per_day': makeEUInformation("L33","oz/d","ounce (avoirdupois) per day"),
       'ounce(avoirdupois)_per_hour': makeEUInformation("L34","oz/h","ounce (avoirdupois) per hour"),
       'ounce(avoirdupois)_per_minute': makeEUInformation("L35","oz/min","ounce (avoirdupois) per minute"),
       'ounce(avoirdupois)_per_second': makeEUInformation("L36","oz/s","ounce (avoirdupois) per second"),
       'slug_per_day': makeEUInformation("L63","slug/d","slug per day"),
       'slug_per_hour': makeEUInformation("L66","slug/h","slug per hour"),
       'slug_per_minute': makeEUInformation("L67","slug/min","slug per minute"),
       'slug_per_second': makeEUInformation("L68","slug/s","slug per second"),
       'tonne_per_day': makeEUInformation("L71","t/d","tonne per day"),
       'tonne_per_day_kelvin': makeEUInformation("L72","(t/d)/K","tonne per day kelvin"),
       'tonne_per_day_bar': makeEUInformation("L73","(t/d)/bar","tonne per day bar"),
       'tonne_per_hour': makeEUInformation("E18","t/h","tonne per hour"),
       'tonne_per_hour_kelvin': makeEUInformation("L74","(t/h)/K","tonne per hour kelvin"),
       'tonne_per_hour_bar': makeEUInformation("L75","(t/h)/bar","tonne per hour bar"),
       'tonne_per_minute': makeEUInformation("L78","t/min","tonne per minute"),
       'tonne_per_minute_kelvin': makeEUInformation("L79","(t/min)/K","tonne per minute kelvin"),
       'tonne_per_minute_bar': makeEUInformation("L80","(t/min)/bar","tonne per minute bar"),
       'tonne_per_second': makeEUInformation("L81","t/s","tonne per second"),
       'tonne_per_second_kelvin': makeEUInformation("L82","(t/s)/K","tonne per second kelvin"),
       'tonne_per_second_bar': makeEUInformation("L83","(t/s)/bar","tonne per second bar"),
       'ton_long_per_day': makeEUInformation("L85","ton (UK)/d","ton long per day"),
       'ton_short_per_day': makeEUInformation("L88","ton (US)/d","ton short per day"),
       'ton_short_per_hour_degree_Fahrenheit': makeEUInformation("L89","ton (US)/(h·°F)","ton short per hour degree Fahrenheit"),
       'ton_short_per_hour_psi': makeEUInformation("L90","(ton (US)/h)/psi","ton short per hour psi"),
       'tonne_per_month': makeEUInformation("M88","t/mo","tonne per month"),
       'tonne_per_year': makeEUInformation("M89","t/y","tonne per year"),
       'kilopound_per_hour': makeEUInformation("M90","klb/h","kilopound per hour"),
    },
   /**
    * mass ratio
    */
   'mass_ratio': {
       'microgram_per_kilogram': makeEUInformation("J33","µg/kg","microgram per kilogram"),
       'nanogram_per_kilogram': makeEUInformation("L32","ng/kg","nanogram per kilogram"),
       'milligram_per_kilogram': makeEUInformation("NA","mg/kg","milligram per kilogram"),
       'kilogram_per_kilogram': makeEUInformation("M29","kg/kg","kilogram per kilogram"),
       'pound_per_pound': makeEUInformation("M91","lb/lb","pound per pound"),
       'microgram_per_hectogram': makeEUInformation("Q29","µg/hg","microgram per hectogram"),
    },
   /**
    * (instantaneous) volume flow rate
    */
   'volume_flow_rate': {
       'cubic_metre_per_second': makeEUInformation("MQS","m³/s","cubic metre per second"),
       'cubic_metre_per_hour': makeEUInformation("MQH","m³/h","cubic metre per hour"),
       'millilitre_per_second': makeEUInformation("40","ml/s","millilitre per second"),
       'millilitre_per_minute': makeEUInformation("41","ml/min","millilitre per minute"),
       'litre_per_day': makeEUInformation("LD","l/d","litre per day"),
       'cubic_centimetre_per_second': makeEUInformation("2J","cm³/s","cubic centimetre per second"),
       'kilolitre_per_hour': makeEUInformation("4X","kl/h","kilolitre per hour"),
       'litre_per_minute': makeEUInformation("L2","l/min","litre per minute"),
       'cubic_centimetre_per_day': makeEUInformation("G47","cm³/d","cubic centimetre per day"),
       'cubic_centimetre_per_day_bar': makeEUInformation("G78","cm³/(d·bar)","cubic centimetre per day bar"),
       'cubic_centimetre_per_day_kelvin': makeEUInformation("G61","cm³/(d·K)","cubic centimetre per day kelvin"),
       'cubic_centimetre_per_hour': makeEUInformation("G48","cm³/h","cubic centimetre per hour"),
       'cubic_centimetre_per_hour_bar': makeEUInformation("G79","cm³/(h·bar)","cubic centimetre per hour bar"),
       'cubic_centimetre_per_hour_kelvin': makeEUInformation("G62","cm³/(h·K)","cubic centimetre per hour kelvin"),
       'cubic_centimetre_per_minute': makeEUInformation("G49","cm³/min","cubic centimetre per minute"),
       'cubic_centimetre_per_minute_bar': makeEUInformation("G80","cm³/(min·bar)","cubic centimetre per minute bar"),
       'cubic_centimetre_per_minute_kelvin': makeEUInformation("G63","cm³/(min·K)","cubic centimetre per minute kelvin"),
       'cubic_centimetre_per_second_bar': makeEUInformation("G81","cm³/(s·bar)","cubic centimetre per second bar"),
       'cubic_centimetre_per_second_kelvin': makeEUInformation("G64","cm³/(s·K)","cubic centimetre per second kelvin"),
       'cubic_decimetre_per_hour': makeEUInformation("E92","dm³/h","cubic decimetre per hour"),
       'cubic_metre_per_day': makeEUInformation("G52","m³/d","cubic metre per day"),
       'cubic_metre_per_day_bar': makeEUInformation("G86","m³/(d·bar)","cubic metre per day bar"),
       'cubic_metre_per_day_kelvin': makeEUInformation("G69","m³/(d·K)","cubic metre per day kelvin"),
       'cubic_metre_per_hour_bar': makeEUInformation("G87","m³/(h·bar)","cubic metre per hour bar"),
       'cubic_metre_per_hour_kelvin': makeEUInformation("G70","m³/(h·K)","cubic metre per hour kelvin"),
       'cubic_metre_per_minute': makeEUInformation("G53","m³/min","cubic metre per minute"),
       'cubic_metre_per_minute_bar': makeEUInformation("G88","m³/(min·bar)","cubic metre per minute bar"),
       'cubic_metre_per_minute_kelvin': makeEUInformation("G71","m³/(min·K)","cubic metre per minute kelvin"),
       'cubic_metre_per_second_bar': makeEUInformation("G89","m³/(s·bar)","cubic metre per second bar"),
       'cubic_metre_per_second_kelvin': makeEUInformation("G72","m³/(s·K)","cubic metre per second kelvin"),
       'litre_per_day_bar': makeEUInformation("G82","l/(d·bar)","litre per day bar"),
       'litre_per_day_kelvin': makeEUInformation("G65","l/(d·K)","litre per day kelvin"),
       'litre_per_hour_bar': makeEUInformation("G83","l/(h·bar)","litre per hour bar"),
       'litre_per_hour_kelvin': makeEUInformation("G66","l/(h·K)","litre per hour kelvin"),
       'litre_per_minute_bar': makeEUInformation("G84","l/(min·bar)","litre per minute bar"),
       'litre_per_minute_kelvin': makeEUInformation("G67","l/(min·K)","litre per minute kelvin"),
       'litre_per_second': makeEUInformation("G51","l/s","litre per second"),
       'litre_per_second_bar': makeEUInformation("G85","l/(s·bar)","litre per second bar"),
       'litre_per_second_kelvin': makeEUInformation("G68","l/(s·K)","litre per second kelvin"),
       'millilitre_per_day': makeEUInformation("G54","ml/d","millilitre per day"),
       'millilitre_per_day_bar': makeEUInformation("G90","ml/(d·bar)","millilitre per day bar"),
       'millilitre_per_day_kelvin': makeEUInformation("G73","ml/(d·K)","millilitre per day kelvin"),
       'millilitre_per_hour': makeEUInformation("G55","ml/h","millilitre per hour"),
       'millilitre_per_hour_bar': makeEUInformation("G91","ml/(h·bar)","millilitre per hour bar"),
       'millilitre_per_hour_kelvin': makeEUInformation("G74","ml/(h·K)","millilitre per hour kelvin"),
       'millilitre_per_minute_bar': makeEUInformation("G92","ml/(min·bar)","millilitre per minute bar"),
       'millilitre_per_minute_kelvin': makeEUInformation("G75","ml/(min·K)","millilitre per minute kelvin"),
       'millilitre_per_second_bar': makeEUInformation("G93","ml/(s·bar)","millilitre per second bar"),
       'millilitre_per_second_kelvin': makeEUInformation("G76","ml/(s·K)","millilitre per second kelvin"),
       'cubic_foot_per_hour': makeEUInformation("2K","ft³/h","cubic foot per hour"),
       'cubic_foot_per_minute': makeEUInformation("2L","ft³/min","cubic foot per minute"),
       'barrel(US)_per_minute': makeEUInformation("5A","barrel (US)/min","barrel (US) per minute"),
       'US_gallon_per_minute': makeEUInformation("G2","gal (US) /min","US gallon per minute"),
       'Imperial_gallon_per_minute': makeEUInformation("G3","gal (UK) /min","Imperial gallon per minute"),
       'cubic_inch_per_hour': makeEUInformation("G56","in³/h","cubic inch per hour"),
       'cubic_inch_per_minute': makeEUInformation("G57","in³/min","cubic inch per minute"),
       'cubic_inch_per_second': makeEUInformation("G58","in³/s","cubic inch per second"),
       'gallon(US)_per_hour': makeEUInformation("G50","gal/h","gallon (US) per hour"),
       'barrel(UK_petroleum)_per_minute': makeEUInformation("J58","bbl (UK liq.)/min","barrel (UK petroleum) per minute"),
       'barrel(UK_petroleum)_per_day': makeEUInformation("J59","bbl (UK liq.)/d","barrel (UK petroleum) per day"),
       'barrel(UK_petroleum)_per_hour': makeEUInformation("J60","bbl (UK liq.)/h","barrel (UK petroleum) per hour"),
       'barrel(UK_petroleum)_per_second': makeEUInformation("J61","bbl (UK liq.)/s","barrel (UK petroleum) per second"),
       'barrel(US_petroleum)_per_hour': makeEUInformation("J62","bbl (US)/h","barrel (US petroleum) per hour"),
       'barrel(US_petroleum)_per_second': makeEUInformation("J63","bbl (US)/s","barrel (US petroleum) per second"),
       'bushel(UK)_per_day': makeEUInformation("J64","bu (UK)/d","bushel (UK) per day"),
       'bushel(UK)_per_hour': makeEUInformation("J65","bu (UK)/h","bushel (UK) per hour"),
       'bushel(UK)_per_minute': makeEUInformation("J66","bu (UK)/min","bushel (UK) per minute"),
       'bushel(UK)_per_second': makeEUInformation("J67","bu (UK)/s","bushel (UK) per second"),
       'bushel(US_dry)_per_day': makeEUInformation("J68","bu (US dry)/d","bushel (US dry) per day"),
       'bushel(US_dry)_per_hour': makeEUInformation("J69","bu (US dry)/h","bushel (US dry) per hour"),
       'bushel(US_dry)_per_minute': makeEUInformation("J70","bu (US dry)/min","bushel (US dry) per minute"),
       'bushel(US_dry)_per_second': makeEUInformation("J71","bu (US dry)/s","bushel (US dry) per second"),
       'cubic_decimetre_per_day': makeEUInformation("J90","dm³/d","cubic decimetre per day"),
       'cubic_decimetre_per_minute': makeEUInformation("J92","dm³/min","cubic decimetre per minute"),
       'cubic_decimetre_per_second': makeEUInformation("J93","dm³/s","cubic decimetre per second"),
       'cubic_metre_per_second_pascal': makeEUInformation("N45","(m³/s)/Pa","cubic metre per second pascal"),
       'ounce(UK_fluid)_per_day': makeEUInformation("J95","fl oz (UK)/d","ounce (UK fluid) per day"),
       'ounce(UK_fluid)_per_hour': makeEUInformation("J96","fl oz (UK)/h","ounce (UK fluid) per hour"),
       'ounce(UK_fluid)_per_minute': makeEUInformation("J97","fl oz (UK)/min","ounce (UK fluid) per minute"),
       'ounce(UK_fluid)_per_second': makeEUInformation("J98","fl oz (UK)/s","ounce (UK fluid) per second"),
       'ounce(US_fluid)_per_day': makeEUInformation("J99","fl oz (US)/d","ounce (US fluid) per day"),
       'ounce(US_fluid)_per_hour': makeEUInformation("K10","fl oz (US)/h","ounce (US fluid) per hour"),
       'ounce(US_fluid)_per_minute': makeEUInformation("K11","fl oz (US)/min","ounce (US fluid) per minute"),
       'ounce(US_fluid)_per_second': makeEUInformation("K12","fl oz (US)/s","ounce (US fluid) per second"),
       'cubic_foot_per_day': makeEUInformation("K22","ft³/d","cubic foot per day"),
       'gallon(UK)_per_day': makeEUInformation("K26","gal (UK)/d","gallon (UK) per day"),
       'gallon(UK)_per_hour': makeEUInformation("K27","gal (UK)/h","gallon (UK) per hour"),
       'gallon(UK)_per_second': makeEUInformation("K28","gal (UK)/s","gallon (UK) per second"),
       'gallon(US_liquid)_per_second': makeEUInformation("K30","gal (US liq.)/s","gallon (US liquid) per second"),
       'gill(UK)_per_day': makeEUInformation("K32","gi (UK)/d","gill (UK) per day"),
       'gill(UK)_per_hour': makeEUInformation("K33","gi (UK)/h","gill (UK) per hour"),
       'gill(UK)_per_minute': makeEUInformation("K34","gi (UK)/min","gill (UK) per minute"),
       'gill(UK)_per_second': makeEUInformation("K35","gi (UK)/s","gill (UK) per second"),
       'gill(US)_per_day': makeEUInformation("K36","gi (US)/d","gill (US) per day"),
       'gill(US)_per_hour': makeEUInformation("K37","gi (US)/h","gill (US) per hour"),
       'gill(US)_per_minute': makeEUInformation("K38","gi (US)/min","gill (US) per minute"),
       'gill(US)_per_second': makeEUInformation("K39","gi (US)/s","gill (US) per second"),
       'quart(UK_liquid)_per_day': makeEUInformation("K94","qt (UK liq.)/d","quart (UK liquid) per day"),
       'quart(UK_liquid)_per_hour': makeEUInformation("K95","qt (UK liq.)/h","quart (UK liquid) per hour"),
       'quart(UK_liquid)_per_minute': makeEUInformation("K96","qt (UK liq.)/min","quart (UK liquid) per minute"),
       'quart(UK_liquid)_per_second': makeEUInformation("K97","qt (UK liq.)/s","quart (UK liquid) per second"),
       'quart(US_liquid)_per_day': makeEUInformation("K98","qt (US liq.)/d","quart (US liquid) per day"),
       'quart(US_liquid)_per_hour': makeEUInformation("K99","qt (US liq.)/h","quart (US liquid) per hour"),
       'quart(US_liquid)_per_minute': makeEUInformation("L10","qt (US liq.)/min","quart (US liquid) per minute"),
       'quart(US_liquid)_per_second': makeEUInformation("L11","qt (US liq.)/s","quart (US liquid) per second"),
       'peck(UK)_per_day': makeEUInformation("L44","pk (UK)/d","peck (UK) per day"),
       'peck(UK)_per_hour': makeEUInformation("L45","pk (UK)/h","peck (UK) per hour"),
       'peck(UK)_per_minute': makeEUInformation("L46","pk (UK)/min","peck (UK) per minute"),
       'peck(UK)_per_second': makeEUInformation("L47","pk (UK)/s","peck (UK) per second"),
       'peck(US_dry)_per_day': makeEUInformation("L48","pk (US dry)/d","peck (US dry) per day"),
       'peck(US_dry)_per_hour': makeEUInformation("L49","pk (US dry)/h","peck (US dry) per hour"),
       'peck(US_dry)_per_minute': makeEUInformation("L50","pk (US dry)/min","peck (US dry) per minute"),
       'peck(US_dry)_per_second': makeEUInformation("L51","pk (US dry)/s","peck (US dry) per second"),
       'pint(UK)_per_day': makeEUInformation("L53","pt (UK)/d","pint (UK) per day"),
       'pint(UK)_per_hour': makeEUInformation("L54","pt (UK)/h","pint (UK) per hour"),
       'pint(UK)_per_minute': makeEUInformation("L55","pt (UK)/min","pint (UK) per minute"),
       'pint(UK)_per_second': makeEUInformation("L56","pt (UK)/s","pint (UK) per second"),
       'pint(US_liquid)_per_day': makeEUInformation("L57","pt (US liq.)/d","pint (US liquid) per day"),
       'pint(US_liquid)_per_hour': makeEUInformation("L58","pt (US liq.)/h","pint (US liquid) per hour"),
       'pint(US_liquid)_per_minute': makeEUInformation("L59","pt (US liq.)/min","pint (US liquid) per minute"),
       'pint(US_liquid)_per_second': makeEUInformation("L60","pt (US liq.)/s","pint (US liquid) per second"),
       'cubic_yard_per_day': makeEUInformation("M12","yd³/d","cubic yard per day"),
       'cubic_yard_per_hour': makeEUInformation("M13","yd³/h","cubic yard per hour"),
       'cubic_yard_per_minute': makeEUInformation("M15","yd³/min","cubic yard per minute"),
       'cubic_yard_per_second': makeEUInformation("M16","yd³/s","cubic yard per second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code Q37. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Standard_cubic_metre_per_day': makeEUInformation("Q37","","Standard cubic metre per day - Standard cubic metre (temperature 15°C and pressure 101325 millibars ) per day (1.15741 × 10-5 m3/s)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code Q38. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Standard_cubic_metre_per_hour': makeEUInformation("Q38","","Standard cubic metre per hour - Standard cubic metre (temperature 15°C and pressure 101325 millibars ) per hour (2.77778 × 10-4 m3/s)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code Q39. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Normalized_cubic_metre_per_day': makeEUInformation("Q39","","Normalized cubic metre per day - Normalized cubic metre (temperature 0°C and pressure 101325 millibars ) per day (1.15741 × 10-5 m3/s)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code Q40. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Normalized_cubic_metre_per_hour': makeEUInformation("Q40","","Normalized cubic metre per hour - Normalized cubic metre (temperature 0°C and pressure 101325 millibars ) per hour (2.77778 × 10-4 m3/s)"),
    },
   /**
    * volume ratio
    */
   'volume_ratio': {
       'cubic_metre_per_cubic_metre': makeEUInformation("H60","m³/m³","cubic metre per cubic metre"),
    },
   /**
    * leakage rate of gas
    */
   'leakage_rate_of_gas': {
       'bar_cubic_metre_per_second': makeEUInformation("F92","bar·m³/s","bar cubic metre per second"),
       'bar_litre_per_second': makeEUInformation("F91","bar·l/s","bar litre per second"),
       'psi_cubic_inch_per_second': makeEUInformation("K87","psi·in³/s","psi cubic inch per second"),
       'psi_litre_per_second': makeEUInformation("K88","psi·l/s","psi litre per second"),
       'psi_cubic_metre_per_second': makeEUInformation("K89","psi·m³/s","psi cubic metre per second"),
       'psi_cubic_yard_per_second': makeEUInformation("K90","psi·yd³/s","psi cubic yard per second"),
    },
   /**
    * 
    */
   'generic': {
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KWN. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Kilowatt_hour_per_normalized_cubic_metre': makeEUInformation("KWN","","Kilowatt hour per normalized cubic metre - Kilowatt hour per normalized cubic metre (temperature 0°C and pressure 101325 millibars )."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KWS. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Kilowatt_hour_per_standard_cubic_metre': makeEUInformation("KWS","","Kilowatt hour per standard cubic metre - Kilowatt hour per standard cubic metre (temperature 15°C and pressure 101325 millibars)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code Q41. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Joule_per_normalised_cubic_metre': makeEUInformation("Q41","","Joule per normalised cubic metre - Joule per normalised cubic metre (temperature 0°C and pressure 101325 millibars)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code Q42. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Joule_per_standard_cubic_metre': makeEUInformation("Q42","","Joule per standard cubic metre - Joule per standard cubic metre (temperature 15°C and pressure 101325 millibars)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MNJ. displayName/description below are node-opcua's own, from UNECE rec20. */
       'Mega_Joule_per_Normalised_cubic_Metre': makeEUInformation("MNJ","MJ/m³","Mega Joule per Normalised cubic Metre - Energy in Mega Joules per normalised cubic metre for gas (temperature 0°C and pressure 101325 millibars)"),
    },
   /**
    * Power flow rate
    */
   'Power_flow_rate': {
       'megawatts_per_minute': makeEUInformation("Q35","MW/min","megawatts per minute"),
    },
  },
 /**
  * Heat
  */
 'Heat': {
   /**
    * thermodynamic
    */
   'thermodynamic': {
       'kelvin': makeEUInformation("KEL","K","kelvin"),
    },
   /**
    * temperature
    */
   'temperature': {
       'degree_Celsius': makeEUInformation("CEL","°C","degree Celsius"),
       'degree_Celsius_per_hour': makeEUInformation("H12","°C/h","degree Celsius per hour"),
       'degree_Celsius_per_bar': makeEUInformation("F60","°C/bar","degree Celsius per bar"),
       'degree_Celsius_per_kelvin': makeEUInformation("E98","°C/K","degree Celsius per kelvin"),
       'degree_Celsius_per_minute': makeEUInformation("H13","°C/min","degree Celsius per minute"),
       'degree_Celsius_per_second': makeEUInformation("H14","°C/s","degree Celsius per second"),
       'kelvin_per_bar': makeEUInformation("F61","K/bar","kelvin per bar"),
       'kelvin_per_hour': makeEUInformation("F10","K/h","kelvin per hour"),
       'kelvin_per_kelvin': makeEUInformation("F02","K/K","kelvin per kelvin"),
       'kelvin_per_minute': makeEUInformation("F11","K/min","kelvin per minute"),
       'kelvin_per_second': makeEUInformation("F12","K/s","kelvin per second"),
       'kelvin_per_pascal': makeEUInformation("N79","K/Pa","kelvin per pascal"),
       'degree_Fahrenheit_per_kelvin': makeEUInformation("J20","°F/K","degree Fahrenheit per kelvin"),
       'degree_Fahrenheit_per_bar': makeEUInformation("J21","°F/bar","degree Fahrenheit per bar"),
       'reciprocal_degree_Fahrenheit': makeEUInformation("J26","1/°F","reciprocal degree Fahrenheit"),
       'degree_Rankine': makeEUInformation("A48","°R","degree Rankine"),
    },
   /**
    * fahrenheit temperature
    */
   'fahrenheit_temperature': {
       'degree_Fahrenheit': makeEUInformation("FAH","°F","degree Fahrenheit"),
    },
   /**
    * temperature variation over time
    */
   'temperature_variation_over_time': {
       'degree_Fahrenheit_per_hour': makeEUInformation("J23","°F/h","degree Fahrenheit per hour"),
       'degree_Fahrenheit_per_minute': makeEUInformation("J24","°F/min","degree Fahrenheit per minute"),
       'degree_Fahrenheit_per_second': makeEUInformation("J25","°F/s","degree Fahrenheit per second"),
       'degree_Rankine_per_hour': makeEUInformation("J28","°R/h","degree Rankine per hour"),
       'degree_Rankine_per_minute': makeEUInformation("J29","°R/min","degree Rankine per minute"),
       'degree_Rankine_per_second': makeEUInformation("J30","°R/s","degree Rankine per second"),
    },
   /**
    * linear expansion coefficient, cubic expansion coefficient, relative pressure coefficient
    */
   'linear_expansion_coefficient': {
       'reciprocal_kelvin_or_kelvin_to_the_power_minus_one': makeEUInformation("C91","K⁻¹","reciprocal kelvin or kelvin to the power minus one"),
       'reciprocal_megakelvin_or_megakelvin_to_the_power_minus_one': makeEUInformation("M20","1/MK","reciprocal megakelvin or megakelvin to the power minus one"),
    },
   /**
    * pressure coefficient
    */
   'pressure_coefficient': {
       'pascal_per_kelvin': makeEUInformation("C64","Pa/K","pascal per kelvin"),
       'bar_per_kelvin': makeEUInformation("F81","bar/K","bar per kelvin"),
    },
   /**
    * isothermal compressibility, isentropic compressibility
    */
   'isothermal_compressibility': {
       'reciprocal_pascal_or_pascal_to_the_power_minus_one': makeEUInformation("C96","Pa⁻¹","reciprocal pascal or pascal to the power minus one"),
    },
   /**
    * heat, quantity of heat, energy, thermodynamic energy, enthalpy, Helmholtz function, Helmholtz free energy
    */
   'heat': {
       'joule': makeEUInformation("JOU","J","joule"),
       'watt_second': makeEUInformation("J55","W·s","watt second"),
       'British_thermal_unit(international_table)': makeEUInformation("BTU","BtuIT","British thermal unit (international table)"),
       '15_°C_calorie': makeEUInformation("A1","cal₁₅","15 °C calorie"),
       'calorie(international_table)_': makeEUInformation("D70","calIT","calorie (international table)"),
       'British_thermal_unit(mean)': makeEUInformation("J39","Btu","British thermal unit (mean)"),
       'calorie(mean)': makeEUInformation("J75","cal","calorie (mean)"),
       'kilocalorie(mean)': makeEUInformation("K51","kcal","kilocalorie (mean)"),
       'kilocalorie(international_table)': makeEUInformation("E14","kcalIT","kilocalorie (international table)"),
       'kilocalorie(thermochemical)': makeEUInformation("K53","kcalth","kilocalorie (thermochemical)"),
       'British_thermal_unit(39_ºF)_': makeEUInformation("N66","Btu (39 ºF)","British thermal unit (39 ºF)"),
       'British_thermal_unit(59_ºF)': makeEUInformation("N67","Btu (59 ºF)","British thermal unit (59 ºF)"),
       'British_thermal_unit(60_ºF)_': makeEUInformation("N68","Btu (60 ºF)","British thermal unit (60 ºF)"),
       'calorie(20_ºC)_': makeEUInformation("N69","cal₂₀","calorie (20 ºC)"),
       'quad(1015_BtuIT)': makeEUInformation("N70","quad","quad (1015 BtuIT)"),
       'therm(EC)': makeEUInformation("N71","thm (EC)","therm (EC)"),
       'therm(U.S.)': makeEUInformation("N72","thm (US)","therm (U.S.)"),
    },
   /**
    * Gibbs function, Gibbs free energy
    */
   'Gibbs_function': {
       'calorie(thermochemical)': makeEUInformation("D35","calth","calorie (thermochemical)"),
    },
   /**
    * heat flow rate
    */
   'heat_flow_rate': {
       'watt': makeEUInformation("WTT","W","watt"),
       'kilowatt': makeEUInformation("KWT","kW","kilowatt"),
       'British_thermal_unit(international_table)_per_hour': makeEUInformation("2I","BtuIT/h","British thermal unit (international table) per hour"),
       'British_thermal_unit(international_table)_per_minute': makeEUInformation("J44","BtuIT/min","British thermal unit (international table) per minute"),
       'British_thermal_unit(international_table)_per_second': makeEUInformation("J45","BtuIT/s","British thermal unit (international table) per second"),
       'British_thermal_unit(thermochemical)_per_hour': makeEUInformation("J47","Btuth/h","British thermal unit (thermochemical) per hour"),
       'British_thermal_unit(thermochemical)_per_minute': makeEUInformation("J51","Btuth/min","British thermal unit (thermochemical) per minute"),
       'British_thermal_unit(thermochemical)_per_second': makeEUInformation("J52","Btuth/s","British thermal unit (thermochemical) per second"),
       'calorie(thermochemical)_per_minute': makeEUInformation("J81","calth/min","calorie (thermochemical) per minute"),
       'calorie(thermochemical)_per_second': makeEUInformation("J82","calth/s","calorie (thermochemical) per second"),
       'kilocalorie(thermochemical)_per_hour': makeEUInformation("E15","kcalth/h","kilocalorie (thermochemical) per hour"),
       'kilocalorie(thermochemical)_per_minute': makeEUInformation("K54","kcalth/min","kilocalorie (thermochemical) per minute"),
       'kilocalorie(thermochemical)_per_second': makeEUInformation("K55","kcalth/s","kilocalorie (thermochemical) per second"),
    },
   /**
    * density of heat flow rate
    */
   'density_of_heat_flow_rate': {
       'watt_per_square_metre': makeEUInformation("D54","W/m²","watt per square metre"),
       'watt_per_square_centimetre_': makeEUInformation("N48","W/cm²","watt per square centimetre"),
       'watt_per_square_inch_': makeEUInformation("N49","W/in²","watt per square inch"),
       'British_thermal_unit(international_table)_per_square_foot_hour': makeEUInformation("N50","BtuIT/(ft²·h)","British thermal unit (international table) per square foot hour"),
       'British_thermal_unit(thermochemical)_per_square_foot_hour': makeEUInformation("N51","Btuth/(ft²·h)","British thermal unit (thermochemical) per square foot hour"),
       'British_thermal_unit(thermochemical)_per_square_foot_minute': makeEUInformation("N52","Btuth/(ft²·min)","British thermal unit (thermochemical) per square foot minute"),
       'British_thermal_unit(international_table)_per_square_foot_second': makeEUInformation("N53","BtuIT/(ft²·s)","British thermal unit (international table) per square foot second"),
       'British_thermal_unit(thermochemical)_per_square_foot_second': makeEUInformation("N54","Btuth/(ft²·s)","British thermal unit (thermochemical) per square foot second"),
       'British_thermal_unit(international_table)_per_square_inch_second': makeEUInformation("N55","BtuIT/(in²·s)","British thermal unit (international table) per square inch second"),
       'calorie(thermochemical)_per_square_centimetre_minute': makeEUInformation("N56","calth/(cm²·min)","calorie (thermochemical) per square centimetre minute"),
       'calorie(thermochemical)_per_square_centimetre_second': makeEUInformation("N57","calth/(cm²·s)","calorie (thermochemical) per square centimetre second"),
    },
   /**
    * thermal conductivity
    */
   'thermal_conductivity': {
       'watt_per_metre_kelvin': makeEUInformation("D53","W/(m·K)","watt per metre kelvin"),
       'watt_per_metre_degree_Celsius': makeEUInformation("N80","W/(m·°C)","watt per metre degree Celsius"),
       'kilowatt_per_metre_kelvin': makeEUInformation("N81","kW/(m·K)","kilowatt per metre kelvin"),
       'kilowatt_per_metre_degree_Celsius': makeEUInformation("N82","kW/(m·°C)","kilowatt per metre degree Celsius"),
       'British_thermal_unit(international_table)_per_second_foot_degree_Rankine': makeEUInformation("A22","BtuIT/(s·ft·°R)","British thermal unit (international table) per second foot degree Rankine"),
       'calorie(international_table)_per_second_centimetre_kelvin': makeEUInformation("D71","calIT/(s·cm·K)","calorie (international table) per second centimetre kelvin"),
       'calorie(thermochemical)_per_second_centimetre_kelvin': makeEUInformation("D38","calth/(s·cm·K)","calorie (thermochemical) per second centimetre kelvin"),
       'British_thermal_unit(international_table)_foot_per_hour square_foot_degree_Fahrenheit': makeEUInformation("J40","BtuIT·ft/(h·ft²·°F)","British thermal unit (international table) foot per hour square foot degree Fahrenheit"),
       'British_thermal_unit(international_table)_inch_per_hour_square foot_degree_Fahrenheit': makeEUInformation("J41","BtuIT·in/(h·ft²·°F)","British thermal unit (international table) inch per hour square foot degree Fahrenheit"),
       'British_thermal_unit(international_table)_inch_per_second_square foot_degree_Fahrenheit': makeEUInformation("J42","BtuIT·in/(s·ft²·°F)","British thermal unit (international table) inch per second square foot degree Fahrenheit"),
       'British_thermal_unit(thermochemical)_foot_per_hour_square foot_degree_Fahrenheit': makeEUInformation("J46","Btuth·ft/(h·ft²·°F)","British thermal unit (thermochemical) foot per hour square foot degree Fahrenheit"),
       'British_thermal_unit(thermochemical)_inch_per_hour_square foot_degree_Fahrenheit': makeEUInformation("J48","Btuth·in/(h·ft²·°F)","British thermal unit (thermochemical) inch per hour square foot degree Fahrenheit"),
       'British_thermal_unit(thermochemical)_inch_per_second square_foot_degree_Fahrenheit': makeEUInformation("J49","Btuth·in/(s·ft²·°F)","British thermal unit (thermochemical) inch per second square foot degree Fahrenheit"),
       'calorie(thermochemical)_per_centimetre_second_degree_Celsius': makeEUInformation("J78","calth/(cm·s·°C)","calorie (thermochemical) per centimetre second degree Celsius"),
       'kilocalorie(international_table)_per_hour_metre_degree_Celsius': makeEUInformation("K52","kcal/(m·h·°C)","kilocalorie (international table) per hour metre degree Celsius"),
    },
   /**
    * coefficient of heat transfer
    */
   'coefficient_of_heat_transfer': {
       'watt_per_square_metre_kelvin': makeEUInformation("D55","W/(m²·K)","watt per square metre kelvin"),
    },
   /**
    * surface coefficient of heat transfer
    */
   'surface_coefficient_of_heat_transfer': {
       'kilowatt_per_square_metre_kelvin': makeEUInformation("N78","kW/(m²·K)","kilowatt per square metre kelvin"),
       'calorie(international_table)_per_second_square_centimetre_kelvin': makeEUInformation("D72","calIT/(s·cm²·K)","calorie (international table) per second square centimetre kelvin"),
       'calorie(thermochemical)_per_second_square_centimetre_kelvin': makeEUInformation("D39","calth/(s·cm²·K)","calorie (thermochemical) per second square centimetre kelvin"),
       'British_thermal_unit(international_table)_per_second_square_foot_degree_Rankine': makeEUInformation("A20","BtuIT/(s·ft²·°R)","British thermal unit (international table) per second square foot degree Rankine"),
       'British_thermal_unit(international_table)_per_hour_square_foot_degree_Rankine': makeEUInformation("A23","BtuIT/(h·ft²·°R)","British thermal unit (international table) per hour square foot degree Rankine"),
       'British_thermal_unit(international_table)_per_hour_square_foot_degree_Fahrenheit': makeEUInformation("N74","BtuIT/(h·ft²·ºF)","British thermal unit (international table) per hour square foot degree Fahrenheit"),
       'British_thermal_unit(thermochemical)_per_hour_square_foot_degree_Fahrenheit': makeEUInformation("N75","Btuth/(h·ft²·ºF)","British thermal unit (thermochemical) per hour square foot degree Fahrenheit"),
       'British_thermal_unit(international_table)_per_second_square_foot_degree_Fahrenheit': makeEUInformation("N76","BtuIT/(s·ft²·ºF)","British thermal unit (international table) per second square foot degree Fahrenheit"),
       'British_thermal_unit(thermochemical)_per_second_square_foot_degree_Fahrenheit': makeEUInformation("N77","Btuth/(s·ft²·ºF)","British thermal unit (thermochemical) per second square foot degree Fahrenheit"),
    },
   /**
    * thermal insulance, coefficient of thermal insulation
    */
   'thermal_insulance': {
       'square_metre_kelvin_per_watt': makeEUInformation("D19","m²·K/W","square metre kelvin per watt"),
       'degree_Fahrenheit_hour_square_foot_per_British_thermal_unit(thermochemical)': makeEUInformation("J19","°F·h·ft²/Btuth","degree Fahrenheit hour square foot per British thermal unit (thermochemical)"),
       'degree_Fahrenheit_hour_square_foot_per_British_thermal_unit(international_table)': makeEUInformation("J22","°F·h·ft²/BtuIT","degree Fahrenheit hour square foot per British thermal unit (international table)"),
       'clo': makeEUInformation("J83","clo","clo"),
       'square_metre_hour_degree_Celsius_per_kilocalorie(international_table)': makeEUInformation("L14","m²·h·°C/kcal","square metre hour degree Celsius per kilocalorie (international table)"),
    },
   /**
    * thermal resistance
    */
   'thermal_resistance': {
       'kelvin_per_watt': makeEUInformation("B21","K/W","kelvin per watt"),
       'kelvin_metre_per_watt': makeEUInformation("H35","K·m/W","kelvin metre per watt"),
       'degree_Fahrenheit_hour_per_British_thermal_unit(international_table)': makeEUInformation("N84","ºF/(BtuIT/h)","degree Fahrenheit hour per British thermal unit (international table)"),
       'degree_Fahrenheit_hour_per_British_thermal_unit(thermochemical)': makeEUInformation("N85","ºF/(Btuth/h)","degree Fahrenheit hour per British thermal unit (thermochemical)"),
       'degree_Fahrenheit_second_per_British_thermal_unit(international_table)': makeEUInformation("N86","ºF/(BtuIT/s)","degree Fahrenheit second per British thermal unit (international table)"),
       'degree_Fahrenheit_second_per_British_thermal_unit(thermochemical)': makeEUInformation("N87","ºF/(Btuth/s)","degree Fahrenheit second per British thermal unit (thermochemical)"),
       'degree_Fahrenheit_hour_square_foot_per_British_thermal_unit(international_table)_inch': makeEUInformation("N88","ºF·h·ft²/(BtuIT·in)","degree Fahrenheit hour square foot per British thermal unit (international table) inch"),
       'degree_Fahrenheit_hour_square_foot_per_British_thermal_unit(thermochemical)_inch': makeEUInformation("N89","ºF·h·ft²/(Btuth·in)","degree Fahrenheit hour square foot per British thermal unit (thermochemical) inch"),
    },
   /**
    * thermal conductance
    */
   'thermal_conductance': {
       'watt_per_kelvin': makeEUInformation("D52","W/K","watt per kelvin"),
    },
   /**
    * thermal diffusivity
    */
   'thermal_diffusivity': {
       'square_metre_per_second': makeEUInformation("S4","m²/s","square metre per second"),
       'square_foot_per_second': makeEUInformation("S3","ft²/s","square foot per second"),
       'millimetre_per_degree_Celcius_metre': makeEUInformation("E97","mm/(°C·m)","millimetre per degree Celcius metre"),
       'millimetre_per_kelvin': makeEUInformation("F53","mm/K","millimetre per kelvin"),
       'metre_per_degree_Celcius_metre': makeEUInformation("N83","m/(°C·m)","metre per degree Celcius metre"),
    },
   /**
    * heat capacity, entropy
    */
   'heat_capacity': {
       'joule_per_kelvin': makeEUInformation("JE","J/K","joule per kelvin"),
       'kilojoule_per_kelvin': makeEUInformation("B41","kJ/K","kilojoule per kelvin"),
       'British_thermal_unit(international_table)_per_pound_degree_Fahrenheit': makeEUInformation("J43","BtuIT/(lb·°F)","British thermal unit (international table) per pound degree Fahrenheit"),
       'British_thermal_unit(thermochemical)_per_pound_degree_Fahrenheit': makeEUInformation("J50","Btuth/(lb·°F)","British thermal unit (thermochemical) per pound degree Fahrenheit"),
       'calorie(international_table)_per_gram_degree_Celsius': makeEUInformation("J76","calIT/(g·°C)","calorie (international table) per gram degree Celsius"),
       'calorie(thermochemical)_per_gram_degree_Celsius': makeEUInformation("J79","calth/(g·°C)","calorie (thermochemical) per gram degree Celsius"),
       'British_thermal_unit(international_table)_per_degree_Fahrenheit': makeEUInformation("N60","BtuIT/ºF","British thermal unit (international table) per degree Fahrenheit"),
       'British_thermal_unit(thermochemical)_per_degree_Fahrenheit': makeEUInformation("N61","Btuth/ºF","British thermal unit (thermochemical) per degree Fahrenheit"),
       'British_thermal_unit(international_table)_per_degree_Rankine': makeEUInformation("N62","BtuIT/ºR","British thermal unit (international table) per degree Rankine"),
       'British_thermal_unit(thermochemical)_per_degree_Rankine': makeEUInformation("N63","Btuth/ºR","British thermal unit (thermochemical) per degree Rankine"),
       'British_thermal_unit(thermochemical)_per_pound_degree_Rankine': makeEUInformation("N64","(Btuth/°R)/lb","British thermal unit (thermochemical) per pound degree Rankine"),
       'kilocalorie(international_table)_per_gram_kelvin': makeEUInformation("N65","(kcalIT/K)/g","kilocalorie (international table) per gram kelvin"),
    },
   /**
    * specific heat capacity at: - constant pressure, -constant volume,- saturation
    */
   'specific_heat_capacity_at:_-_constant_pressure': {
       'joule_per_kilogram_kelvin': makeEUInformation("B11","J/(kg·K)","joule per kilogram kelvin"),
       'kilojoule_per_kilogram_kelvin': makeEUInformation("B43","kJ/(kg·K)","kilojoule per kilogram kelvin"),
       'British_thermal_unit(international_table)_per_pound_degree_Rankine': makeEUInformation("A21","Btu/IT(lb·°R)","British thermal unit (international table) per pound degree Rankine"),
       'calorie(international_table)_per_gram_kelvin': makeEUInformation("D76","calIT/(g·K)","calorie (international table) per gram kelvin"),
       'calorie(thermochemical)_per_gram_kelvin': makeEUInformation("D37","calth/(g·K)","calorie (thermochemical) per gram kelvin"),
    },
   /**
    * ratio of the specific heat capacities, ratio of the massic heat capacity, isentropic exponent
    */
   'ratio_of_the_specific_heat_capacities': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * massieu function, planck function
    */
   'massieu_function': {
       'joule_per_kelvin': makeEUInformation("JE","J/K","joule per kelvin"),
    },
   /**
    * massic energy, specific energy
    */
   'massic_energy': {
       'joule_per_kilogram': makeEUInformation("J2","J/kg","joule per kilogram"),
    },
   /**
    * massic thermodynamic energy
    */
   'massic_thermodynamic_energy': {
       'joule_per_gram': makeEUInformation("D95","J/g","joule per gram"),
       'kilojoule_per_gram': makeEUInformation("Q31","kJ/g","kilojoule per gram"),
    },
   /**
    * specific thermodynamic energy
    */
   'specific_thermodynamic_energy': {
       'megajoule_per_kilogram': makeEUInformation("JK","MJ/kg","megajoule per kilogram"),
    },
   /**
    * massic enthalpy, specific enthalpy
    */
   'massic_enthalpy': {
       'kilojoule_per_kilogram': makeEUInformation("B42","kJ/kg","kilojoule per kilogram"),
    },
   /**
    * massic Helmholtz free energy,
    */
   'massic_Helmholtz_free_energy': {
       'British_thermal_unit(international_table)_per_pound': makeEUInformation("AZ","BtuIT/lb","British thermal unit (international table) per pound"),
       'British_thermal_unit(thermochemical)_per_pound': makeEUInformation("N73","Btuth/lb","British thermal unit (thermochemical) per pound"),
    },
   /**
    * specific Helmholtz free energy
    */
   'specific_Helmholtz_free_energy': {
       'calorie(international_table)_per_gram': makeEUInformation("D75","calIT/g","calorie (international table) per gram"),
    },
   /**
    * specific Helmholtz function, massic Gibbs free energy, specific Gibbs free energy
    */
   'specific_Helmholtz_function': {
       'calorie(thermochemical)_per_gram': makeEUInformation("B36","calth/g","calorie (thermochemical) per gram"),
    },
   /**
    * energy density
    */
   'energy_density': {
       'British_thermal_unit(international_table)_per_cubic_foot_': makeEUInformation("N58","BtuIT/ft³","British thermal unit (international table) per cubic foot"),
       'British_thermal_unit(thermochemical)_per_cubic_foot': makeEUInformation("N59","Btuth/ft³","British thermal unit (thermochemical) per cubic foot"),
    },
  },
 /**
  * Electricity and Magnetism
  */
 'Electricity_and_Magnetism': {
   /**
    * electric current, magnetic potential difference, magnetomotive force,current linkage
    */
   'electric_current': {
       'ampere': makeEUInformation("AMP","A","ampere"),
       'kiloampere': makeEUInformation("B22","kA","kiloampere"),
       'megaampere': makeEUInformation("H38","MA","megaampere"),
       'milliampere': makeEUInformation("4K","mA","milliampere"),
       'microampere': makeEUInformation("B84","µA","microampere"),
       'nanoampere': makeEUInformation("C39","nA","nanoampere"),
       'picoampere': makeEUInformation("C70","pA","picoampere"),
       'biot': makeEUInformation("N96","Bi","biot"),
       'gilbert': makeEUInformation("N97","Gi","gilbert"),
    },
   /**
    * electric charge, quantity of electricity, electric flux (flux of displacement)
    */
   'electric_charge': {
       'coulomb': makeEUInformation("COU","C","coulomb"),
       'ampere_second': makeEUInformation("A8","A·s","ampere second"),
       'ampere_squared_second': makeEUInformation("H32","A²·s","ampere squared second"),
       'ampere_hour': makeEUInformation("AMH","A·h","ampere hour"),
       'kiloampere_hour(thousand_ampere_hour)': makeEUInformation("TAH","kA·h","kiloampere hour (thousand ampere hour)"),
       'megacoulomb': makeEUInformation("D77","MC","megacoulomb"),
       'millicoulomb': makeEUInformation("D86","mC","millicoulomb"),
       'kilocoulomb': makeEUInformation("B26","kC","kilocoulomb"),
       'microcoulomb': makeEUInformation("B86","µC","microcoulomb"),
       'nanocoulomb': makeEUInformation("C40","nC","nanocoulomb"),
       'picocoulomb': makeEUInformation("C71","pC","picocoulomb"),
       'milliampere_hour': makeEUInformation("E09","mA·h","milliampere hour"),
       'ampere_minute': makeEUInformation("N95","A·min","ampere minute"),
       'franklin': makeEUInformation("N94","Fr","franklin"),
    },
   /**
    * volume density of charge, charge density, volumic charge
    */
   'volume_density_of_charge': {
       'coulomb_per_cubic_metre': makeEUInformation("A29","C/m³","coulomb per cubic metre"),
       'gigacoulomb_per_cubic_metre': makeEUInformation("A84","GC/m³","gigacoulomb per cubic metre"),
       'coulomb_per_cubic_millimetre': makeEUInformation("A30","C/mm³","coulomb per cubic millimetre"),
       'megacoulomb_per_cubic_metre': makeEUInformation("B69","MC/m³","megacoulomb per cubic metre"),
       'coulomb_per_cubic_centimetre': makeEUInformation("A28","C/cm³","coulomb per cubic centimetre"),
       'kilocoulomb_per_cubic_metre': makeEUInformation("B27","kC/m³","kilocoulomb per cubic metre"),
       'millicoulomb_per_cubic_metre': makeEUInformation("D88","mC/m³","millicoulomb per cubic metre"),
       'microcoulomb_per_cubic_metre': makeEUInformation("B87","µC/m³","microcoulomb per cubic metre"),
    },
   /**
    * surface density of charge, electric flux density, displacement electric polarization
    */
   'surface_density_of_charge': {
       'coulomb_per_square_metre': makeEUInformation("A34","C/m²","coulomb per square metre"),
       'megacoulomb_per_square_metre': makeEUInformation("B70","MC/m²","megacoulomb per square metre"),
       'coulomb_per_square_millimetre': makeEUInformation("A35","C/mm²","coulomb per square millimetre"),
       'coulomb_per_square_centimetre': makeEUInformation("A33","C/cm²","coulomb per square centimetre"),
       'kilocoulomb_per_square_metre': makeEUInformation("B28","kC/m²","kilocoulomb per square metre"),
       'millicoulomb_per_square_metre': makeEUInformation("D89","mC/m²","millicoulomb per square metre"),
       'microcoulomb_per_square_metre': makeEUInformation("B88","µC/m²","microcoulomb per square metre"),
    },
   /**
    * electric field strength
    */
   'electric_field_strength': {
       'volt_per_metre': makeEUInformation("D50","V/m","volt per metre"),
       'volt_second_per_metre': makeEUInformation("H45","V·s/m","volt second per metre"),
       'volt_squared_per_kelvin_squared': makeEUInformation("D45","V²/K²","volt squared per kelvin squared"),
       'volt_per_millimetre': makeEUInformation("D51","V/mm","volt per millimetre"),
       'volt_per_microsecond': makeEUInformation("H24","V/µs","volt per microsecond"),
       'millivolt_per_minute': makeEUInformation("H62","mV/min","millivolt per minute"),
       'volt_per_second': makeEUInformation("H46","V/s","volt per second"),
       'megavolt_per_metre': makeEUInformation("B79","MV/m","megavolt per metre"),
       'kilovolt_per_metre': makeEUInformation("B55","kV/m","kilovolt per metre"),
       'volt_per_centimetre': makeEUInformation("D47","V/cm","volt per centimetre"),
       'millivolt_per_metre': makeEUInformation("C30","mV/m","millivolt per metre"),
       'microvolt_per_metre': makeEUInformation("C3","µV/m","microvolt per metre"),
       'volt_per_bar': makeEUInformation("G60","V/bar","volt per bar"),
       'volt_per_pascal': makeEUInformation("N98","V/Pa","volt per pascal"),
       'volt_per_litre_minute': makeEUInformation("F87","V/(l·min)","volt per litre minute"),
       'volt_square_inch_per_pound-force': makeEUInformation("H22","V/(lbf/in²)","volt square inch per pound-force"),
       'volt_per_inch': makeEUInformation("H23","V/in","volt per inch"),
    },
   /**
    * electric potential, potential difference, tension, voltage, electromotive force
    */
   'electric_potential': {
       'volt': makeEUInformation("VLT","V","volt"),
       'megavolt': makeEUInformation("B78","MV","megavolt"),
       'kilovolt': makeEUInformation("KVT","kV","kilovolt"),
       'millivolt': makeEUInformation("2Z","mV","millivolt"),
       'microvolt': makeEUInformation("D82","µV","microvolt"),
       'picovolt': makeEUInformation("N99","pV","picovolt"),
    },
   /**
    * capacitance
    */
   'capacitance': {
       'farad': makeEUInformation("FAR","F","farad"),
       'attofarad': makeEUInformation("H48","aF","attofarad"),
       'millifarad': makeEUInformation("C10","mF","millifarad"),
       'microfarad': makeEUInformation("4O","µF","microfarad"),
       'nanofarad': makeEUInformation("C41","nF","nanofarad"),
       'picofarad': makeEUInformation("4T","pF","picofarad"),
       'kilofarad': makeEUInformation("N90","kF","kilofarad"),
    },
   /**
    * permittivity, permittivity of vacuum, (electric constant)
    */
   'permittivity': {
       'farad_per_metre': makeEUInformation("A69","F/m","farad per metre"),
       'microfarad_per_kilometre': makeEUInformation("H28","µF/km","microfarad per kilometre"),
       'farad_per_kilometre': makeEUInformation("H33","F/km","farad per kilometre"),
       'microfarad_per_metre': makeEUInformation("B89","µF/m","microfarad per metre"),
       'nanofarad_per_metre': makeEUInformation("C42","nF/m","nanofarad per metre"),
       'picofarad_per_metre': makeEUInformation("C72","pF/m","picofarad per metre"),
    },
   /**
    * relative permittivity
    */
   'relative_permittivity': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * electric susceptibility
    */
   'electric_susceptibility': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * electric dipole moment
    */
   'electric_dipole_moment': {
       'coulomb_metre': makeEUInformation("A26","C·m","coulomb metre"),
    },
   /**
    * current density
    */
   'current_density': {
       'ampere_per_square_metre': makeEUInformation("A41","A/m²","ampere per square metre"),
       'ampere_per_kilogram': makeEUInformation("H31","A/kg","ampere per kilogram"),
       'megaampere_per_square_metre': makeEUInformation("B66","MA/m²","megaampere per square metre"),
       'ampere_per_square_millimetre': makeEUInformation("A7","A/mm²","ampere per square millimetre"),
       'ampere_per_square_centimetre': makeEUInformation("A4","A/cm²","ampere per square centimetre"),
       'kiloampere_per_square_metre': makeEUInformation("B23","kA/m²","kiloampere per square metre"),
       'milliampere_per_litre_minute': makeEUInformation("G59","mA/(l·min)","milliampere per litre minute"),
       'ampere_per_pascal': makeEUInformation("N93","A/Pa","ampere per pascal"),
       'milliampere_per_pound-force_per_square_inch': makeEUInformation("F57","mA/(lbf/in²)","milliampere per pound-force per square inch"),
    },
   /**
    * linear electric current density, lineic electric current, magnetic field strength
    */
   'linear_electric_current_density': {
       'milliampere_per_bar': makeEUInformation("F59","mA/bar","milliampere per bar"),
       'ampere_per_metre': makeEUInformation("AE","A/m","ampere per metre"),
       'kiloampere_per_metre': makeEUInformation("B24","kA/m","kiloampere per metre"),
       'ampere_per_millimetre': makeEUInformation("A3","A/mm","ampere per millimetre"),
       'ampere_per_centimetre': makeEUInformation("A2","A/cm","ampere per centimetre"),
       'milliampere_per_millimetre': makeEUInformation("F76","mA/mm","milliampere per millimetre"),
       'milliampere_per_inch': makeEUInformation("F08","mA/in","milliampere per inch"),
    },
   /**
    * lineic charge
    */
   'lineic_charge': {
       'coulomb_per_metre': makeEUInformation("P10","C/m","coulomb per metre"),
    },
   /**
    * magnetic flux density, magnetic induction, magnetic polarization
    */
   'magnetic_flux_density': {
       'tesla': makeEUInformation("D33","T","tesla"),
       'millitesla': makeEUInformation("C29","mT","millitesla"),
       'microtesla': makeEUInformation("D81","µT","microtesla"),
       'nanotesla': makeEUInformation("C48","nT","nanotesla"),
       'kilotesla': makeEUInformation("P13","kT","kilotesla"),
       'gamma': makeEUInformation("P12","γ","gamma"),
    },
   /**
    * magnetic flux
    */
   'magnetic_flux': {
       'weber': makeEUInformation("WEB","Wb","weber"),
       'milliweber': makeEUInformation("C33","mWb","milliweber"),
       'kiloweber': makeEUInformation("P11","kWb","kiloweber"),
    },
   /**
    * magnetic vector potential
    */
   'magnetic_vector_potential': {
       'weber_per_metre': makeEUInformation("D59","Wb/m","weber per metre"),
       'kiloweber_per_metre': makeEUInformation("B56","kWb/m","kiloweber per metre"),
       'weber_per_millimetre': makeEUInformation("D60","Wb/mm","weber per millimetre"),
    },
   /**
    * self inductance, mutual inductance, permeance
    */
   'self_inductance': {
       'henry': makeEUInformation("81","H","henry"),
       'millihenry': makeEUInformation("C14","mH","millihenry"),
       'microhenry': makeEUInformation("B90","µH","microhenry"),
       'nanohenry': makeEUInformation("C43","nH","nanohenry"),
       'picohenry': makeEUInformation("C73","pH","picohenry"),
       'henry_per_kiloohm': makeEUInformation("H03","H/kΩ","henry per kiloohm"),
       'henry_per_ohm': makeEUInformation("H04","H/Ω","henry per ohm"),
       'microhenry_per_kiloohm': makeEUInformation("G98","µH/kΩ","microhenry per kiloohm"),
       'microhenry_per_ohm': makeEUInformation("G99","µH/Ω","microhenry per ohm"),
       'millihenry_per_kiloohm': makeEUInformation("H05","mH/kΩ","millihenry per kiloohm"),
       'millihenry_per_ohm': makeEUInformation("H06","mH/Ω","millihenry per ohm"),
       'kilohenry': makeEUInformation("P24","kH","kilohenry"),
    },
   /**
    * coupling coefficient, leakage coefficient
    */
   'coupling_coefficient': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * number of turns in a winding, number of phases, number of pairs of poles
    */
   'number_of_turns_in_a_winding': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * permeability, permeability of vacuum, magnetic constant
    */
   'permeability': {
       'henry_per_metre': makeEUInformation("A98","H/m","henry per metre"),
       'microhenry_per_metre': makeEUInformation("B91","µH/m","microhenry per metre"),
       'nanohenry_per_metre': makeEUInformation("C44","nH/m","nanohenry per metre"),
    },
   /**
    * relative permeability
    */
   'relative_permeability': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * magnetic susceptibility
    */
   'magnetic_susceptibility': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * electromagnetic moment, magnetic moment, (magnetic area moment)
    */
   'electromagnetic_moment': {
       'ampere_square_metre': makeEUInformation("A5","A·m²","ampere square metre"),
    },
   /**
    * magnetization
    */
   'magnetization': {
       'ampere_per_metre': makeEUInformation("AE","A/m","ampere per metre"),
    },
   /**
    * electromagnetic energy density, volumic electromagnetic energy
    */
   'electromagnetic_energy_density': {
       'joule_per_cubic_metre': makeEUInformation("B8","J/m³","joule per cubic metre"),
    },
   /**
    * Poynting vector
    */
   'Poynting_vector': {
       'watt_per_square_metre': makeEUInformation("D54","W/m²","watt per square metre"),
    },
   /**
    * phase velocity of electromagnetic  waves, phase speed of electromagnetic waves
    */
   'phase_velocity_of_electromagnetic__waves': {
       'metre_per_second': makeEUInformation("MTS","m/s","metre per second"),
    },
   /**
    * resistance (to direct current), impedance, (complex impedances), modulus of impedance, resistance (to alternating current), reactance
    */
   'resistance': {
       'ohm': makeEUInformation("OHM","Ω","ohm"),
       'gigaohm': makeEUInformation("A87","GΩ","gigaohm"),
       'megaohm': makeEUInformation("B75","MΩ","megaohm"),
       'teraohm': makeEUInformation("H44","TΩ","teraohm"),
       'kiloohm': makeEUInformation("B49","kΩ","kiloohm"),
       'milliohm': makeEUInformation("E45","mΩ","milliohm"),
       'microohm': makeEUInformation("B94","µΩ","microohm"),
       'nanoohm': makeEUInformation("P22","nΩ","nanoohm"),
    },
   /**
    * resistance load per unit length
    */
   'resistance_load_per_unit_length': {
       'gigaohm_per_metre': makeEUInformation("M26","GΩ/m","gigaohm per metre"),
    },
   /**
    * conductance (for direct current), admittance, (complex admittance), modulus of admittance,(admittance), conductance (for alternating current)
    */
   'conductance': {
       'siemens': makeEUInformation("SIE","S","siemens"),
       'kilosiemens': makeEUInformation("B53","kS","kilosiemens"),
       'millisiemens': makeEUInformation("C27","mS","millisiemens"),
       'microsiemens': makeEUInformation("B99","µS","microsiemens"),
       'microsiemens_per_centimetre': makeEUInformation("G42","µS/cm","microsiemens per centimetre"),
       'microsiemens_per_metre': makeEUInformation("G43","µS/m","microsiemens per metre"),
       'picosiemens': makeEUInformation("N92","pS","picosiemens"),
    },
   /**
    * susceptance
    */
   'susceptance': {
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NQ. displayName/description below are node-opcua's own, from UNECE rec20. */
       'mho': makeEUInformation("NQ","","mho (S)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'micromho': makeEUInformation("NR","","micromho (10⁻⁶ S)"),
    },
   /**
    * resistivity
    */
   'resistivity': {
       'ohm_metre': makeEUInformation("C61","Ω·m","ohm metre"),
       'gigaohm_metre': makeEUInformation("A88","GΩ·m","gigaohm metre"),
       'megaohm_metre': makeEUInformation("B76","MΩ·m","megaohm metre"),
       'megaohm_kilometre': makeEUInformation("H88","MΩ·km","megaohm kilometre"),
       'kiloohm_metre': makeEUInformation("B50","kΩ·m","kiloohm metre"),
       'ohm_centimetre': makeEUInformation("C60","Ω·cm","ohm centimetre"),
       'milliohm_metre': makeEUInformation("C23","mΩ·m","milliohm metre"),
       'microohm_metre': makeEUInformation("B95","µΩ·m","microohm metre"),
       'nanoohm_metre': makeEUInformation("C46","nΩ·m","nanoohm metre"),
       'ohm_kilometre': makeEUInformation("M24","Ω·km","ohm kilometre"),
       'ohm_circular-mil_per_foot_': makeEUInformation("P23","Ω·cmil/ft","ohm circular-mil per foot"),
    },
   /**
    * lineic resistance
    */
   'lineic_resistance': {
       'ohm_per_kilometre': makeEUInformation("F56","Ω/km","ohm per kilometre"),
       'ohm_per_metre': makeEUInformation("H26","Ω/m","ohm per metre"),
       'megaohm_per_metre': makeEUInformation("H37","MΩ/m","megaohm per metre"),
       'milliohm_per_metre': makeEUInformation("F54","mΩ/m","milliohm per metre"),
       'megaohm_per_kilometre': makeEUInformation("H36","MΩ/km","megaohm per kilometre"),
       'ohm_per_mile(statute_mile)': makeEUInformation("F55","Ω/mi","ohm per mile (statute mile)"),
    },
   /**
    * conductivity
    */
   'conductivity': {
       'siemens_per_metre': makeEUInformation("D10","S/m","siemens per metre"),
       'siemens_per_centimetre': makeEUInformation("H43","S/cm","siemens per centimetre"),
       'millisiemens_per_centimetre': makeEUInformation("H61","mS/cm","millisiemens per centimetre"),
       'megasiemens_per_metre': makeEUInformation("B77","MS/m","megasiemens per metre"),
       'kilosiemens_per_metre': makeEUInformation("B54","kS/m","kilosiemens per metre"),
       'nanosiemens_per_metre': makeEUInformation("G45","nS/m","nanosiemens per metre"),
       'nanosiemens_per_centimetre': makeEUInformation("G44","nS/cm","nanosiemens per centimetre"),
       'picosiemens_per_metre': makeEUInformation("L42","pS/m","picosiemens per metre"),
    },
   /**
    * reluctance
    */
   'reluctance': {
       'reciprocal_henry': makeEUInformation("C89","H⁻¹","reciprocal henry"),
    },
   /**
    * phase difference, phase displacement, loss angle
    */
   'phase_difference': {
       'radian': makeEUInformation("C81","rad","radian"),
    },
   /**
    * power (for direct current), active power
    */
   'power': {
       'watt': makeEUInformation("WTT","W","watt"),
       'joule_per_second': makeEUInformation("P14","J/s","joule per second"),
       'kilowatt': makeEUInformation("KWT","kW","kilowatt"),
       'megawatt': makeEUInformation("MAW","MW","megawatt"),
       'gigawatt': makeEUInformation("A90","GW","gigawatt"),
       'terawatt': makeEUInformation("D31","TW","terawatt"),
       'milliwatt': makeEUInformation("C31","mW","milliwatt"),
       'joule_per_minute': makeEUInformation("P15","J/min","joule per minute"),
       'joule_per_hour': makeEUInformation("P16","J/h","joule per hour"),
       'joule_per_day': makeEUInformation("P17","J/d","joule per day"),
       'kilojoule_per_second': makeEUInformation("P18","kJ/s","kilojoule per second"),
       'kilojoule_per_minute': makeEUInformation("P19","kJ/min","kilojoule per minute"),
       'kilojoule_per_hour': makeEUInformation("P20","kJ/h","kilojoule per hour"),
       'kilojoule_per_day': makeEUInformation("P21","kJ/d","kilojoule per day"),
       'microwatt': makeEUInformation("D80","µW","microwatt"),
       'horsepower(electric)': makeEUInformation("K43","electric hp","horsepower (electric)"),
       'nanowatt': makeEUInformation("C49","nW","nanowatt"),
       'picowatt': makeEUInformation("C75","pW","picowatt"),
    },
   /**
    * apparent power
    */
   'apparent_power': {
       'volt-ampere': makeEUInformation("D46","V·A","volt - ampere"),
       'megavolt-ampere': makeEUInformation("MVA","MV·A","megavolt - ampere"),
       'kilovolt-ampere': makeEUInformation("KVA","kV·A","kilovolt - ampere"),
       'millivolt-ampere': makeEUInformation("M35","mV·A","millivolt - ampere"),
    },
   /**
    * reactive power
    */
   'reactive_power': {
       'var': makeEUInformation("D44","var","var"),
       'kilovolt_ampere(reactive)': makeEUInformation("K5","kvar","kilovolt ampere (reactive)"),
       'kilovar': makeEUInformation("KVR","kvar","kilovar"),
       'megavar': makeEUInformation("MAR","mvar","megavar"),
    },
   /**
    * active energy
    */
   'active_energy': {
       'joule': makeEUInformation("JOU","J","joule"),
       'watt_hour': makeEUInformation("WHR","W·h","watt hour"),
    },
   /**
    * coefficient, performance characteristic
    */
   'coefficient': {
       'reciprocal_joule': makeEUInformation("N91","1/J","reciprocal joule"),
       'reciprocal_volt-ampere_reciprocal_second': makeEUInformation("M30","1/(V·A·s)","reciprocal volt - ampere reciprocal second"),
       'kilohertz_metre': makeEUInformation("M17","kHz·m","kilohertz metre"),
       'gigahertz_metre': makeEUInformation("M18","GHz·m","gigahertz metre"),
       'megahertz_metre': makeEUInformation("M27","MHz·m","megahertz metre"),
       'reciprocal_kilovolt-ampere_reciprocal_hour': makeEUInformation("M21","1/kVAh","reciprocal kilovolt - ampere reciprocal hour"),
       'hertz_metre': makeEUInformation("H34","Hz·m","hertz metre"),
       'megahertz_kilometre': makeEUInformation("H39","MHz·km","megahertz kilometre"),
    },
  },
 /**
  * Light and Related Electromagnetic Radiations
  */
 'Light_and_Related_Electromagnetic_Radiations': {
   /**
    * frequency
    */
   'frequency': {
       'hertz': makeEUInformation("HTZ","Hz","hertz"),
    },
   /**
    * circular frequency
    */
   'circular_frequency': {
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
       'radian_per_second': makeEUInformation("2A","rad/s","radian per second"),
    },
   /**
    * wavelength
    */
   'wavelength': {
       'metre': makeEUInformation("MTR","m","metre"),
       'angstrom': makeEUInformation("A11","Å","angstrom"),
    },
   /**
    * wavenumber, repetency
    */
   'wavenumber': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * angular wave number, angular repetency
    */
   'angular_wave_number': {
       'radian_per_metre': makeEUInformation("C84","rad/m","radian per metre"),
    },
   /**
    * velocity (speed) on propagation of electromagnetic waves in vacuo
    */
   'velocity__on_propagation_of_electromagnetic_waves_in_vacuo': {
       'metre_per_second': makeEUInformation("MTS","m/s","metre per second"),
    },
   /**
    * radiant energy, fluence rate, radiant exitance, irradiance, first radiation constant
    */
   'radiant_energy': {
       'joule': makeEUInformation("JOU","J","joule"),
       'watt_per_square_metre': makeEUInformation("D54","W/m²","watt per square metre"),
       'watt_per_cubic_metre': makeEUInformation("H47","W/m³","watt per cubic metre"),
       'watt_per_metre': makeEUInformation("H74","W/m","watt per metre"),
    },
   /**
    * radiant energy density
    */
   'radiant_energy_density': {
       'joule_per_cubic_metre': makeEUInformation("B8","J/m³","joule per cubic metre"),
       'megajoule_per_cubic_metre': makeEUInformation("JM","MJ/m³","megajoule per cubic metre"),
    },
   /**
    * spectral concentration of radiant energy density (in terms of wavelength),spectral radiant energy density (in terms of wave length)
    */
   'spectral_concentration_of_radiant_energy_density': {
       'joule_per_metre_to_the_fourth_power': makeEUInformation("B14","J/m⁴","joule per metre to the fourth power"),
    },
   /**
    * radiant power, (radiant energyflux)
    */
   'radiant_power': {
       'watt': makeEUInformation("WTT","W","watt"),
    },
   /**
    * radiant energy fluence, radiance exposure
    */
   'radiant_energy_fluence': {
       'joule_per_square_metre': makeEUInformation("B13","J/m²","joule per square metre"),
       'joule_per_square_centimetre': makeEUInformation("E43","J/cm²","joule per square centimetre"),
       'British_thermal_unit(international_table)_per_square_foot': makeEUInformation("P37","BtuIT/ft²","British thermal unit (international table) per square foot"),
       'British_thermal_unit(thermochemical)_per_square_foot': makeEUInformation("P38","Btuth/ft²","British thermal unit (thermochemical) per square foot"),
       'calorie(thermochemical)_per_square_centimetre_': makeEUInformation("P39","calth/cm²","calorie (thermochemical) per square centimetre"),
       'langley': makeEUInformation("P40","Ly","langley"),
    },
   /**
    * photon flux
    */
   'photon_flux': {
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
    },
   /**
    * photon intensity
    */
   'photon_intensity': {
       'reciprocal_second_per_steradian': makeEUInformation("D1","s⁻¹/sr","reciprocal second per steradian"),
    },
   /**
    * photon luminance, photon radiance
    */
   'photon_luminance': {
       'reciprocal_second_per_steradian_metre_squared': makeEUInformation("D2","s⁻¹/(sr·m²)","reciprocal second per steradian metre squared"),
    },
   /**
    * photon exitance, irradiance
    */
   'photon_exitance': {
       'reciprocal_second_per_metre_squared': makeEUInformation("C99","s⁻¹/m²","reciprocal second per metre squared"),
    },
   /**
    * photon exposure
    */
   'photon_exposure': {
       'reciprocal_square_metre': makeEUInformation("C93","m⁻²","reciprocal square metre"),
    },
   /**
    * radiant intensity
    */
   'radiant_intensity': {
       'watt_per_steradian': makeEUInformation("D57","W/sr","watt per steradian"),
    },
   /**
    * radiance
    */
   'radiance': {
       'watt_per_steradian_square_metre': makeEUInformation("D58","W/(sr·m²)","watt per steradian square metre"),
    },
   /**
    * Stefan-Boltzmann constant
    */
   'Stefan-Boltzmann_constant': {
       'watt_per_square_metre_kelvin_to_the_fourth_power': makeEUInformation("D56","W/(m²·K⁴)","watt per square metre kelvin to the fourth power"),
    },
   /**
    * second radiation constant
    */
   'second_radiation_constant': {
       'metre_kelvin': makeEUInformation("D18","m·K","metre kelvin"),
    },
   /**
    * emissivity, spectral emissivity, emissivity at a specified wavelength, directional spectral emissivity
    */
   'emissivity': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * luminous intensity
    */
   'luminous_intensity': {
       'candela': makeEUInformation("CDL","cd","candela"),
       'kilocandela': makeEUInformation("P33","kcd","kilocandela"),
       'millicandela': makeEUInformation("P34","mcd","millicandela"),
       'Hefner-Kerze': makeEUInformation("P35","HK","Hefner-Kerze"),
       'international_candle_': makeEUInformation("P36","IK","international candle"),
    },
   /**
    * luminous flux
    */
   'luminous_flux': {
       'lumen': makeEUInformation("LUM","lm","lumen"),
    },
   /**
    * quantity of light
    */
   'quantity_of_light': {
       'lumen_second': makeEUInformation("B62","lm·s","lumen second"),
       'lumen_hour': makeEUInformation("B59","lm·h","lumen hour"),
    },
   /**
    * luminance
    */
   'luminance': {
       'candela_per_square_metre': makeEUInformation("A24","cd/m²","candela per square metre"),
       'candela_per_square_inch_': makeEUInformation("P28","cd/in²","candela per square inch"),
       'footlambert': makeEUInformation("P29","ftL","footlambert"),
       'lambert': makeEUInformation("P30","Lb","lambert"),
       'stilb': makeEUInformation("P31","sb","stilb"),
       'candela_per_square_foot': makeEUInformation("P32","cd/ft²","candela per square foot"),
    },
   /**
    * luminous exitance
    */
   'luminous_exitance': {
       'lumen_per_square_metre': makeEUInformation("B60","lm/m²","lumen per square metre"),
    },
   /**
    * illuminance
    */
   'illuminance': {
       'lux': makeEUInformation("LUX","lx","lux"),
       'kilolux': makeEUInformation("KLX","klx","kilolux"),
       'lumen_per_square_foot_': makeEUInformation("P25","lm/ft²","lumen per square foot"),
       'phot': makeEUInformation("P26","ph","phot"),
       'footcandle': makeEUInformation("P27","ftc","footcandle"),
    },
   /**
    * light exposure
    */
   'light_exposure': {
       'lux_second': makeEUInformation("B64","lx·s","lux second"),
       'lux_hour': makeEUInformation("B63","lx·h","lux hour"),
    },
   /**
    * luminious efficacy, spectral luminous efficacy, luminous efficacy at a specified wavelength, maximum spectral luminous efficacy
    */
   'luminious_efficacy': {
       'lumen_per_watt': makeEUInformation("B61","lm/W","lumen per watt"),
    },
   /**
    * luminous efficiency, spectral luminous efficiency,luminous efficiency at a specified wavelength
    */
   'luminous_efficiency': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * CIE colorimetric functions
    */
   'CIE_colorimetric_functions': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * coordinates trichromatic
    */
   'coordinates_trichromatic': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * spectral absorption factor, spectral absorptance, spectral reflectionfactor,spectral reflectance, spectral transmission factor, spectral transmittance, spectral radiance factor
    */
   'spectral_absorption_factor': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * optical density
    */
   'optical_density': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * refractive index
    */
   'refractive_index': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * linear attenuation coefficient
    */
   'linear_attenuation_coefficient': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * molar absorption coefficient
    */
   'molar_absorption_coefficient': {
       'square_metre_per_mole': makeEUInformation("D22","m²/mol","square metre per mole"),
    },
   /**
    * object distance, image distance, focal distance
    */
   'object_distance': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * vergence, lens power
    */
   'vergence': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
  },
 /**
  * Acoustics
  */
 'Acoustics': {
   /**
    * period, periodic time
    */
   'period': {
       'second[unit_of_time]': makeEUInformation("SEC","s","second [unit of time]"),
    },
   /**
    * frequency
    */
   'frequency': {
       'hertz': makeEUInformation("HTZ","Hz","hertz"),
    },
   /**
    * frequency interval
    */
   'frequency_interval': {
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code C59. displayName/description below are node-opcua's own, from UNECE rec20. */
       'octave': makeEUInformation("C59","","octave - A unit used in music to describe the ratio in frequency between notes."),
    },
   /**
    * angular frequency, pulsatance
    */
   'angular_frequency': {
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
       'radian_per_second': makeEUInformation("2A","rad/s","radian per second"),
    },
   /**
    * wavelength
    */
   'wavelength': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * repetency, wavenumber
    */
   'repetency': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * angular repetency, angular wave number
    */
   'angular_repetency': {
       'radian_per_metre': makeEUInformation("C84","rad/m","radian per metre"),
    },
   /**
    * volumic mass, mass density, density, mass concentration of B, amount of substance, concentration of B
    */
   'volumic_mass': {
       'kilogram_per_cubic_metre': makeEUInformation("KMQ","kg/m³","kilogram per cubic metre"),
    },
   /**
    * static pressure, (instantaneous) sound pressure
    */
   'static_pressure': {
       'pascal': makeEUInformation("PAL","Pa","pascal"),
       'bar[unit_of_pressure]': makeEUInformation("BAR","bar","bar [unit of pressure]"),
       'dyne_per_square_centimetre': makeEUInformation("D9","dyn/cm²","dyne per square centimetre"),
    },
   /**
    * (instantaneous) sound particle displacement
    */
   'sound_particle_displacement': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * (instantaneous) sound particle velocity
    */
   'sound_particle_velocity': {
       'metre_per_second': makeEUInformation("MTS","m/s","metre per second"),
    },
   /**
    * (instantaneous) sound particle acceleration
    */
   'sound_particle_acceleration': {
       'metre_per_second_squared': makeEUInformation("MSK","m/s²","metre per second squared"),
    },
   /**
    * (instantaneous) volume flow rate
    */
   'volume_flow_rate': {
       'cubic_metre_per_second': makeEUInformation("MQS","m³/s","cubic metre per second"),
    },
   /**
    * velocity of sound (phase velocity), group velocity
    */
   'velocity_of_sound': {
       'metre_per_second': makeEUInformation("MTS","m/s","metre per second"),
    },
   /**
    * sound energy density, volumic, sound energy
    */
   'sound_energy_density': {
       'joule_per_cubic_metre': makeEUInformation("B8","J/m³","joule per cubic metre"),
       'erg_per_cubic_centimetre': makeEUInformation("A60","erg/cm³","erg per cubic centimetre"),
    },
   /**
    * sound power
    */
   'sound_power': {
       'watt': makeEUInformation("WTT","W","watt"),
       'erg_per_second': makeEUInformation("A63","erg/s","erg per second"),
    },
   /**
    * sound intensity
    */
   'sound_intensity': {
       'watt_per_square_metre': makeEUInformation("D54","W/m²","watt per square metre"),
       'milliwatt_per_square_metre': makeEUInformation("C32","mW/m²","milliwatt per square metre"),
       'microwatt_per_square_metre': makeEUInformation("D85","µW/m²","microwatt per square metre"),
       'picowatt_per_square_metre': makeEUInformation("C76","pW/m²","picowatt per square metre"),
       'erg_per_second_square_centimetre': makeEUInformation("A64","erg/(s·cm²)","erg per second square centimetre"),
    },
   /**
    * characteristic impedance of a medium
    */
   'characteristic_impedance_of_a_medium': {
       'pascal_second_per_metre': makeEUInformation("C67","Pa· s/m","pascal second per metre"),
    },
   /**
    * surface density of mechanical impedance
    */
   'surface_density_of_mechanical_impedance': {
       'dyne_second_per_cubic_centimetre': makeEUInformation("A50","dyn·s/cm³","dyne second per cubic centimetre"),
    },
   /**
    * acoustic impedance
    */
   'acoustic_impedance': {
       'pascal_second_per_cubic_metre': makeEUInformation("C66","Pa·s/m³","pascal second per cubic metre"),
       'dyne_second_per_centimetre_to_the_fifth_power': makeEUInformation("A52","dyn·s/cm⁵","dyne second per centimetre to the fifth power"),
       'pascal_second_per_litre': makeEUInformation("M32","Pa·s/l","pascal second per litre"),
    },
   /**
    * mechanical impedance
    */
   'mechanical_impedance': {
       'newton_second_per_metre': makeEUInformation("C58","N·s/m","newton second per metre"),
       'dyne_second_per_centimetre': makeEUInformation("A51","dyn·s/cm","dyne second per centimetre"),
    },
   /**
    * sound pressure level, sound power level
    */
   'sound_pressure_level': {
       'decibel': makeEUInformation("2N","dB","decibel"),
       'bel_per_metre': makeEUInformation("P43","B/m","bel per metre"),
       'decibel_per_kilometre': makeEUInformation("H51","dB/km","decibel per kilometre"),
       'decibel_per_metre': makeEUInformation("H52","dB/m","decibel per metre"),
    },
   /**
    * damping coefficient
    */
   'damping_coefficient': {
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
       'neper_per_second': makeEUInformation("C51","Np/s","neper per second"),
    },
   /**
    * time constant, relaxation time
    */
   'time_constant': {
       'second[unit_of_time]': makeEUInformation("SEC","s","second [unit of time]"),
    },
   /**
    * logarithmic decrement
    */
   'logarithmic_decrement': {
       'neper': makeEUInformation("C50","Np","neper"),
       'decade(logarithmic)': makeEUInformation("P41","dec","decade (logarithmic)"),
    },
   /**
    * attenuation coefficient, phase coefficient, propagation coefficient
    */
   'attenuation_coefficient': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * dissipation factor, dissipance, reflection factor, reflectance, transmission factor, transmittance, absorption factor, absorbance
    */
   'dissipation_factor': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * sound reduction index
    */
   'sound_reduction_index': {
       'decibel': makeEUInformation("2N","dB","decibel"),
    },
   /**
    * equivalent absorption area of a surface or object
    */
   'equivalent_absorption_area_of_a_surface_or_object': {
       'square_metre': makeEUInformation("MTK","m²","square metre"),
    },
   /**
    * reverberation time
    */
   'reverberation_time': {
       'second[unit_of_time]': makeEUInformation("SEC","s","second [unit of time]"),
    },
   /**
    * loudness level
    */
   'loudness_level': {
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code C69. displayName/description below are node-opcua's own, from UNECE rec20. */
       'phon': makeEUInformation("C69","","phon - A unit of subjective sound loudness. A sound has loudness p phons if it seems to the listener to be equal in loudness to the sound of a pure tone of frequency 1 kilohertz and strength p decibels."),
    },
   /**
    * loudness
    */
   'loudness': {
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code D15. displayName/description below are node-opcua's own, from UNECE rec20. */
       'sone': makeEUInformation("D15","","sone - A unit of subjective sound loudness. One sone is the loudness of a pure tone of frequency one kilohertz and strength 40 decibels."),
    },
   /**
    * sound exposure
    */
   'sound_exposure': {
       'pascal_squared_second': makeEUInformation("P42","Pa²·s","pascal squared second"),
    },
  },
 /**
  * Physical Chemistry and Molecular Physics
  */
 'Physical_Chemistry_and_Molecular_Physics': {
   /**
    * relative atomic mass
    */
   'relative_atomic_mass': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * relative molecular mass
    */
   'relative_molecular_mass': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * number of molecules or other elementary entities
    */
   'number_of_molecules_or_other_elementary_entities': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * amount of substance
    */
   'amount_of_substance': {
       'mole': makeEUInformation("C34","mol","mole"),
       'kilomole': makeEUInformation("B45","kmol","kilomole"),
       'millimole': makeEUInformation("C18","mmol","millimole"),
       'micromole': makeEUInformation("FH","µmol","micromole"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code Z9. displayName/description below are node-opcua's own, from UNECE rec20. */
       'nanomole': makeEUInformation("Z9","nmol","nanomole - An SI unit of amount of substance equal to 10−9 moles (10⁻9 mol)"),
       'pound_mole': makeEUInformation("P44","lbmol","pound mole"),
    },
   /**
    * Avogadro constant
    */
   'Avogadro_constant': {
       'reciprocal_mole': makeEUInformation("C95","mol⁻¹","reciprocal mole"),
    },
   /**
    * molar mass
    */
   'molar_mass': {
       'kilogram_per_mole': makeEUInformation("D74","kg/mol","kilogram per mole"),
       'gram_per_mole': makeEUInformation("A94","g/mol","gram per mole"),
    },
   /**
    * molar volume
    */
   'molar_volume': {
       'cubic_metre_per_mole': makeEUInformation("A40","m³/mol","cubic metre per mole"),
       'cubic_decimetre_per_mole': makeEUInformation("A37","dm³/mol","cubic decimetre per mole"),
       'cubic_centimetre_per_mole': makeEUInformation("A36","cm³/mol","cubic centimetre per mole"),
       'litre_per_mole': makeEUInformation("B58","l/mol","litre per mole"),
    },
   /**
    * molar thermodynamic energy
    */
   'molar_thermodynamic_energy': {
       'joule_per_mole': makeEUInformation("B15","J/mol","joule per mole"),
       'kilojoule_per_mole': makeEUInformation("B44","kJ/mol","kilojoule per mole"),
    },
   /**
    * chemical potential
    */
   'chemical_potential': {
       'joule_per_mole': makeEUInformation("B15","J/mol","joule per mole"),
    },
   /**
    * absolute activity
    */
   'absolute_activity': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * affinity (of a chemical reaction)
    */
   'affinity': {
       'joule_per_mole': makeEUInformation("B15","J/mol","joule per mole"),
    },
   /**
    * standard equilibrium constant
    */
   'standard_equilibrium_constant': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * molar heat capacity, molar entropy, molar gas constant
    */
   'molar_heat_capacity': {
       'joule_per_mole_kelvin': makeEUInformation("B16","J/(mol·K)","joule per mole kelvin"),
    },
   /**
    * volumic number of molecules (or particles), number density of molecules  (or particles), molecular concentration of B
    */
   'volumic_number_of_molecules': {
       'reciprocal_cubic_metre': makeEUInformation("C86","m⁻³","reciprocal cubic metre"),
       'reciprocal_cubic_centimetre': makeEUInformation("H50","cm⁻³","reciprocal cubic centimetre"),
       'reciprocal_cubic_millimetre': makeEUInformation("L20","1/mm³","reciprocal cubic millimetre"),
       'reciprocal_cubic_foot': makeEUInformation("K20","1/ft³","reciprocal cubic foot"),
       'reciprocal_cubic_inch': makeEUInformation("K49","1/in³","reciprocal cubic inch"),
       'reciprocal_litre': makeEUInformation("K63","1/l","reciprocal litre"),
       'reciprocal_cubic_yard': makeEUInformation("M10","1/yd³","reciprocal cubic yard"),
    },
   /**
    * volumic mass, mass density, density, mass concentration of B, amount of substance, concentration of B
    */
   'volumic_mass': {
       'kilogram_per_cubic_metre': makeEUInformation("KMQ","kg/m³","kilogram per cubic metre"),
       'mole_per_cubic_metre': makeEUInformation("C36","mol/m³","mole per cubic metre"),
       'mole_per_litre': makeEUInformation("C38","mol/l","mole per litre"),
       'kilogram_per_litre': makeEUInformation("B35","kg/l or kg/L","kilogram per litre"),
       'mole_per_cubic_decimetre': makeEUInformation("C35","mol/dm³","mole per cubic decimetre"),
       'kilomole_per_cubic_metre': makeEUInformation("B46","kmol/m³","kilomole per cubic metre"),
       'mole_per_second': makeEUInformation("E95","mol/s","mole per second"),
       'millimole_per_litre': makeEUInformation("M33","mmol/l","millimole per litre"),
       'mol_per_kilogram_pascal': makeEUInformation("P51","(mol/kg)/Pa","mol per kilogram pascal"),
       'mol_per_cubic_metre_pascal': makeEUInformation("P52","(mol/m³)/Pa","mol per cubic metre pascal"),
       'kilomole_per_cubic_metre_kelvin': makeEUInformation("K59","(kmol/m³)/K","kilomole per cubic metre kelvin"),
       'kilomole_per_cubic_metre_bar': makeEUInformation("K60","(kmol/m³)/bar","kilomole per cubic metre bar"),
       'reciprocal_psi': makeEUInformation("K93","1/psi","reciprocal psi"),
       'mole_per_kilogram_kelvin': makeEUInformation("L24","(mol/kg)/K","mole per kilogram kelvin"),
       'mole_per_kilogram_bar': makeEUInformation("L25","(mol/kg)/bar","mole per kilogram bar"),
       'mole_per_litre_kelvin': makeEUInformation("L26","(mol/l)/K","mole per litre kelvin"),
       'mole_per_litre_bar': makeEUInformation("L27","(mol/l)/bar","mole per litre bar"),
       'mole_per_cubic_metre_kelvin': makeEUInformation("L28","(mol/m³)/K","mole per cubic metre kelvin"),
       'mole_per_cubic_metre_bar': makeEUInformation("L29","(mol/m³)/bar","mole per cubic metre bar"),
    },
   /**
    * mole fraction of B, mole ratio of solute B
    */
   'mole_fraction_of_B': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * molality of solute B
    */
   'molality_of_solute_B': {
       'mole_per_kilogram': makeEUInformation("C19","mol/kg","mole per kilogram"),
    },
   /**
    * volumic dose
    */
   'volumic_dose': {
       'second_per_cubic_metre': makeEUInformation("D93","s/m³","second per cubic metre"),
    },
   /**
    * ionic strength
    */
   'ionic_strength': {
       'millimole_per_kilogram': makeEUInformation("D87","mmol/kg","millimole per kilogram"),
       'millimole_per_gram': makeEUInformation("H68","mmol/g","millimole per gram"),
       'kilomole_per_kilogram': makeEUInformation("P47","kmol/kg","kilomole per kilogram"),
       'pound_mole_per_pound': makeEUInformation("P48","lbmol/lb","pound mole per pound"),
    },
   /**
    * degree of dissociation
    */
   'degree_of_dissociation': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * partial pressure of B (in a gaseous mixture), fugacity of B (in a gaseous mixture), osmotic pressure
    */
   'partial_pressure_of_B': {
       'pascal': makeEUInformation("PAL","Pa","pascal"),
    },
   /**
    * standard absolute activity of B (in a liquid or a solid mixture)
    */
   'standard_absolute_activity_of_B': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * activity coefficient of B (in a liquid as a solid mixture)
    */
   'activity_coefficient_of_B': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * activity coefficient of solute B (especially in a dilute solution),standard absolute activity of solute B (especially in a dilute solution)
    */
   'activity_coefficient_of_solute_B': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * activity of solvent A, relative activity of solvent A (especially in a dilute solution), osmotic coefficient of the solvent A (especially in a dilute solution), standard absolute activity of solvent A (especially in a dilute solution)
    */
   'activity_of_solvent_A': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * catalytic activity
    */
   'catalytic_activity': {
       'katal': makeEUInformation("KAT","kat","katal"),
       'kilomole_per_second': makeEUInformation("E94","kmol/s","kilomole per second"),
       'pound_mole_per_second': makeEUInformation("P45","lbmol/s","pound mole per second"),
       'pound_mole_per_minute': makeEUInformation("P46","lbmol/h","pound mole per minute"),
    },
   /**
    * stoichiometric number of B
    */
   'stoichiometric_number_of_B': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * mass of molecule
    */
   'mass_of_molecule': {
       'kilogram': makeEUInformation("KGM","kg","kilogram"),
       'unified_atomic_mass_unit': makeEUInformation("D43","u","unified atomic mass unit"),
    },
   /**
    * electric dipole moment of molecule
    */
   'electric_dipole_moment_of_molecule': {
       'coulomb_metre': makeEUInformation("A26","C·m","coulomb metre"),
    },
   /**
    * electric polarizability of a molecule
    */
   'electric_polarizability_of_a_molecule': {
       'coulomb_metre_squared_per_volt': makeEUInformation("A27","C·m²/V","coulomb metre squared per volt"),
    },
   /**
    * microcanonical partition function, canonical partition function, grand-canonical partition function, grand partition function, molecular partition function, partition function of a molecule
    */
   'microcanonical_partition_function': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * statistical weight
    */
   'statistical_weight': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Boltzmann constant
    */
   'Boltzmann_constant': {
       'joule_per_kelvin': makeEUInformation("JE","J/K","joule per kelvin"),
    },
   /**
    * mean free path
    */
   'mean_free_path': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * diffusion coefficient, diffusion coefficient for neutron number density
    */
   'diffusion_coefficient': {
       'square_metre_per_second': makeEUInformation("S4","m²/s","square metre per second"),
    },
   /**
    * thermal diffusion ratio, thermal diffusion factor
    */
   'thermal_diffusion_ratio': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * thermal diffusion coefficient
    */
   'thermal_diffusion_coefficient': {
       'square_metre_per_second': makeEUInformation("S4","m²/s","square metre per second"),
    },
   /**
    * proton number, atomic number
    */
   'proton_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * elementary charge
    */
   'elementary_charge': {
       'coulomb': makeEUInformation("COU","C","coulomb"),
    },
   /**
    * charge number of ion
    */
   'charge_number_of_ion': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Faraday constant
    */
   'Faraday_constant': {
       'coulomb_per_mole': makeEUInformation("A32","C/mol","coulomb per mole"),
    },
   /**
    * electrolytic conductivity
    */
   'electrolytic_conductivity': {
       'siemens_per_metre': makeEUInformation("D10","S/m","siemens per metre"),
    },
   /**
    * molar conductivity
    */
   'molar_conductivity': {
       'siemens_square_metre_per_mole': makeEUInformation("D12","S·m²/mol","siemens square metre per mole"),
    },
   /**
    * molar flux
    */
   'molar_flux': {
       'kilomole_per_hour': makeEUInformation("K58","kmol/h","kilomole per hour"),
       'kilomole_per_minute': makeEUInformation("K61","kmol/min","kilomole per minute"),
       'mole_per_hour': makeEUInformation("L23","mol/h","mole per hour"),
       'mole_per_minute': makeEUInformation("L30","mol/min","mole per minute"),
    },
   /**
    * transport number of ion B, current fraction of ion B
    */
   'transport_number_of_ion_B': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * angle of optical rotation
    */
   'angle_of_optical_rotation': {
       'radian': makeEUInformation("C81","rad","radian"),
    },
   /**
    * molar optical rotatory power
    */
   'molar_optical_rotatory_power': {
       'radian_square_metre_per_mole': makeEUInformation("C82","rad·m²/mol","radian square metre per mole"),
    },
   /**
    * massic optical, rotatory power, specific optical rotatory power
    */
   'massic_optical': {
       'radian_square_metre_per_kilogram': makeEUInformation("C83","rad·m²/kg","radian square metre per kilogram"),
    },
   /**
    * magnetic dipole moment
    */
   'magnetic_dipole_moment': {
       'newton_square_metre_per_ampere': makeEUInformation("P49","N·m²/A","newton square metre per ampere"),
       'weber_metre': makeEUInformation("P50","Wb·m","weber metre"),
    },
   /**
    * acidity and alkalinity
    */
   'acidity_and_alkalinity': {
       'pH(potential_of_Hydrogen)': makeEUInformation("Q30","pH","pH (potential of Hydrogen)"),
    },
  },
 /**
  * Atomic and Nuclear Physics
  */
 'Atomic_and_Nuclear_Physics': {
   /**
    * proton number, atomic number
    */
   'proton_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * neutron number
    */
   'neutron_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * nucleon number, mass number
    */
   'nucleon_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * mass of atom (of a nuclide x), nuclidic mass, unified atomic mass constant
    */
   'mass_of_atom': {
       'kilogram': makeEUInformation("KGM","kg","kilogram"),
       'unified_atomic_mass_unit': makeEUInformation("D43","u","unified atomic mass unit"),
    },
   /**
    * (rest) mass of electron, (rest) mass of proton, (rest) mass of neutron
    */
   'mass_of_electron': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * mass excess
    */
   'mass_excess': {
       'kilogram': makeEUInformation("KGM","kg","kilogram"),
    },
   /**
    * mass defect
    */
   'mass_defect': {
       'unified_atomic_mass_unit': makeEUInformation("D43","u","unified atomic mass unit"),
    },
   /**
    * relative mass excess, relative mass defect
    */
   'relative_mass_excess': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * packing fraction, binding fraction
    */
   'packing_fraction': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * elementary charge
    */
   'elementary_charge': {
       'coulomb': makeEUInformation("COU","C","coulomb"),
    },
   /**
    * Planck constant
    */
   'Planck_constant': {
       'joule_second': makeEUInformation("B18","J·s","joule second"),
    },
   /**
    * Bohr radius
    */
   'Bohr_radius': {
       'metre': makeEUInformation("MTR","m","metre"),
       'angstrom': makeEUInformation("A11","Å","angstrom"),
    },
   /**
    * Rydberg constant
    */
   'Rydberg_constant': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * Hartree energy
    */
   'Hartree_energy': {
       'joule': makeEUInformation("JOU","J","joule"),
    },
   /**
    * magnetic moment of particle, Bohr magneton, nuclear magneton ornucleus
    */
   'magnetic_moment_of_particle': {
       'ampere_square_metre': makeEUInformation("A5","A·m²","ampere square metre"),
    },
   /**
    * gyromagnetic coefficient, (gyromagnetic ratio)
    */
   'gyromagnetic_coefficient': {
       'ampere_square_metre_per_joule_second': makeEUInformation("A10","A·m²/(J·s)","ampere square metre per joule second"),
    },
   /**
    * g-factor of atom or electron, g-factor of nucleus
    */
   'g-factor_of_atom_or_electron': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Larmor angular frequency
    */
   'Larmor_angular_frequency': {
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
    },
   /**
    * nuclear precession, cyclotron angular frequency
    */
   'nuclear_precession': {
       'radian_per_second': makeEUInformation("2A","rad/s","radian per second"),
    },
   /**
    * nuclear quadrupole moment
    */
   'nuclear_quadrupole_moment': {
       'square_metre': makeEUInformation("MTK","m²","square metre"),
    },
   /**
    * nuclear radius, electron radius, Compton wavelength
    */
   'nuclear_radius': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * orbital angular momentum quantum number
    */
   'orbital_angular_momentum_quantum_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * spin angular momentum quantum number
    */
   'spin_angular_momentum_quantum_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * total angular momentum quantum number
    */
   'total_angular_momentum_quantum_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * nuclear spin quantum number
    */
   'nuclear_spin_quantum_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * hyperfine structure quantum number
    */
   'hyperfine_structure_quantum_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * principle quantum number
    */
   'principle_quantum_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * magnetic quantum number
    */
   'magnetic_quantum_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * fine structure constant
    */
   'fine_structure_constant': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * mean life, half life
    */
   'mean_life': {
       'second[unit_of_time]': makeEUInformation("SEC","s","second [unit of time]"),
    },
   /**
    * level width, alpha disintegration energy
    */
   'level_width': {
       'joule': makeEUInformation("JOU","J","joule"),
    },
   /**
    * maximum beta particle energy, beta disintegration energy
    */
   'maximum_beta_particle_energy': {
       'electronvolt': makeEUInformation("A53","eV","electronvolt"),
    },
   /**
    * internal conversion factor
    */
   'internal_conversion_factor': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * activity
    */
   'activity': {
       'curie': makeEUInformation("CUR","Ci","curie"),
       'millicurie': makeEUInformation("MCU","mCi","millicurie"),
       'microcurie': makeEUInformation("M5","µCi","microcurie"),
       'kilocurie': makeEUInformation("2R","kCi","kilocurie"),
       'becquerel': makeEUInformation("BQL","Bq","becquerel"),
       'gigabecquerel': makeEUInformation("GBQ","GBq","gigabecquerel"),
       'kilobecquerel': makeEUInformation("2Q","kBq","kilobecquerel"),
       'megabecquerel': makeEUInformation("4N","MBq","megabecquerel"),
       'microbecquerel': makeEUInformation("H08","µBq","microbecquerel"),
    },
   /**
    * specific activity in a sample
    */
   'specific_activity_in_a_sample': {
       'curie_per_kilogram': makeEUInformation("A42","Ci/kg","curie per kilogram"),
       'becquerel_per_kilogram': makeEUInformation("A18","Bq/kg","becquerel per kilogram"),
       'megabecquerel_per_kilogram': makeEUInformation("B67","MBq/kg","megabecquerel per kilogram"),
       'kilobecquerel_per_kilogram': makeEUInformation("B25","kBq/kg","kilobecquerel per kilogram"),
    },
   /**
    * volumic activity, activity concentration
    */
   'volumic_activity': {
       'becquerel_per_cubic_metre': makeEUInformation("A19","Bq/m³","becquerel per cubic metre"),
    },
   /**
    * decay constant, disintegration constant
    */
   'decay_constant': {
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
    },
  },
 /**
  * Nuclear Reactions and Ionizing Radiations
  */
 'Nuclear_Reactions_and_Ionizing_Radiations': {
   /**
    * reaction energy
    */
   'reaction_energy': {
       'joule': makeEUInformation("JOU","J","joule"),
    },
   /**
    * resonance energy
    */
   'resonance_energy': {
       'electronvolt': makeEUInformation("A53","eV","electronvolt"),
    },
   /**
    * average energy loss per ion, pair formed, (average energy  loss per elementary charge of the same sign produced)
    */
   'average_energy_loss_per_ion': {
       'erg': makeEUInformation("A57","erg","erg"),
    },
   /**
    * cross-section
    */
   'cross-section': {
       'square_metre': makeEUInformation("MTK","m²","square metre"),
    },
   /**
    * total cross-section
    */
   'total_cross-section': {
       'barn': makeEUInformation("A14","b","barn"),
    },
   /**
    * angular cross-section
    */
   'angular_cross-section': {
       'square_metre_per_steradian': makeEUInformation("D24","m²/sr","square metre per steradian"),
       'barn_per_steradian': makeEUInformation("A17","b/sr","barn per steradian"),
    },
   /**
    * spectral cross-section
    */
   'spectral_cross-section': {
       'square_metre_per_joule': makeEUInformation("D20","m²/J","square metre per joule"),
       'barn_per_electronvolt': makeEUInformation("A15","b/eV","barn per electronvolt"),
       'square_centimetre_per_erg': makeEUInformation("D16","cm²/erg","square centimetre per erg"),
    },
   /**
    * spectral angular cross-section
    */
   'spectral_angular_cross-section': {
       'square_metre_per_steradian_joule': makeEUInformation("D25","m²/(sr·J)","square metre per steradian joule"),
       'barn_per_steradian_electronvolt': makeEUInformation("A16","b/(sr·eV)","barn per steradian electronvolt"),
       'square_centimetre_per_steradian_erg': makeEUInformation("D17","cm²/(sr·erg)","square centimetre per steradian erg"),
    },
   /**
    * macroscopic cross-section, volumic cross-section, volumic total cross-section, macroscopic total cross-section
    */
   'macroscopic_cross-section': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * particle fluence
    */
   'particle_fluence': {
       'reciprocal_square_metre': makeEUInformation("C93","m⁻²","reciprocal square metre"),
       'reciprocal_square_inch': makeEUInformation("P78","1/in²","reciprocal square inch"),
    },
   /**
    * particle fluence rate, (partical flux density), neutron fluence rate, (neutronflux density), current density of particles
    */
   'particle_fluence_rate': {
       'reciprocal_metre_squared_reciprocal_second': makeEUInformation("B81","m⁻²/s","reciprocal metre squared reciprocal second"),
    },
   /**
    * energy fluence
    */
   'energy_fluence': {
       'joule_per_square_metre': makeEUInformation("B13","J/m²","joule per square metre"),
    },
   /**
    * energy fluence rate, (energy flux density)
    */
   'energy_fluence_rate': {
       'watt_per_square_metre': makeEUInformation("D54","W/m²","watt per square metre"),
       'erg_per_square_centimetre_second': makeEUInformation("A65","erg/(cm²·s)","erg per square centimetre second"),
    },
   /**
    * linear attenuation coefficient
    */
   'linear_attenuation_coefficient': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * mass attenuation coefficient
    */
   'mass_attenuation_coefficient': {
       'square_metre_per_kilogram': makeEUInformation("D21","m²/kg","square metre per kilogram"),
    },
   /**
    * molar attenuation coefficient
    */
   'molar_attenuation_coefficient': {
       'square_metre_per_mole': makeEUInformation("D22","m²/mol","square metre per mole"),
    },
   /**
    * atomic attenuation coefficient
    */
   'atomic_attenuation_coefficient': {
       'square_metre': makeEUInformation("MTK","m²","square metre"),
    },
   /**
    * slowing down area, diffusion area, migration area
    */
   'slowing_down_area': {
       'square_metre': makeEUInformation("MTK","m²","square metre"),
    },
   /**
    * half-thickness, half-value thickness
    */
   'half-thickness': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * mean linear range, mean free path
    */
   'mean_linear_range': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * slowing-down length, diffusion length, migration length
    */
   'slowing-down_length': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * neutron yield per fission, neutron yield per absorption
    */
   'neutron_yield_per_fission': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * fast fission factor
    */
   'fast_fission_factor': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * thermal utilization factor
    */
   'thermal_utilization_factor': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * non leakage probability
    */
   'non_leakage_probability': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * multiplication factor, infinite medium multiplication factor, effective multiplication factor
    */
   'multiplication_factor': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * diffusion coefficient for neutron fluence rate, (diffusion coefficient for neutron flux density)
    */
   'diffusion_coefficient_for_neutron_fluence_rate': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * total linear stopping power
    */
   'total_linear_stopping_power': {
       'joule_per_metre': makeEUInformation("B12","J/m","joule per metre"),
       'electronvolt_per_metre': makeEUInformation("A54","eV/m","electronvolt per metre"),
       'erg_per_centimetre': makeEUInformation("A58","erg/cm","erg per centimetre"),
    },
   /**
    * total atomic stopping power
    */
   'total_atomic_stopping_power': {
       'joule_square_metre': makeEUInformation("D73","J·m²","joule square metre"),
       'electronvolt_square_metre': makeEUInformation("A55","eV·m²","electronvolt square metre"),
       'erg_square_centimetre': makeEUInformation("A66","erg·cm²","erg square centimetre"),
    },
   /**
    * total mass stopping power
    */
   'total_mass_stopping_power': {
       'joule_square_metre_per_kilogram': makeEUInformation("B20","J·m²/kg","joule square metre per kilogram"),
       'electronvolt_square_metre_per_kilogram': makeEUInformation("A56","eV·m²/kg","electronvolt square metre per kilogram"),
       'erg_square_centimetre_per_gram': makeEUInformation("A67","erg·cm²/g","erg square centimetre per gram"),
    },
   /**
    * mean mass range
    */
   'mean_mass_range': {
       'kilogram_per_square_metre': makeEUInformation("28","kg/m²","kilogram per square metre"),
    },
   /**
    * linear ionization by a particle, total ionization by a particle
    */
   'linear_ionization_by_a_particle': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * mobility
    */
   'mobility': {
       'square_metre_per_volt_second': makeEUInformation("D26","m²/(V·s)","square metre per volt second"),
       'metre_per_volt_second': makeEUInformation("H58","m/(V·s)","metre per volt second"),
    },
   /**
    * ion number density, ion density, neutron number density
    */
   'ion_number_density': {
       'reciprocal_cubic_metre': makeEUInformation("C86","m⁻³","reciprocal cubic metre"),
    },
   /**
    * recombination coefficient
    */
   'recombination_coefficient': {
       'cubic_metre_per_second': makeEUInformation("MQS","m³/s","cubic metre per second"),
    },
   /**
    * neutron speed
    */
   'neutron_speed': {
       'metre_per_second': makeEUInformation("MTS","m/s","metre per second"),
    },
   /**
    * diffusion coefficient, diffusion coefficient for neutron number density
    */
   'diffusion_coefficient': {
       'square_metre_per_second': makeEUInformation("S4","m²/s","square metre per second"),
    },
   /**
    * neutron source density
    */
   'neutron_source_density': {
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code C98. displayName/description below are node-opcua's own, from UNECE rec20. */
       'reciprocal_second_per_cubic_metre': makeEUInformation("C98","s⁻¹/m³","reciprocal second per cubic metre (s⁻¹/m³)"),
    },
   /**
    * slowing down density
    */
   'slowing_down_density': {
       'reciprocal_cubic_metre_per_second': makeEUInformation("C87","m⁻³/s","reciprocal cubic metre per second"),
    },
   /**
    * resonance escape probability
    */
   'resonance_escape_probability': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * lethargy
    */
   'lethargy': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * average logarithmic energy decrement
    */
   'average_logarithmic_energy_decrement': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * reactivity
    */
   'reactivity': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * reactor time constant
    */
   'reactor_time_constant': {
       'second[unit_of_time]': makeEUInformation("SEC","s","second [unit of time]"),
    },
   /**
    * activity
    */
   'activity': {
       'becquerel': makeEUInformation("BQL","Bq","becquerel"),
       'curie': makeEUInformation("CUR","Ci","curie"),
    },
   /**
    * energy imparted, mean energy imparted
    */
   'energy_imparted': {
       'joule': makeEUInformation("JOU","J","joule"),
    },
   /**
    * specific energy imparted, massic energy imparted
    */
   'specific_energy_imparted': {
       'gray': makeEUInformation("A95","Gy","gray"),
       'milligray': makeEUInformation("C13","mGy","milligray"),
    },
   /**
    * absorbed dose
    */
   'absorbed_dose': {
       'rad': makeEUInformation("C80","rad","rad"),
    },
   /**
    * kerma
    */
   'kerma': {
       'erg_per_gram': makeEUInformation("A61","erg/g","erg per gram"),
    },
   /**
    * dose equivalent
    */
   'dose_equivalent': {
       'sievert': makeEUInformation("D13","Sv","sievert"),
       'millisievert': makeEUInformation("C28","mSv","millisievert"),
       'rem': makeEUInformation("D91","rem","rem"),
       'milliroentgen_aequivalent_men': makeEUInformation("L31","mrem","milliroentgen aequivalent men"),
    },
   /**
    * absorbed dose rate
    */
   'absorbed_dose_rate': {
       'gray_per_second': makeEUInformation("A96","Gy/s","gray per second"),
       'milligray_per_second': makeEUInformation("P54","mGy/s","milligray per second"),
       'microgray_per_second': makeEUInformation("P55","µGy/s","microgray per second"),
       'nanogray_per_second': makeEUInformation("P56","nGy/s","nanogray per second"),
       'gray_per_minute': makeEUInformation("P57","Gy/min","gray per minute"),
       'milligray_per_minute': makeEUInformation("P58","mGy/min","milligray per minute"),
       'microgray_per_minute': makeEUInformation("P59","µGy/min","microgray per minute"),
       'nanogray_per_minute': makeEUInformation("P60","nGy/min","nanogray per minute"),
       'gray_per_hour': makeEUInformation("P61","Gy/h","gray per hour"),
       'milligray_per_hour': makeEUInformation("P62","mGy/h","milligray per hour"),
       'microgray_per_hour': makeEUInformation("P63","µGy/h","microgray per hour"),
       'nanogray_per_hour': makeEUInformation("P64","nGy/h","nanogray per hour"),
    },
   /**
    * kerma rate
    */
   'kerma_rate': {
       'erg_per_gram_second': makeEUInformation("A62","erg/g·s","erg per gram second"),
    },
   /**
    * linear energy transfer
    */
   'linear_energy_transfer': {
       'joule_per_metre': makeEUInformation("B12","J/m","joule per metre"),
       'electronvolt_per_metre': makeEUInformation("A54","eV/m","electronvolt per metre"),
       'erg_per_centimetre': makeEUInformation("A58","erg/cm","erg per centimetre"),
    },
   /**
    * mass energy transfer coefficient
    */
   'mass_energy_transfer_coefficient': {
       'square_metre_per_kilogram': makeEUInformation("D21","m²/kg","square metre per kilogram"),
    },
   /**
    * exposure
    */
   'exposure': {
       'coulomb_per_kilogram': makeEUInformation("CKG","C/kg","coulomb per kilogram"),
       'millicoulomb_per_kilogram': makeEUInformation("C8","mC/kg","millicoulomb per kilogram"),
       'roentgen': makeEUInformation("2C","R","roentgen"),
       'milliroentgen': makeEUInformation("2Y","mR","milliroentgen"),
       'coulomb_square_metre_per_kilogram': makeEUInformation("J53","C·m²/kg","coulomb square metre per kilogram"),
       'kiloroentgen': makeEUInformation("KR","kR","kiloroentgen"),
    },
   /**
    * exposure rate
    */
   'exposure_rate': {
       'coulomb_per_kilogram_second': makeEUInformation("A31","C/(kg·s)","coulomb per kilogram second"),
       'roentgen_per_second': makeEUInformation("D6","R/s","roentgen per second"),
    },
   /**
    * equivalence dose output
    */
   'equivalence_dose_output': {
       'sievert_per_second': makeEUInformation("P65","Sv/s","sievert per second"),
       'millisievert_per_second': makeEUInformation("P66","mSv/s","millisievert per second"),
       'microsievert_per_second': makeEUInformation("P67","µSv/s","microsievert per second"),
       'nanosievert_per_second': makeEUInformation("P68","nSv/s","nanosievert per second"),
       'rem_per_second': makeEUInformation("P69","rem/s","rem per second"),
       'sievert_per_hour': makeEUInformation("P70","Sv/h","sievert per hour"),
       'millisievert_per_hour': makeEUInformation("P71","mSv/h","millisievert per hour"),
       'microsievert_per_hour': makeEUInformation("P72","µSv/h","microsievert per hour"),
       'nanosievert_per_hour': makeEUInformation("P73","nSv/h","nanosievert per hour"),
       'sievert_per_minute': makeEUInformation("P74","Sv/min","sievert per minute"),
       'millisievert_per_minute': makeEUInformation("P75","mSv/min","millisievert per minute"),
       'microsievert_per_minute': makeEUInformation("P76","µSv/min","microsievert per minute"),
       'nanosievert_per_minute': makeEUInformation("P77","nSv/min","nanosievert per minute"),
    },
  },
 /**
  * Characteristic Numbers (dimensionless parameters)
  */
 'Characteristic_Numbers_(dimensionless_parameters)': {
   /**
    * Reynolds number
    */
   'Reynolds_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Euler number
    */
   'Euler_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Froude number
    */
   'Froude_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Grashof number
    */
   'Grashof_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Weber number
    */
   'Weber_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Mach number
    */
   'Mach_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Knudsen number
    */
   'Knudsen_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Strouhal number
    */
   'Strouhal_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Fourier number
    */
   'Fourier_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Peclet number
    */
   'Peclet_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Rayleigh number
    */
   'Rayleigh_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Nusselt number
    */
   'Nusselt_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Stanton number
    */
   'Stanton_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Fourier number for mass transfer
    */
   'Fourier_number_for_mass_transfer': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Peclet number for mass transfer
    */
   'Peclet_number_for_mass_transfer': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Grashof number for mass transfer
    */
   'Grashof_number_for_mass_transfer': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Nusselt number for mass transfer
    */
   'Nusselt_number_for_mass_transfer': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Stanton number for mass transfer
    */
   'Stanton_number_for_mass_transfer': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Prandtl number
    */
   'Prandtl_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Schmidt number
    */
   'Schmidt_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Lewis number
    */
   'Lewis_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * magnetic Reynolds number
    */
   'magnetic_Reynolds_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Alfven number
    */
   'Alfven_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Hartmann number
    */
   'Hartmann_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Cowling number
    */
   'Cowling_number': {
       'one': makeEUInformation("C62","1","one"),
    },
  },
 /**
  * Solid State Physics
  */
 'Solid_State_Physics': {
   /**
    * mobility ratio
    */
   'mobility_ratio': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * lattice vector, fundamental lattice vector
    */
   'lattice_vector': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * lattice plane spacing, Burgers vector
    */
   'lattice_plane_spacing': {
       'angstrom': makeEUInformation("A11","Å","angstrom"),
    },
   /**
    * Bragg angle
    */
   'Bragg_angle': {
       'radian': makeEUInformation("C81","rad","radian"),
       'degree[unit_of_angle]': makeEUInformation("DD","°","degree [unit of angle]"),
    },
   /**
    * order of reflexion
    */
   'order_of_reflexion': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * short-range order parameter, long-range order parameter
    */
   'short-range_order_parameter': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * relaxation time, carrier life time
    */
   'relaxation_time': {
       'second[unit_of_time]': makeEUInformation("SEC","s","second [unit of time]"),
    },
   /**
    * magnetic flux quantum
    */
   'magnetic_flux_quantum': {
       'weber': makeEUInformation("WEB","Wb","weber"),
       'unit_pole_': makeEUInformation("P53","unit pole","unit pole"),
    },
   /**
    * particle position vector, equilibrium position vector of ion or atom, displacement vector of ion or atom
    */
   'particle_position_vector': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * Debye-Walle factor
    */
   'Debye-Walle_factor': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * mean free path of phonons or electrons, London penetration depth, coherence length, diffusion length
    */
   'mean_free_path_of_phonons_or_electrons': {
       'metre': makeEUInformation("MTR","m","metre"),
    },
   /**
    * angular repetency, angular wave number
    */
   'angular_repetency': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * Fermi angular repetency, Fermi angular wave number
    */
   'Fermi_angular_repetency': {
       'reciprocal_angstrom': makeEUInformation("C85","Å⁻¹","reciprocal angstrom"),
    },
   /**
    * Debye angular repetency, Debye angular wave number
    */
   'Debye_angular_repetency': {
       'radian_per_metre': makeEUInformation("C84","rad/m","radian per metre"),
    },
   /**
    * angular reciprocal lattice vector, fundamental reciprocal lattice vector
    */
   'angular_reciprocal_lattice_vector': {
       'reciprocal_metre': makeEUInformation("C92","m⁻¹","reciprocal metre"),
    },
   /**
    * Debye angular frequency
    */
   'Debye_angular_frequency': {
       'radian_per_second': makeEUInformation("2A","rad/s","radian per second"),
       'reciprocal_second': makeEUInformation("C97","s⁻¹","reciprocal second"),
    },
   /**
    * Debye temperature, Curie temperature, Néel temperature, Fermi temperature, Super conductor transition temperature
    */
   'Debye_temperature': {
       'kelvin': makeEUInformation("KEL","K","kelvin"),
    },
   /**
    * spectral concentration of vibrational modes (in terms of angular frequency)
    */
   'spectral_concentration_of_vibrational_modes': {
       'second_per_cubic_metre_radian': makeEUInformation("D94","s/(rad·m³)","second per cubic metre radian"),
    },
   /**
    * Grüneisen parameter
    */
   'Grüneisen_parameter': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Madelung constant
    */
   'Madelung_constant': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * Landau-Ginzburg number
    */
   'Landau-Ginzburg_number': {
       'one': makeEUInformation("C62","1","one"),
    },
   /**
    * density of states
    */
   'density_of_states': {
       'reciprocal_joule_per_cubic_metre': makeEUInformation("C90","J⁻¹/m³","reciprocal joule per cubic metre"),
       'reciprocal_electron_volt_per_cubic_metre': makeEUInformation("C88","eV⁻¹/m³","reciprocal electron volt per cubic metre"),
    },
   /**
    * residual resistivity
    */
   'residual_resistivity': {
       'ohm_metre': makeEUInformation("C61","Ω·m","ohm metre"),
    },
   /**
    * Hall coefficient
    */
   'Hall_coefficient': {
       'cubic_metre_per_coulomb': makeEUInformation("A38","m³/C","cubic metre per coulomb"),
    },
   /**
    * thermoelectromotive force between substances a and b, Peltier coefficient for substances a and b
    */
   'thermoelectromotive_force_between_substances_a_and_b': {
       'volt': makeEUInformation("VLT","V","volt"),
    },
   /**
    * thermodynamic critical magnetic flux density, lower critical magnetic flux density, upper critical magnetic flux density
    */
   'thermodynamic_critical_magnetic_flux_density': {
       'tesla': makeEUInformation("D33","T","tesla"),
    },
   /**
    * Seebeck coefficient for substances a and b
    */
   'Seebeck_coefficient_for_substances_a_and_b': {
       'volt_per_kelvin': makeEUInformation("D48","V/K","volt per kelvin"),
    },
   /**
    * Thompson coefficient
    */
   'Thompson_coefficient': {
       'millivolt_per_kelvin': makeEUInformation("D49","mV/K","millivolt per kelvin"),
    },
   /**
    * work function
    */
   'work_function': {
       'joule': makeEUInformation("JOU","J","joule"),
    },
   /**
    * Fermi energy
    */
   'Fermi_energy': {
       'electronvolt': makeEUInformation("A53","eV","electronvolt"),
    },
   /**
    * gap energy
    */
   'gap_energy': {
       'femtojoule': makeEUInformation("A70","fJ","femtojoule"),
    },
   /**
    * donor ionization energy, acceptor ionization energy, exchange intergral, superconductor energy gap, electron affinity
    */
   'donor_ionization_energy': {
       'attojoule': makeEUInformation("A13","aJ","attojoule"),
    },
   /**
    * Richardson constant
    */
   'Richardson_constant': {
       'ampere_per_square_metre_kelvin_squared': makeEUInformation("A6","A/(m²·K²)","ampere per square metre kelvin squared"),
    },
   /**
    * electron number density, volumic electron number, hole number density, volumic hole number, donor number density, volumic donor number, intrinsic number density, volumic intrinsis number, acceptor number density, volumic acceptor number
    */
   'electron_number_density': {
       'reciprocal_cubic_metre': makeEUInformation("C86","m⁻³","reciprocal cubic metre"),
    },
   /**
    * effective mass
    */
   'effective_mass': {
       'kilogram': makeEUInformation("KGM","kg","kilogram"),
    },
  },
 /**
  * Miscellaneous
  */
 'Miscellaneous': {
   /**
    * burst index
    */
   'burst_index': {
       'kilopascal_square_metre_per_gram': makeEUInformation("33","kPa·m²/g","kilopascal square metre per gram"),
       'pascal_square_metre_per_kilogram': makeEUInformation("P79","Pa/(kg/m²)","pascal square metre per kilogram"),
    },
   /**
    * hardness index
    */
   'hardness_index': {
       'kilopascal_per_millimetre': makeEUInformation("34","kPa/mm","kilopascal per millimetre"),
       'pascal_per_metre': makeEUInformation("H42","Pa/m","pascal per metre"),
       'picopascal_per_kilometre': makeEUInformation("H69","pPa/km","picopascal per kilometre"),
       'millipascal_per_metre': makeEUInformation("P80","mPa/m","millipascal per metre"),
       'kilopascal_per_metre': makeEUInformation("P81","kPa/m","kilopascal per metre"),
       'hectopascal_per_metre': makeEUInformation("P82","hPa/m","hectopascal per metre"),
       'standard_atmosphere_per_metre': makeEUInformation("P83","Atm/m","standard atmosphere per metre"),
       'technical_atmosphere_per_metre': makeEUInformation("P84","at/m","technical atmosphere per metre"),
       'torr_per_metre': makeEUInformation("P85","Torr/m","torr per metre"),
       'psi_per_inch': makeEUInformation("P86","psi/in","psi per inch"),
    },
   /**
    * porosity
    */
   'porosity': {
       'millilitre_per_square_centimetre_second': makeEUInformation("35","ml/(cm²·s)","millilitre per square centimetre second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 36. displayName/description below are node-opcua's own, from UNECE rec20. */
       'cubic_foot_per_minute_per_square_foot': makeEUInformation("36","ft³/(min/ft²)","cubic foot per minute per square foot - Conversion factor required"),
       'cubic_metre_per_second_square_metre': makeEUInformation("P87","(m³/s)/m²","cubic metre per second square metre"),
    },
  },
 /**
  * Level 3 Units ( uncategorized)
  */
       '30-day_month': makeEUInformation("M36","mo (30 days)","30-day month"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code A59. displayName/description below are node-opcua's own, from UNECE rec20. */
       '8-part_cloud_cover': makeEUInformation("A59","","8-part cloud cover - A unit of count defining the number of eighth-parts as a measure of the celestial dome cloud coverage. Synonym: OKTA , OCTA"),
       'Beaufort': makeEUInformation("M19","Bft","Beaufort"),
       'Decibel_watt': makeEUInformation("DBW","dBW","Decibel watt"),
       'Decibel-milliwatts': makeEUInformation("DBM","dBm","Decibel-milliwatts"),
       'Formazin_nephelometric_unit': makeEUInformation("FNU","FNU","Formazin nephelometric unit"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 5E. displayName/description below are node-opcua's own, from UNECE rec20. */
       'MMSCF/day': makeEUInformation("5E","","MMSCF/day - A unit of volume equal to one million (1000000) cubic feet of gas per day."),
       'Nephelometric_turbidity_unit': makeEUInformation("NTU","NTU","Nephelometric turbidity unit"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ODG. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ODS_Grams': makeEUInformation("ODG","","ODS Grams - A unit of measure calculated by multiplying the mass of the substance in grams and the ozone-depleting potential for the substance."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ODK. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ODS_Kilograms': makeEUInformation("ODK","","ODS Kilograms - A unit of measure calculated by multiplying the mass of the substance in kilograms and the ozone-depleting potential for the substance."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ODM. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ODS_Milligrams': makeEUInformation("ODM","","ODS Milligrams - A unit of measure calculated by multiplying the mass of the substance in milligrams and the ozone-depleting potential for the substance."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E22. displayName/description below are node-opcua's own, from UNECE rec20. */
       'TEU': makeEUInformation("E22","","TEU - A unit of count defining the number of twenty-foot equivalent units (TEUs) as a measure of containerized cargo capacity."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code AL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'access_line': makeEUInformation("AL","","access line - A unit of count defining the number of telephone access lines."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E50. displayName/description below are node-opcua's own, from UNECE rec20. */
       'accounting_unit': makeEUInformation("E50","","accounting unit - A unit of count defining the number of accounting units."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E25. displayName/description below are node-opcua's own, from UNECE rec20. */
       'active_unit': makeEUInformation("E25","","active unit - A unit of count defining the number of active units within a substance."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ACT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'activity': makeEUInformation("ACT","","activity - A unit of count defining the number of activities (activity: a unit of work or action)."),
       'actual/360': makeEUInformation("M37","y (360 days)","actual/360"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code AH. displayName/description below are node-opcua's own, from UNECE rec20. */
       'additional_minute': makeEUInformation("AH","","additional minute - A unit of time defining the number of minutes in addition to the referenced minutes."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MD. displayName/description below are node-opcua's own, from UNECE rec20. */
       'air_dry_metric_ton': makeEUInformation("MD","","air dry metric ton - A unit of count defining the number of metric tons of a product, disregarding the water content of the product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E28. displayName/description below are node-opcua's own, from UNECE rec20. */
       'air_dry_ton': makeEUInformation("E28","","air dry ton - A unit of mass defining the number of tons of a product, disregarding the water content of the product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ASM. displayName/description below are node-opcua's own, from UNECE rec20. */
       'alcoholic_strength_by_mass': makeEUInformation("ASM","","alcoholic strength by mass - A unit of mass defining the alcoholic strength of a liquid."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ASU. displayName/description below are node-opcua's own, from UNECE rec20. */
       'alcoholic_strength_by_volume': makeEUInformation("ASU","","alcoholic strength by volume - A unit of volume defining the alcoholic strength of a liquid (e.g. spirit, wine, beer, etc), often at a specific temperature."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code AQ. displayName/description below are node-opcua's own, from UNECE rec20. */
       'anti-hemophilic_factor(AHF)_unit': makeEUInformation("AQ","","anti-hemophilic factor (AHF) unit - A unit of measure for blood potency (US)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code AY. displayName/description below are node-opcua's own, from UNECE rec20. */
       'assembly': makeEUInformation("AY","","assembly - A unit of count defining the number of assemblies (assembly: items that consist of component parts)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code AS. displayName/description below are node-opcua's own, from UNECE rec20. */
       'assortment': makeEUInformation("AS","","assortment - A unit of count defining the number of assortments (assortment: set of items grouped in a mixed collection)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code AI. displayName/description below are node-opcua's own, from UNECE rec20. */
       'average_minute_per_call': makeEUInformation("AI","","average minute per call - A unit of count defining the number of minutes for the average interval of a call."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code AA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ball': makeEUInformation("AA","","ball - A unit of count defining the number of balls (ball: object formed in the shape of sphere)."),
       'barrel(US)_per_day': makeEUInformation("B1","barrel (US)/d","barrel (US) per day"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code B4. displayName/description below are node-opcua's own, from UNECE rec20. */
       'barrel(imperial)': makeEUInformation("B4","","barrel, imperial - A unit of volume used to measure beer.  One beer barrel equals 36 imperial gallons."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code BB. displayName/description below are node-opcua's own, from UNECE rec20. */
       'base_box': makeEUInformation("BB","","base box - A unit of area of 112 sheets of tin mil products (tin plate, tin free steel or black plate) 14 by 20 inches, or 31,360 square inches."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 5B. displayName/description below are node-opcua's own, from UNECE rec20. */
       'batch': makeEUInformation("5B","","batch - A unit of count defining the number of batches (batch: quantity of material produced in one operation or number of animals or persons coming at once)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code B3. displayName/description below are node-opcua's own, from UNECE rec20. */
       'batting_pound': makeEUInformation("B3","","batting pound - A unit of mass defining the number of pounds of wadded fibre."),
       'baud': makeEUInformation("J38","Bd","baud"),
       'beats_per_minute': makeEUInformation("BPM","BPM","beats per minute"),
       'big_point': makeEUInformation("H82","bp","big point"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code BIL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'billion(EUR)': makeEUInformation("BIL","","billion (EUR) - Synonym: trillion (US) (10¹²)"),
       'bit': makeEUInformation("A99","bit","bit"),
       'bit_per_cubic_metre': makeEUInformation("F01","bit/m³","bit per cubic metre"),
       'bit_per_metre': makeEUInformation("E88","bit/m","bit per metre"),
       'bit_per_second': makeEUInformation("B10","bit/s","bit per second"),
       'bit_per_square_metre': makeEUInformation("E89","bit/m²","bit per square metre"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code H21. displayName/description below are node-opcua's own, from UNECE rec20. */
       'blank': makeEUInformation("H21","","blank - A unit of count defining the number of blanks."),
       'board_foot': makeEUInformation("BFT","fbm","board foot"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code D63. displayName/description below are node-opcua's own, from UNECE rec20. */
       'book': makeEUInformation("D63","","book - A unit of count defining the number of books (book: set of items bound together or written document of a material whole)."),
       'bulk_pack': makeEUInformation("AB","pk","bulk pack"),
       'byte': makeEUInformation("AD","byte","byte"),
       'byte_per_second': makeEUInformation("P93","byte/s","byte per second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'cake': makeEUInformation("KA","","cake - A unit of count defining the number of cakes (cake: object shaped into a flat, compact mass)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code C0. displayName/description below are node-opcua's own, from UNECE rec20. */
       'call': makeEUInformation("C0","","call - A unit of count defining the number of calls (call: communication session or visitation)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code CG. displayName/description below are node-opcua's own, from UNECE rec20. */
       'card': makeEUInformation("CG","","card - A unit of count defining the number of units of card (card: thick stiff paper or cardboard)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code CCT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'carrying_capacity_in_metric_ton': makeEUInformation("CCT","","carrying capacity in metric ton - A unit of mass defining the carrying capacity, expressed as the number of metric tons."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code CNT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'cental(UK)': makeEUInformation("CNT","","cental (UK) - A unit of mass equal to one hundred weight (US). (45,359 237 kg)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code C9. displayName/description below are node-opcua's own, from UNECE rec20. */
       'coil_group': makeEUInformation("C9","","coil group - A unit of count defining the number of coil groups (coil group: groups of items arranged by lengths of those items placed in a joined sequence of concentric circles)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code CTG. displayName/description below are node-opcua's own, from UNECE rec20. */
       'content_gram': makeEUInformation("CTG","","content gram - A unit of mass defining the number of grams of a named item in a product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code CTN. displayName/description below are node-opcua's own, from UNECE rec20. */
       'content_ton(metric)': makeEUInformation("CTN","","content ton (metric) - A unit of mass defining the number of metric tons of a named item in a product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code WCD. displayName/description below are node-opcua's own, from UNECE rec20. */
       'cord': makeEUInformation("WCD","","cord - A unit of volume used for measuring lumber. One board foot equals 1/12 of a cubic foot. (3,63 m³)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code B17. displayName/description below are node-opcua's own, from UNECE rec20. */
       'credit': makeEUInformation("B17","","credit - A unit of count defining the number of entries made to the credit side of an account."),
       'cubic_foot_per_second': makeEUInformation("E17","ft³/s","cubic foot per second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code B7. displayName/description below are node-opcua's own, from UNECE rec20. */
       'cycle': makeEUInformation("B7","","cycle - A unit of count defining the number of cycles (cycle: a recurrent period of definite duration)."),
       'deadweight_tonnage': makeEUInformation("A43","dwt","deadweight tonnage"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DEC. displayName/description below are node-opcua's own, from UNECE rec20. */
       'decade': makeEUInformation("DEC","","decade - A unit of count defining the number of decades (decade: quantity equal to 10 or time equal to 10 years)."),
       'decitex': makeEUInformation("A47","dtex (g/10km)","decitex"),
       'degree_API': makeEUInformation("J13","°API","degree API"),
       'degree_Balling': makeEUInformation("J17","°Balling","degree Balling"),
       'degree_Baume(US_heavy)': makeEUInformation("J15","°Bé (US heavy)","degree Baume (US heavy)"),
       'degree_Baume(US_light)': makeEUInformation("J16","°Bé (US light)","degree Baume (US light)"),
       'degree_Baume(origin_scale)': makeEUInformation("J14","°Bé","degree Baume (origin scale)"),
       'degree_Brix': makeEUInformation("J18","°Bx","degree Brix"),
       'degree_Oechsle': makeEUInformation("J27","°Oechsle","degree Oechsle"),
       'degree_Plato': makeEUInformation("PLA","°P","degree Plato"),
       'degree_Twaddell': makeEUInformation("J31","°Tw","degree Twaddell"),
       'degree_day': makeEUInformation("E10","deg da","degree day"),
       'denier': makeEUInformation("A49","den (g/9 km)","denier"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code B19. displayName/description below are node-opcua's own, from UNECE rec20. */
       'digit': makeEUInformation("B19","","digit - A unit of information defining the quantity of numerals used to form a number."),
       'dioptre': makeEUInformation("Q25","dpt","dioptre"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DPT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'displacement_tonnage': makeEUInformation("DPT","","displacement tonnage - A unit of mass defining the volume of sea water a ship displaces, expressed as the number of tons."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E27. displayName/description below are node-opcua's own, from UNECE rec20. */
       'dose': makeEUInformation("E27","","dose - A unit of count defining the number of doses (dose: a definite quantity of a medicine or drug)."),
       'dots_per_inch': makeEUInformation("E39","dpi","dots per inch"),
       'dozen': makeEUInformation("DZN","DOZ","dozen"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DZP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'dozen_pack': makeEUInformation("DZP","","dozen pack - A unit of count defining the number of packs in multiples of 12 (pack: standard packaging unit)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DPR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'dozen_pair': makeEUInformation("DPR","","dozen pair - A unit of count defining the number of pairs in multiples of 12 (pair: item described by twos)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DPC. displayName/description below are node-opcua's own, from UNECE rec20. */
       'dozen_piece': makeEUInformation("DPC","","dozen piece - A unit of count defining the number of pieces in multiples of 12 (piece: a single item, article or exemplar)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DRL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'dozen_roll': makeEUInformation("DRL","","dozen roll - A unit of count defining the number of rolls, expressed in twelve roll units."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DRI. displayName/description below are node-opcua's own, from UNECE rec20. */
       'dram(UK)': makeEUInformation("DRI","","dram (UK) - Synonym: avoirdupois dram (1,771 745 g)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DRA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'dram(US)': makeEUInformation("DRA","","dram (US) - Synonym: drachm (UK), troy dram (3,887 935 g)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DB. displayName/description below are node-opcua's own, from UNECE rec20. */
       'dry_pound': makeEUInformation("DB","","dry pound - A unit of mass defining the number of pounds of a product, disregarding the water content of the product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'dry_ton': makeEUInformation("DT","","dry ton - A unit of mass defining the number of tons of a product, disregarding the water content of the product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code EA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'each': makeEUInformation("EA","","each - A unit of count defining the number of items regarded as separate units."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code EB. displayName/description below are node-opcua's own, from UNECE rec20. */
       'electronic_mail_box': makeEUInformation("EB","","electronic mail box - A unit of count defining the number of electronic mail boxes."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code EQ. displayName/description below are node-opcua's own, from UNECE rec20. */
       'equivalent_gallon': makeEUInformation("EQ","","equivalent gallon - A unit of volume defining the number of gallons of product produced from concentrate."),
       'erlang': makeEUInformation("Q11","E","erlang"),
       'exabit_per_second': makeEUInformation("E58","Ebit/s","exabit per second"),
       'exbibit_per_cubic_metre': makeEUInformation("E67","Eibit/m³","exbibit per cubic metre"),
       'exbibit_per_metre': makeEUInformation("E65","Eibit/m","exbibit per metre"),
       'exbibit_per_square_metre': makeEUInformation("E66","Eibit/m²","exbibit per square metre"),
       'exbibyte': makeEUInformation("E59","Eibyte","exbibyte"),
       'failures_in_time': makeEUInformation("FIT","FIT","failures in time"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code FBM. displayName/description below are node-opcua's own, from UNECE rec20. */
       'fibre_metre': makeEUInformation("FBM","","fibre metre - A unit of length defining the number of metres of individual fibre."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code P5. displayName/description below are node-opcua's own, from UNECE rec20. */
       'five_pack': makeEUInformation("P5","","five pack - A unit of count defining the number of five-packs (five-pack: set of five items packaged together)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 1I. displayName/description below are node-opcua's own, from UNECE rec20. */
       'fixed_rate': makeEUInformation("1I","","fixed rate - A unit of quantity expressed as a predetermined or set rate for usage of a facility or service."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code FL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'flake_ton': makeEUInformation("FL","","flake ton - A unit of mass defining the number of tons of a flaked substance (flake: a small flattish fragment)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E33. displayName/description below are node-opcua's own, from UNECE rec20. */
       'foot_per_thousand': makeEUInformation("E33","","foot per thousand - A unit of count defining the number of feet per thousand units. (3,048 x 10⁻⁴ m)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 21. displayName/description below are node-opcua's own, from UNECE rec20. */
       'forty_foot_container': makeEUInformation("21","","forty foot container - A unit of count defining the number of shipping containers that measure 40 foot in length."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code A75. displayName/description below are node-opcua's own, from UNECE rec20. */
       'freight_ton': makeEUInformation("A75","","freight ton - A unit of information typically used for billing purposes, defined as either the number of metric tons or the number of cubic metres, whichever is the larger."),
       'gallon(US)_per_day': makeEUInformation("GB","gal (US)/d","gallon (US) per day"),
       'gibibit': makeEUInformation("B30","Gibit","gibibit"),
       'gibibit_per_cubic_metre': makeEUInformation("E71","Gibit/m³","gibibit per cubic metre"),
       'gibibit_per_metre': makeEUInformation("E69","Gibit/m","gibibit per metre"),
       'gibibit_per_square_metre': makeEUInformation("E70","Gibit/m²","gibibit per square metre"),
       'gibibyte': makeEUInformation("E62","Gibyte","gibibyte"),
       'gigabit': makeEUInformation("B68","Gbit","gigabit"),
       'gigabit_per_second': makeEUInformation("B80","Gbit/s","gigabit per second"),
       'gigabyte': makeEUInformation("E34","Gbyte","gigabyte"),
       'gigabyte_per_second': makeEUInformation("E68","Gbyte/s","gigabyte per second"),
       'gill(UK)': makeEUInformation("GII","gi (UK)","gill (UK)"),
       'gill(US)': makeEUInformation("GIA","gi (US)","gill (US)"),
       'gram_of_fissile_isotope': makeEUInformation("GFI","gi F/S","gram of fissile isotope"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code GDW. displayName/description below are node-opcua's own, from UNECE rec20. */
       'gram(dry_weight)': makeEUInformation("GDW","","gram, dry weight - A unit of mass defining the number of grams of a product, disregarding the water content of the product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code GIC. displayName/description below are node-opcua's own, from UNECE rec20. */
       'gram(including_container)': makeEUInformation("GIC","","gram, including container - A unit of mass defining the number of grams of a product, including its container."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code GIP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'gram(including_inner_packaging)': makeEUInformation("GIP","","gram, including inner packaging - A unit of mass defining the number of grams of a product, including its inner packaging materials."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code GGR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'great_gross': makeEUInformation("GGR","","great gross - A unit of count defining the number of units in multiples of 1728 (12 x 12 x 12). (1728)"),
       'gross': makeEUInformation("GRO","gr","gross"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E4. displayName/description below are node-opcua's own, from UNECE rec20. */
       'gross_kilogram': makeEUInformation("E4","","gross kilogram - A unit of mass defining the total number of kilograms before deductions."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 10. displayName/description below are node-opcua's own, from UNECE rec20. */
       'group': makeEUInformation("10","","group - A unit of count defining the number of groups (group: set of items classified together)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SAN. displayName/description below are node-opcua's own, from UNECE rec20. */
       'half_year(6_months)': makeEUInformation("SAN","","half year (6 months) - A unit of time defining the number of half years (6 months)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code Z11. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hanging_container': makeEUInformation("Z11","","hanging container - A unit of count defining the number of hanging containers."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code HA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hank': makeEUInformation("HA","","hank - A unit of length, typically for yarn."),
       'hartley': makeEUInformation("Q15","Hart","hartley"),
       'hartley_per_second': makeEUInformation("Q18","Hart/s","hartley per second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code HEA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'head': makeEUInformation("HEA","","head - A unit of count defining the number of heads (head: a person or animal considered as one of a number)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code HPA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hectolitre_of_pure_alcohol': makeEUInformation("HPA","","hectolitre of pure alcohol - A unit of volume equal to one hundred litres of pure alcohol."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code CEN. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred': makeEUInformation("CEN","","hundred - A unit of count defining the number of units in multiples of 100. (100)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code BP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_board_foot': makeEUInformation("BP","","hundred board foot - A unit of volume equal to one hundred board foot."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code HBX. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_boxes': makeEUInformation("HBX","","hundred boxes - A unit of count defining the number of boxes in multiples of one hundred box units."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code HC. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_count': makeEUInformation("HC","","hundred count - A unit of count defining the number of units counted in multiples of 100."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code HH. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_cubic_foot': makeEUInformation("HH","","hundred cubic foot - A unit of volume equal to one hundred cubic foot."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code FF. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_cubic_metre': makeEUInformation("FF","","hundred cubic metre - A unit of volume equal to one hundred cubic metres."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code HIU. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_international_unit': makeEUInformation("HIU","","hundred international unit - A unit of count defining the number of international units in multiples of 100."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code HDW. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_kilogram(dry_weight)': makeEUInformation("HDW","","hundred kilogram, dry weight - A unit of mass defining the number of hundred kilograms of a product, disregarding the water content of the product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code HKM. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_kilogram(net_mass)': makeEUInformation("HKM","","hundred kilogram, net mass - A unit of mass defining the number of hundred kilograms of a product, after deductions."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code CLF. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_leave': makeEUInformation("CLF","","hundred leave - A unit of count defining the number of leaves, expressed in units of one hundred leaves."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code JPS. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_metre': makeEUInformation("JPS","","hundred metre - A unit of count defining the number of 100 metre lengths."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code CNP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hundred_pack': makeEUInformation("CNP","","hundred pack - A unit of count defining the number of hundred-packs (hundred-pack: set of one hundred items packaged together)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 5J. displayName/description below are node-opcua's own, from UNECE rec20. */
       'hydraulic_horse_power': makeEUInformation("5J","","hydraulic horse power - A unit of power defining the hydraulic horse power delivered by a fluid pump depending on the viscosity of the fluid."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code B82. displayName/description below are node-opcua's own, from UNECE rec20. */
       'inch_per_linear_foot': makeEUInformation("B82","","inch per linear foot - A unit of length defining the number of inches per linear foot."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ISD. displayName/description below are node-opcua's own, from UNECE rec20. */
       'international_sugar_degree': makeEUInformation("ISD","","international sugar degree - A unit of measure defining the sugar content of a solution, expressed in degrees."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code IUG. displayName/description below are node-opcua's own, from UNECE rec20. */
       'international_unit_per_gram': makeEUInformation("IUG","","international unit per gram - A unit of count defining the number of international units per gram."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E51. displayName/description below are node-opcua's own, from UNECE rec20. */
       'job': makeEUInformation("E51","","job - A unit of count defining the number of jobs."),
       'joule_per_tesla': makeEUInformation("Q10","J/T","joule per tesla"),
       'kibibit': makeEUInformation("C21","Kibit","kibibit"),
       'kibibit_per_cubic_metre': makeEUInformation("E74","Kibit/m³","kibibit per cubic metre"),
       'kibibit_per_metre': makeEUInformation("E72","Kibit/m","kibibit per metre"),
       'kibibit_per_square_metre': makeEUInformation("E73","Kibit/m²","kibibit per square metre"),
       'kibibyte': makeEUInformation("E64","Kibyte","kibibyte"),
       'kilobaud': makeEUInformation("K50","kBd","kilobaud"),
       'kilobit': makeEUInformation("C37","kbit","kilobit"),
       'kilobit_per_second': makeEUInformation("C74","kbit/s","kilobit per second"),
       'kilobyte': makeEUInformation("2P","kbyte","kilobyte"),
       'kilobyte_per_second': makeEUInformation("P94","kbyte/s","kilobyte per second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KB. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilocharacter': makeEUInformation("KB","","kilocharacter - A unit of information equal to 10³ (1000) characters."),
       'kilogram_drained_net_weight': makeEUInformation("KDW","kg/net eda","kilogram drained net weight"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KNS. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilogram_named_substance': makeEUInformation("KNS","","kilogram named substance - A unit of mass equal to one kilogram of a named substance."),
       'kilogram_of_choline_chloride': makeEUInformation("KCC","kg C₅ H₁₄ClNO","kilogram of choline chloride"),
       'kilogram_of_hydrogen_peroxide': makeEUInformation("KHY","kg H₂O₂","kilogram of hydrogen peroxide"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code TMS. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilogram_of_imported_meat(less_offal)': makeEUInformation("TMS","","kilogram of imported meat, less offal - A unit of mass equal to one thousand grams of imported meat, disregarding less valuable by-products such as the entrails."),
       'kilogram_of_methylamine': makeEUInformation("KMA","kg met.am.","kilogram of methylamine"),
       'kilogram_of_nitrogen': makeEUInformation("KNI","kg N","kilogram of nitrogen"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KPP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilogram_of_phosphorus_pentoxide(phosphoric_anhydride)': makeEUInformation("KPP","","kilogram of phosphorus pentoxide (phosphoric anhydride) - A unit of mass equal to one thousand grams of phosphorus pentoxide phosphoric anhydride."),
       'kilogram_of_potassium_hydroxide(caustic_potash)': makeEUInformation("KPH","kg KOH","kilogram of potassium hydroxide (caustic potash)"),
       'kilogram_of_potassium_oxide': makeEUInformation("KPO","kg K₂O","kilogram of potassium oxide"),
       'kilogram_of_sodium_hydroxide(caustic_soda)': makeEUInformation("KSH","kg NaOH","kilogram of sodium hydroxide (caustic soda)"),
       'kilogram_of_substance_90_%_dry': makeEUInformation("KSD","kg 90 % sdt","kilogram of substance 90 % dry"),
       'kilogram_of_tungsten_trioxide': makeEUInformation("KWO","kg WO₃","kilogram of tungsten trioxide"),
       'kilogram_of_uranium': makeEUInformation("KUR","kg U","kilogram of uranium"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KI. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilogram_per_millimetre_width': makeEUInformation("KI","","kilogram per millimetre width (10³ kg/m)"),
       'kilogram_per_square_metre_pascal_second': makeEUInformation("Q28","kg/(m²·Pa·s)","kilogram per square metre pascal second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MND. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilogram(dry_weight)': makeEUInformation("MND","","kilogram, dry weight - A unit of mass defining the number of kilograms of a product, disregarding the water content of the product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KIC. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilogram(including_container)': makeEUInformation("KIC","","kilogram, including container - A unit of mass defining the number of kilograms of a product, including its container."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KIP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilogram(including_inner_packaging)': makeEUInformation("KIP","","kilogram, including inner packaging - A unit of mass defining the number of kilograms of a product, including its inner packaging materials."),
       'kilogram-force_metre_per_square_centimetre': makeEUInformation("E44","kgf·m/cm²","kilogram-force metre per square centimetre"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KJ. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilosegment': makeEUInformation("KJ","","kilosegment - A unit of information equal to 10³ (1000) segments."),
       'kilovolt_ampere_hour': makeEUInformation("C79","kVAh","kilovolt ampere hour"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code K2. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilovolt_ampere_reactive_demand': makeEUInformation("K2","","kilovolt ampere reactive demand - A unit of measure defining the reactive power demand equal to one kilovolt ampere of reactive power."),
       'kilovolt_ampere_reactive_hour': makeEUInformation("K3","kvar·h","kilovolt ampere reactive hour"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code K1. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kilowatt_demand': makeEUInformation("K1","","kilowatt demand - A unit of measure defining the power load measured at predetermined intervals."),
       'kilowatt_hour_per_cubic_metre': makeEUInformation("E46","kW·h/m³","kilowatt hour per cubic metre"),
       'kilowatt_hour_per_hour': makeEUInformation("D03","kW·h/h","kilowatt hour per hour"),
       'kilowatt_hour_per_kelvin': makeEUInformation("E47","kW·h/K","kilowatt hour per kelvin"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'kit': makeEUInformation("KT","","kit - A unit of count defining the number of kits (kit: tub, barrel or pail)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LH. displayName/description below are node-opcua's own, from UNECE rec20. */
       'labour_hour': makeEUInformation("LH","","labour hour - A unit of time defining the number of labour hours."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KLK. displayName/description below are node-opcua's own, from UNECE rec20. */
       'lactic_dry_material_percentage': makeEUInformation("KLK","","lactic dry material percentage - A unit of proportion defining the percentage of dry lactic material in a product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LAC. displayName/description below are node-opcua's own, from UNECE rec20. */
       'lactose_excess_percentage': makeEUInformation("LAC","","lactose excess percentage - A unit of proportion defining the percentage of lactose in a product that exceeds a defined percentage level."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'layer': makeEUInformation("LR","","layer - A unit of count defining the number of layers."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LEF. displayName/description below are node-opcua's own, from UNECE rec20. */
       'leaf': makeEUInformation("LEF","","leaf - A unit of count defining the number of leaves."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LN. displayName/description below are node-opcua's own, from UNECE rec20. */
       'length': makeEUInformation("LN","","length - A unit of distance defining the linear extent of an item measured from end to end."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LF. displayName/description below are node-opcua's own, from UNECE rec20. */
       'linear_foot': makeEUInformation("LF","","linear foot - A unit of count defining the number of feet (12-inch) in length of a uniform width object."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LM. displayName/description below are node-opcua's own, from UNECE rec20. */
       'linear_metre': makeEUInformation("LM","","linear metre - A unit of count defining the number of metres in length of a uniform width object."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LY. displayName/description below are node-opcua's own, from UNECE rec20. */
       'linear_yard': makeEUInformation("LY","","linear yard - A unit of count defining the number of 36-inch units in length of a uniform width object."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LK. displayName/description below are node-opcua's own, from UNECE rec20. */
       'link': makeEUInformation("LK","","link - A unit of distance equal to 0.01 chain."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'liquid_pound': makeEUInformation("LP","","liquid pound - A unit of mass defining the number of pounds of a liquid substance."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LPA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'litre_of_pure_alcohol': makeEUInformation("LPA","","litre of pure alcohol - A unit of volume equal to one litre of pure alcohol."),
       'litre_per_hour': makeEUInformation("E32","l/h","litre per hour"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'load': makeEUInformation("NL","","load - A unit of volume defining the number of loads (load: a quantity of items carried or processed at one time)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LO. displayName/description below are node-opcua's own, from UNECE rec20. */
       'lot[unit_of_procurement]': makeEUInformation("LO","","lot [unit of procurement] - A unit of count defining the number of lots (lot: a collection of associated items)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code D04. displayName/description below are node-opcua's own, from UNECE rec20. */
       'lot[unit_of_weight]': makeEUInformation("D04","","lot [unit of weight] - A unit of weight equal to about 1/2 ounce or 15 grams."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LS. displayName/description below are node-opcua's own, from UNECE rec20. */
       'lump_sum': makeEUInformation("LS","","lump sum - A unit of count defining the number of whole or a complete monetary amounts."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 3C. displayName/description below are node-opcua's own, from UNECE rec20. */
       'manmonth': makeEUInformation("3C","","manmonth - A unit of count defining the number of months for a person or persons to perform an undertaking."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code Q3. displayName/description below are node-opcua's own, from UNECE rec20. */
       'meal': makeEUInformation("Q3","","meal - A unit of count defining the number of meals (meal: an amount of food to be eaten on a single occasion)."),
       'mebibit': makeEUInformation("D11","Mibit","mebibit"),
       'mebibit_per_cubic_metre': makeEUInformation("E77","Mibit/m³","mebibit per cubic metre"),
       'mebibit_per_metre': makeEUInformation("E75","Mibit/m","mebibit per metre"),
       'mebibit_per_square_metre': makeEUInformation("E76","Mibit/m²","mebibit per square metre"),
       'mebibyte': makeEUInformation("E63","Mibyte","mebibyte"),
       'megabaud': makeEUInformation("J54","MBd","megabaud"),
       'megabit': makeEUInformation("D36","Mbit","megabit"),
       'megabit_per_second': makeEUInformation("E20","Mbit/s","megabit per second"),
       'megabyte': makeEUInformation("4L","Mbyte","megabyte"),
       'megabyte_per_second': makeEUInformation("P95","Mbyte/s","megabyte per second"),
       'megajoule_per_second': makeEUInformation("D78","MJ/s","megajoule per second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E38. displayName/description below are node-opcua's own, from UNECE rec20. */
       'megapixel': makeEUInformation("E38","","megapixel - A unit of count equal to 10⁶ (1000000) pixels (picture elements)."),
       'megavolt_ampere_reactive_hour': makeEUInformation("MAH","Mvar·h","megavolt ampere reactive hour"),
       'megawatt_hour_per_hour': makeEUInformation("E07","MW·h/h","megawatt hour per hour"),
       'megawatt_per_hertz': makeEUInformation("E08","MW/Hz","megawatt per hertz"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 57. displayName/description below are node-opcua's own, from UNECE rec20. */
       'mesh': makeEUInformation("57","","mesh - A unit of count defining the number of strands per inch as a measure of the fineness of a woven product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NF. displayName/description below are node-opcua's own, from UNECE rec20. */
       'message': makeEUInformation("NF","","message - A unit of count defining the number of messages."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code CTM. displayName/description below are node-opcua's own, from UNECE rec20. */
       'metric_carat': makeEUInformation("CTM","","metric carat (200 mg)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code TIC. displayName/description below are node-opcua's own, from UNECE rec20. */
       'metric_ton(including_container)': makeEUInformation("TIC","","metric ton, including container - A unit of mass defining the number of metric tons of a product, including its container."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code TIP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'metric_ton(including_inner_packaging)': makeEUInformation("TIP","","metric ton, including inner packaging - A unit of mass defining the number of metric tons of a product, including its inner packaging materials."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LUB. displayName/description below are node-opcua's own, from UNECE rec20. */
       'metric_ton(lubricating_oil)': makeEUInformation("LUB","","metric ton, lubricating oil - A unit of mass defining the number of metric tons of lubricating oil."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E12. displayName/description below are node-opcua's own, from UNECE rec20. */
       'mille': makeEUInformation("E12","","mille - A unit of count defining the number of cigarettes in units of 1000."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MLD. displayName/description below are node-opcua's own, from UNECE rec20. */
       'milliard': makeEUInformation("MLD","","milliard - Synonym: billion (US) (10⁹)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code KO. displayName/description below are node-opcua's own, from UNECE rec20. */
       'milliequivalence_caustic_potash_per_gram_of_product': makeEUInformation("KO","","milliequivalence caustic potash per gram of product - A unit of count defining the number of milligrams of potassium hydroxide per gram of product as a measure of the concentration of potassium hydroxide in the product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MIO. displayName/description below are node-opcua's own, from UNECE rec20. */
       'million': makeEUInformation("MIO","","million (10⁶)"),
       'million_Btu_per_1000_cubic_foot': makeEUInformation("M9","MBTU/kft³","million Btu per 1000 cubic foot"),
       'million_Btu(IT)_per_hour': makeEUInformation("E16","BtuIT/h","million Btu(IT) per hour"),
       'million_cubic_metre': makeEUInformation("HMQ","Mm³","million cubic metre"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MIU. displayName/description below are node-opcua's own, from UNECE rec20. */
       'million_international_unit': makeEUInformation("MIU","","million international unit - A unit of count defining the number of international units in multiples of 10⁶."),
       'module_width': makeEUInformation("H77","MW","module width"),
       'mole_per_cubiv_metre_to_the_power_sum_of_stoichiometric_numbers': makeEUInformation("P99","(mol/m³)∑νB","mole per cubiv metre to the power sum of stoichiometric numbers"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code M4. displayName/description below are node-opcua's own, from UNECE rec20. */
       'monetary_value': makeEUInformation("M4","","monetary value - A unit of measure expressed as a monetary amount."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ZZ. displayName/description below are node-opcua's own, from UNECE rec20. */
       'mutually_defined': makeEUInformation("ZZ","","mutually defined - A unit of measure as agreed in common between two or more parties."),
       'natural_unit_of_information': makeEUInformation("Q16","nat","natural unit of information"),
       'natural_unit_of_information_per_second': makeEUInformation("Q19","nat/s","natural unit of information per second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 58. displayName/description below are node-opcua's own, from UNECE rec20. */
       'net_kilogram': makeEUInformation("58","","net kilogram - A unit of mass defining the total number of kilograms after deductions."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'net_ton': makeEUInformation("NT","","net ton - A unit of mass equal to 2000 pounds, see ton (US).  Refer International Convention on tonnage measurement of Ships."),
       'newton_metre_per_metre': makeEUInformation("Q27","N·m/m²","newton metre per metre"),
       'nil': makeEUInformation("NIL","()","nil"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NAR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'number_of_articles': makeEUInformation("NAR","","number of articles - A unit of count defining the number of articles (article: item)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NCL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'number_of_cells': makeEUInformation("NCL","","number of cells - A unit of count defining the number of cells (cell: an enclosed or circumscribed space, cavity, or volume)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NIU. displayName/description below are node-opcua's own, from UNECE rec20. */
       'number_of_international_units': makeEUInformation("NIU","","number of international units - A unit of count defining the number of international units."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code JWL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'number_of_jewels': makeEUInformation("JWL","","number of jewels - A unit of count defining the number of jewels (jewel: precious stone)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NMP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'number_of_packs': makeEUInformation("NMP","","number of packs - A unit of count defining the number of packs (pack: a collection of objects packaged together)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code NPT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'number_of_parts': makeEUInformation("NPT","","number of parts - A unit of count defining the number of parts (part: component of a larger entity)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code D68. displayName/description below are node-opcua's own, from UNECE rec20. */
       'number_of_words': makeEUInformation("D68","","number of words - A unit of count defining the number of words."),
       'octet': makeEUInformation("Q12","o","octet"),
       'octet_per_second': makeEUInformation("Q13","o/s","octet per second"),
       'one_per_one': makeEUInformation("Q26","1/1","one per one"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 11. displayName/description below are node-opcua's own, from UNECE rec20. */
       'outfit': makeEUInformation("11","","outfit - A unit of count defining the number of outfits (outfit: a complete set of equipment / materials / objects used for a specific purpose)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code OT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'overtime_hour': makeEUInformation("OT","","overtime hour - A unit of time defining the number of overtime hours."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ODE. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ozone_depletion_equivalent': makeEUInformation("ODE","","ozone depletion equivalent - A unit of mass defining the ozone depletion potential in kilograms of a product relative to the calculated depletion for the reference substance, Trichlorofluoromethane (CFC-11)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code PD. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pad': makeEUInformation("PD","","pad - A unit of count defining the number of pads (pad: block of paper sheets fastened together at one end)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ZP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'page': makeEUInformation("ZP","","page - A unit of count defining the number of pages."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code QA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'page-facsimile': makeEUInformation("QA","","page - facsimile - A unit of count defining the number of facsimile pages."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code QB. displayName/description below are node-opcua's own, from UNECE rec20. */
       'page-hardcopy': makeEUInformation("QB","","page - hardcopy - A unit of count defining the number of hardcopy pages (hardcopy page: a page rendered as printed or written output on paper, film, or other permanent medium)."),
       'page_per_inch': makeEUInformation("PQ","ppi","page per inch"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code PR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pair': makeEUInformation("PR","","pair - A unit of count defining the number of pairs (pair: item described by twos). (2)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code OA. displayName/description below are node-opcua's own, from UNECE rec20. */
       'panel': makeEUInformation("OA","","panel - A unit of count defining the number of panels (panel: a distinct, usually rectangular, section of a surface)."),
       'part_per_billion(US)': makeEUInformation("61","ppb","part per billion (US)"),
       'part_per_hundred_thousand': makeEUInformation("E40","ppht","part per hundred thousand"),
       'part_per_million': makeEUInformation("59","ppm","part per million"),
       'part_per_thousand': makeEUInformation("NX","‰","part per thousand"),
       'pascal_to_the_power_sum_of_stoichiometric_numbers': makeEUInformation("P98","PaΣνB","pascal to the power sum of stoichiometric numbers"),
       'pebibit_per_cubic_metre': makeEUInformation("E82","Pibit/m³","pebibit per cubic metre"),
       'pebibit_per_metre': makeEUInformation("E80","Pibit/m","pebibit per metre"),
       'pebibit_per_square_metre': makeEUInformation("E81","Pibit/m²","pebibit per square metre"),
       'pebibyte': makeEUInformation("E60","Pibyte","pebibyte"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code N1. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pen_calorie': makeEUInformation("N1","","pen calorie - A unit of count defining the number of calories prescribed daily for parenteral/enteral therapy."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code D23. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pen_gram(protein)': makeEUInformation("D23","","pen gram (protein) - A unit of count defining the number of grams of amino acid prescribed for parenteral/enteral therapy."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DWT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pennyweight': makeEUInformation("DWT","","pennyweight (1,555 174 g)"),
       'per_mille_per_psi': makeEUInformation("J12","‰/psi","per mille per psi"),
       'percent': makeEUInformation("P1","% or pct","percent"),
       'percent_per_bar': makeEUInformation("H96","%/bar","percent per bar"),
       'percent_per_decakelvin': makeEUInformation("H73","%/daK","percent per decakelvin"),
       'percent_per_degree': makeEUInformation("H90","%/°","percent per degree"),
       'percent_per_degree_Celsius': makeEUInformation("M25","%/°C","percent per degree Celsius"),
       'percent_per_hectobar': makeEUInformation("H72","%/hbar","percent per hectobar"),
       'percent_per_hundred': makeEUInformation("H93","%/100","percent per hundred"),
       'percent_per_inch': makeEUInformation("H98","%/in","percent per inch"),
       'percent_per_kelvin': makeEUInformation("H25","%/K","percent per kelvin"),
       'percent_per_metre': makeEUInformation("H99","%/m","percent per metre"),
       'percent_per_millimetre': makeEUInformation("J10","%/mm","percent per millimetre"),
       'percent_per_month': makeEUInformation("H71","%/mo","percent per month"),
       'percent_per_ohm': makeEUInformation("H89","%/Ω","percent per ohm"),
       'percent_per_one_hundred_thousand': makeEUInformation("H92","%/100000","percent per one hundred thousand"),
       'percent_per_ten_thousand': makeEUInformation("H91","%/10000","percent per ten thousand"),
       'percent_per_thousand': makeEUInformation("H94","%/1000","percent per thousand"),
       'percent_per_volt': makeEUInformation("H95","%/V","percent per volt"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code VP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'percent_volume': makeEUInformation("VP","","percent volume - A measure of concentration, typically expressed as the percentage volume of a solute in a solution."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 60. displayName/description below are node-opcua's own, from UNECE rec20. */
       'percent_weight': makeEUInformation("60","","percent weight - A unit of proportion equal to 10⁻². (1 x 10⁻²)"),
       'perm(0_ºC)': makeEUInformation("P91","perm (0 ºC)","perm (0 ºC)"),
       'perm(23_ºC)': makeEUInformation("P92","perm (23 ºC)","perm (23 ºC)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code IE. displayName/description below are node-opcua's own, from UNECE rec20. */
       'person': makeEUInformation("IE","","person - A unit of count defining the number of persons."),
       'petabit': makeEUInformation("E78","Pbit","petabit"),
       'petabit_per_second': makeEUInformation("E79","Pbit/s","petabit per second"),
       'petabyte': makeEUInformation("E36","Pbyte","petabyte"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code R1. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pica': makeEUInformation("R1","","pica - A unit of count defining the number of picas. (pica: typographical length equal to 12 points or 4.22 mm (approx.)). (4,217 518 x 10⁻³ m)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code H87. displayName/description below are node-opcua's own, from UNECE rec20. */
       'piece': makeEUInformation("H87","","piece - A unit of count defining the number of pieces (piece: a single item, article or exemplar)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E19. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ping': makeEUInformation("E19","","ping - A unit of area equal to 3.3 square metres. (3,305 m²)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code JNT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pipeline_joint': makeEUInformation("JNT","","pipeline joint - A count of the number of pipeline joints."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code PI. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pitch': makeEUInformation("PI","","pitch - A unit of count defining the number of characters that fit in a horizontal inch."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E37. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pixel': makeEUInformation("E37","","pixel - A unit of count defining the number of pixels (pixel: picture element)."),
       'portion': makeEUInformation("PTN","PTN","portion"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code RP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'pound_per_ream': makeEUInformation("RP","","pound per ream - A unit of mass for paper, expressed as pounds per ream. (ream: a large quantity of paper, typically 500 sheets)."),
       'pound-force_foot_per_inch': makeEUInformation("P89","lbf·ft/in","pound-force foot per inch"),
       'pound-force_inch_per_inch': makeEUInformation("P90","lbf·in/in","pound-force inch per inch"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code N3. displayName/description below are node-opcua's own, from UNECE rec20. */
       'print_point': makeEUInformation("N3","","print point (0,013 8 in (approx))"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code PGL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'proof_gallon': makeEUInformation("PGL","","proof gallon - A unit of volume equal to one gallon of proof spirits, or the alcohol equivalent thereof. Used for measuring the strength of distilled alcoholic liquors, expressed as a percentage of the alcohol content of a standard mixture at a specific temperature."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code PFL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'proof_litre': makeEUInformation("PFL","","proof litre - A unit of volume equal to one litre of proof spirits, or the alcohol equivalent thereof. Used for measuring the strength of distilled alcoholic liquors, expressed as a percentage of the alcohol content of a standard mixture at a specific temperature."),
       'quarter(UK)': makeEUInformation("QTR","Qr (UK)","quarter (UK)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code QAN. displayName/description below are node-opcua's own, from UNECE rec20. */
       'quarter(of_a_year)': makeEUInformation("QAN","","quarter (of a year) - A unit of time defining the number of quarters (3 months)."),
       'quire': makeEUInformation("QR","qr","quire"),
       'rack_unit': makeEUInformation("H80","U or RU","rack unit"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code A9. displayName/description below are node-opcua's own, from UNECE rec20. */
       'rate': makeEUInformation("A9","","rate - A unit of quantity expressed as a rate for usage of a facility or service."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 13. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ration': makeEUInformation("13","","ration - A unit of count defining the number of rations (ration: a single portion of provisions)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code RM. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ream': makeEUInformation("RM","","ream - A unit of count for paper, expressed as the number of reams (ream: a large quantity of paper sheets, typically 500)."),
       'reciprocal_centimetre': makeEUInformation("E90","cm⁻¹","reciprocal centimetre"),
       'reciprocal_day': makeEUInformation("E91","d⁻¹","reciprocal day"),
       'reciprocal_inch': makeEUInformation("Q24","1/in","reciprocal inch"),
       'reciprocal_radian': makeEUInformation("P97","1/rad","reciprocal radian"),
       'reciprocal_volt': makeEUInformation("P96","1/V","reciprocal volt"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code RT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'revenue_ton_mile': makeEUInformation("RT","","revenue ton mile - A unit of information typically used for billing purposes, expressed as the number of revenue tons (revenue ton: either a metric ton or a cubic metres, whichever is the larger), moved over a distance of one mile."),
       'rhe': makeEUInformation("P88","rhe","rhe"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code ROM. displayName/description below are node-opcua's own, from UNECE rec20. */
       'room': makeEUInformation("ROM","","room - A unit of count defining the number of rooms."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code D65. displayName/description below are node-opcua's own, from UNECE rec20. */
       'round': makeEUInformation("D65","","round - A unit of count defining the number of rounds (round: A circular or cylindrical object)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E52. displayName/description below are node-opcua's own, from UNECE rec20. */
       'run_foot': makeEUInformation("E52","","run foot - A unit of count defining the number feet per run."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code RH. displayName/description below are node-opcua's own, from UNECE rec20. */
       'running_or_operating_hour': makeEUInformation("RH","","running or operating hour - A unit of time defining the number of hours of operation."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SCO. displayName/description below are node-opcua's own, from UNECE rec20. */
       'score': makeEUInformation("SCO","","score - A unit of count defining the number of units in multiples of 20. (20)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SCR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'scruple': makeEUInformation("SCR","","scruple (1,295 982 g)"),
       'second_per_kilogramm': makeEUInformation("Q20","s/kg","second per kilogramm"),
       'second_per_radian_cubic_metre': makeEUInformation("Q22","1/(Hz·rad·m³)","second per radian cubic metre"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SG. displayName/description below are node-opcua's own, from UNECE rec20. */
       'segment': makeEUInformation("SG","","segment - A unit of information equal to 64000 bytes."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E48. displayName/description below are node-opcua's own, from UNECE rec20. */
       'service_unit': makeEUInformation("E48","","service unit - A unit of count defining the number of service units (service unit: defined period / property / facility / utility of supply)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SET. displayName/description below are node-opcua's own, from UNECE rec20. */
       'set': makeEUInformation("SET","","set - A unit of count defining the number of sets (set: a number of objects grouped together)."),
       'shannon': makeEUInformation("Q14","Sh","shannon"),
       'shannon_per_second': makeEUInformation("Q17","Sh/s","shannon per second"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E21. displayName/description below are node-opcua's own, from UNECE rec20. */
       'shares': makeEUInformation("E21","","shares - A unit of count defining the number of shares (share: a total or portion of the parts into which a business entity’s capital is divided)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SX. displayName/description below are node-opcua's own, from UNECE rec20. */
       'shipment': makeEUInformation("SX","","shipment - A unit of count defining the number of shipments (shipment: an amount of goods shipped or transported)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 14. displayName/description below are node-opcua's own, from UNECE rec20. */
       'shot': makeEUInformation("14","","shot - A unit of liquid measure, especially related to spirits."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 56. displayName/description below are node-opcua's own, from UNECE rec20. */
       'sitas': makeEUInformation("56","","sitas - A unit of area for tin plate equal to a surface area of 100 square metres."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SW. displayName/description below are node-opcua's own, from UNECE rec20. */
       'skein': makeEUInformation("SW","","skein - A unit of count defining the number of skeins (skein: a loosely-coiled bundle of yarn or thread)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SQ. displayName/description below are node-opcua's own, from UNECE rec20. */
       'square': makeEUInformation("SQ","","square - A unit of count defining the number of squares (square: rectangular shape)."),
       'square_metre_per_litre': makeEUInformation("E31","m²/l","square metre per litre"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SQR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'square(roofing)': makeEUInformation("SQR","","square, roofing - A unit of count defining the number of squares of roofing materials, measured in multiples of 100 square feet."),
       'standard': makeEUInformation("WSD","std","standard"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DMO. displayName/description below are node-opcua's own, from UNECE rec20. */
       'standard_kilolitre': makeEUInformation("DMO","","standard kilolitre - A unit of volume defining the number of kilolitres of a product at a temperature of 15 degrees Celsius, especially in relation to hydrocarbon oils."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code STL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'standard_litre': makeEUInformation("STL","","standard litre - A unit of volume defining the number of litres of a product at a temperature of 15 degrees Celsius, especially in relation to hydrocarbon oils."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code STC. displayName/description below are node-opcua's own, from UNECE rec20. */
       'stick': makeEUInformation("STC","","stick - A unit of count defining the number of sticks (stick: slender and often cylindrical piece of a substance)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code STK. displayName/description below are node-opcua's own, from UNECE rec20. */
       'stick(cigarette)': makeEUInformation("STK","","stick, cigarette - A unit of count defining the number of cigarettes in the smallest unit for stock-taking and/or duty computation."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 15. displayName/description below are node-opcua's own, from UNECE rec20. */
       'stick(military)': makeEUInformation("15","","stick, military - A unit of count defining the number of military sticks (military stick: bombs or paratroops released in rapid succession from an aircraft)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E30. displayName/description below are node-opcua's own, from UNECE rec20. */
       'strand': makeEUInformation("E30","","strand - A unit of count defining the number of strands (strand: long, thin, flexible, single thread, strip of fibre, constituent filament or multiples of the same, twisted together)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code STW. displayName/description below are node-opcua's own, from UNECE rec20. */
       'straw': makeEUInformation("STW","","straw - A unit of count defining the number of straws (straw: a slender tube used for sucking up liquids)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'strip': makeEUInformation("SR","","strip - A unit of count defining the number of strips (strip: long narrow piece of an object)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code SYR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'syringe': makeEUInformation("SYR","","syringe - A unit of count defining the number of syringes (syringe: a small device for pumping, spraying and/or injecting liquids through a small aperture)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code U2. displayName/description below are node-opcua's own, from UNECE rec20. */
       'tablet': makeEUInformation("U2","","tablet - A unit of count defining the number of tablets (tablet: a small flat or compressed solid object)."),
       'tebibit_per_cubic_metre': makeEUInformation("E86","Tibit/m³","tebibit per cubic metre"),
       'tebibit_per_metre': makeEUInformation("E85","Tibit/m","tebibit per metre"),
       'tebibit_per_square_metre': makeEUInformation("E87","Tibit/m²","tebibit per square metre"),
       'tebibyte': makeEUInformation("E61","Tibyte","tebibyte"),
       'teeth_per_inch': makeEUInformation("TPI","TPI","teeth per inch"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code T0. displayName/description below are node-opcua's own, from UNECE rec20. */
       'telecommunication_line_in_service': makeEUInformation("T0","","telecommunication line in service - A unit of count defining the number of lines in service."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code UB. displayName/description below are node-opcua's own, from UNECE rec20. */
       'telecommunication_line_in_service_average': makeEUInformation("UB","","telecommunication line in service average - A unit of count defining the average number of lines in service."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code UC. displayName/description below are node-opcua's own, from UNECE rec20. */
       'telecommunication_port': makeEUInformation("UC","","telecommunication port - A unit of count defining the number of network access ports."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code DAD. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ten_day': makeEUInformation("DAD","","ten day - A unit of time defining the number of days in multiples of 10."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code TP. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ten_pack': makeEUInformation("TP","","ten pack - A unit of count defining the number of items in multiples of 10."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code TPR. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ten_pair': makeEUInformation("TPR","","ten pair - A unit of count defining the number of pairs in multiples of 10 (pair: item described by twos)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code TST. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ten_set': makeEUInformation("TST","","ten set - A unit of count defining the number of sets in multiples of 10 (set: a number of objects grouped together)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code TTS. displayName/description below are node-opcua's own, from UNECE rec20. */
       'ten_thousand_sticks': makeEUInformation("TTS","","ten thousand sticks - A unit of count defining the number of sticks in multiples of 10000 (stick: slender and often cylindrical piece of a substance)."),
       'terabit': makeEUInformation("E83","Tbit","terabit"),
       'terabit_per_second': makeEUInformation("E84","Tbit/s","terabit per second"),
       'terabyte': makeEUInformation("E35","Tbyte","terabyte"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E53. displayName/description below are node-opcua's own, from UNECE rec20. */
       'test': makeEUInformation("E53","","test - A unit of count defining the number of tests."),
       'tex': makeEUInformation("D34","tex (g/km)","tex"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 24. displayName/description below are node-opcua's own, from UNECE rec20. */
       'theoretical_pound': makeEUInformation("24","","theoretical pound - A unit of mass defining the expected mass of material expressed as the number of pounds."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 27. displayName/description below are node-opcua's own, from UNECE rec20. */
       'theoretical_ton': makeEUInformation("27","","theoretical ton - A unit of mass defining the expected mass of material, expressed as the number of tons."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MIL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'thousand': makeEUInformation("MIL","","thousand (10³)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MBF. displayName/description below are node-opcua's own, from UNECE rec20. */
       'thousand_board_foot': makeEUInformation("MBF","","thousand board foot - A unit of volume equal to one thousand board foot."),
       'thousand_cubic_foot': makeEUInformation("FC","kft³","thousand cubic foot"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code R9. displayName/description below are node-opcua's own, from UNECE rec20. */
       'thousand_cubic_metre': makeEUInformation("R9","","thousand cubic metre - A unit of volume equal to one thousand cubic metres. (10³m³)"),
       'thousand_cubic_metre_per_day': makeEUInformation("TQD","km³/d","thousand cubic metre per day"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code T3. displayName/description below are node-opcua's own, from UNECE rec20. */
       'thousand_piece': makeEUInformation("T3","","thousand piece - A unit of count defining the number of pieces in multiples of 1000 (piece: a single item, article or exemplar)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code TI. displayName/description below are node-opcua's own, from UNECE rec20. */
       'thousand_square_inch': makeEUInformation("TI","","thousand square inch"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code MBE. displayName/description below are node-opcua's own, from UNECE rec20. */
       'thousand_standard_brick_equivalent': makeEUInformation("MBE","","thousand standard brick equivalent - A unit of count defining the number of one thousand brick equivalent units."),
       'tonne_kilometre': makeEUInformation("TKM","t·km","tonne kilometre"),
       'total_acid_number': makeEUInformation("TAN","TAN","total acid number"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code U1. displayName/description below are node-opcua's own, from UNECE rec20. */
       'treatment': makeEUInformation("U1","","treatment - A unit of count defining the number of treatments (treatment: subjection to the action of a chemical, physical or biological agent)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code TRL. displayName/description below are node-opcua's own, from UNECE rec20. */
       'trillion(EUR)': makeEUInformation("TRL","","trillion (EUR) (10¹⁸)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E54. displayName/description below are node-opcua's own, from UNECE rec20. */
       'trip': makeEUInformation("E54","","trip - A unit of count defining the number of trips."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code LBT. displayName/description below are node-opcua's own, from UNECE rec20. */
       'troy_pound(US)': makeEUInformation("LBT","","troy pound (US) (373,241 7 g)"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code 20. displayName/description below are node-opcua's own, from UNECE rec20. */
       'twenty_foot_container': makeEUInformation("20","","twenty foot container - A unit of count defining the number of shipping containers that measure 20 foot in length."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E23. displayName/description below are node-opcua's own, from UNECE rec20. */
       'tyre': makeEUInformation("E23","","tyre - A unit of count defining the number of tyres (a solid or air-filled covering placed around a wheel rim to form a soft contact with the road, absorb shock and provide traction)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E55. displayName/description below are node-opcua's own, from UNECE rec20. */
       'use': makeEUInformation("E55","","use - A unit of count defining the number of times an object is used."),
       'volt-ampere_per_kilogram': makeEUInformation("VA","V·A / kg","volt - ampere per kilogram"),
       'volt_AC': makeEUInformation("2G","V","volt AC"),
       'volt_DC': makeEUInformation("2H","V","volt DC"),
       'watt_per_kilogram': makeEUInformation("WA","W/kg","watt per kilogram"),
       'watt_square_metre': makeEUInformation("Q21","W·m²","watt square metre"),
       'weber_to_the_power_minus_one': makeEUInformation("Q23","1/Wb","weber to the power minus one"),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E56. displayName/description below are node-opcua's own, from UNECE rec20. */
       'well': makeEUInformation("E56","","well - A unit of count defining the number of wells."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code W2. displayName/description below are node-opcua's own, from UNECE rec20. */
       'wet_kilo': makeEUInformation("W2","","wet kilo - A unit of mass defining the number of kilograms of a product, including the water content of the product."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code WB. displayName/description below are node-opcua's own, from UNECE rec20. */
       'wet_pound': makeEUInformation("WB","","wet pound - A unit of mass defining the number of pounds of a material, including the water content of the material."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code WE. displayName/description below are node-opcua's own, from UNECE rec20. */
       'wet_ton': makeEUInformation("WE","","wet ton - A unit of mass defining the number of tons of a material, including the water content of the material."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code WG. displayName/description below are node-opcua's own, from UNECE rec20. */
       'wine_gallon': makeEUInformation("WG","","wine gallon - A unit of volume equal to 231 cubic inches."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E49. displayName/description below are node-opcua's own, from UNECE rec20. */
       'working_day': makeEUInformation("E49","","working day - A unit of count defining the number of working days (working day: a day on which work is ordinarily performed)."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code WM. displayName/description below are node-opcua's own, from UNECE rec20. */
       'working_month': makeEUInformation("WM","","working month - A unit of time defining the number of working months."),
       /** The OPC Foundation's UNECE_to_OPCUA table (and the CTT's Base Info Engineering Units 001/004) does not recognize Common Code E57. displayName/description below are node-opcua's own, from UNECE rec20. */
       'zone': makeEUInformation("E57","","zone - A unit of count defining the number of zones."),
}