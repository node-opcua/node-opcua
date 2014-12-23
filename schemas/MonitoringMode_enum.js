var factories = require("./../lib/misc/factories");
var MonitoringMode_Schema = {
    name: "MonitoringMode",
    enumValues: {
        Disabled: 0,
        Sampling: 1,
        Reporting: 2
    }
};
exports.MonitoringMode_Schema = MonitoringMode_Schema;
exports.MonitoringMode = factories.registerEnumeration(MonitoringMode_Schema);
