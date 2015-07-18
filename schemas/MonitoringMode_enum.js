"use strict";
require("requirish")._(module);
var factories = require("lib/misc/factories");

// OPCUA Spec 1.02 Part 4 page 5.12.1.3 Monitoring Mode:
// The monitoring mode parameter is used to enable and disable the sampling of a MonitoredItem, and also to provide
// for independently enabling and disabling the reporting of Notifications. This capability allows a MonitoredItem to
// be configured to sample, sample and report, or neither. Disabling sampling does not change the values of any of the
// other MonitoredItem parameter, such as its sampling interval.
// When a MonitoredItem is enabled (i.e. when the MonitoringMode is changed from DISABLED to SAMPLING or REPORTING)
// or it is created in the enabled state, the Server shall report the first sample as soon as possible and the time
// of this sample becomes the starting point for the next sampling interval.

var MonitoringMode_Schema = {
    name: "MonitoringMode",
    enumValues: {
        /*
         * DISABLED_0  The item being monitored is not sampled or evaluated, and Notifications are not generated or
         *              queued. Notification reporting is disabled.
         *
         */
        Disabled: 0,


        /*
         * SAMPLING_1  The item being monitored is sampled and evaluated, and Notifications are generated and
         *             queued. Notification reporting is disabled.
         */
        Sampling: 1,


        /*
         *  REPORTING_2  The item being monitored is sampled and evaluated, and Notifications are generated and
         *               queued. Notification reporting is enabled
         */
        Reporting: 2,



        Invalid: -1
    }
};
exports.MonitoringMode_Schema = MonitoringMode_Schema;
exports.MonitoringMode = factories.registerEnumeration(MonitoringMode_Schema);
