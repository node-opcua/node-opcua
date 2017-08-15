// part 8
module.exports = {
    Range: require("./src/Range").Range,
    AxisInformation: require("./_generated_/_auto_generated_AxisInformation").AxisInformation,
    EUInformation: require("./src/EUInformation").EUInformation,

    AxisScale: require("./schemas/AxisScale_enum").AxisScale,


//
    standardUnits: require("./src/EUInformation").standardUnits,
    makeEUInformation:  require("./src/EUInformation").makeEUInformation,
    commonCodeToUInt: require("./src/EUInformation").commonCodeToUInt,
};