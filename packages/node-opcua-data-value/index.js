"use strict";
/**
 * @module opcua.data-value
 */
module.exports = {

    DataValue: require("./src/datavalue").DataValue,
    sameDataValue: require("./src/datavalue").sameDataValue,
    extractRange: require("./src/datavalue").extractRange,
    apply_timestamps: require("./src/datavalue").apply_timestamps,

    TimestampsToReturn: require("./schemas/TimestampsToReturn_enum").TimestampsToReturn
};