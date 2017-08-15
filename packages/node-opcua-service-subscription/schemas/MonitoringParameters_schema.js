var MonitoringParameters_Schema = {
    name: "MonitoringParameters",
    fields: [
        /*
         * Client-supplied id of the MonitoredItem. This id is used in Notifications generated
         * for the list Node.
         */

        { name: "clientHandle", fieldType: "IntegerId" },

        /*
         * - samplingInterval is the interval that defines the fastest rate at which the MonitoredItem(s) should be
         *   accessed and evaluated. This interval is defined in milliseconds.
         * - The value 0 indicates that the Server should use the fastest practical rate.
         * - The value -1 indicates that the default sampling interval defined by the publishing
         *   interval of the Subscription is requested.
         * - A different sampling interval is used if the publishing interval is not a supported sampling interval.
         * - Any negative number is interpreted as -1.
         * - The sampling interval is not changed if the publishing interval is
         *   changed by a subsequent call to the ModifySubscription Service.
         * - The Server uses this parameter to assign the MonitoredItems to a sampling interval
         *   that it supports.
         * - The assigned interval is provided in the revisedSamplingInterval parameter.
         * - The Server shall always return a revisedSamplingInterval that is equal or higher than
         *   the requested samplingInterval.
         * - If the requested samplingInterval is higher than the maximum sampling interval supported by the Server,
         *   the maximum sampling interval is returned.
         */
        { name: "samplingInterval", fieldType: "Duration" },
        /*
         * A filter used by the Server to determine if the MonitoredItem should generate a
         * Notification. If not used, this parameter is null. The MonitoringFilter parameter type
         * is an extensible parameter type specified in 7.16. It specifies the types of filters that
         * can be used.
         */
         { name: "filter", fieldType: "ExtensionObject" },

        /*
         * The requested size of the MonitoredItem queue.
         * The following values have special meaning for data monitored items:
         * Value    Meaning
         * 0 or 1   the server returns the default queue size which shall be 1 as
         *          revisedQueueSize for data monitored items. The queue has a
         *          single entry, effectively disabling queuing.
         *
         * For values larger than one a first-in-first-out queue is to be used. The Server may
         * limit the size in revisedQueueSize. In the case of a queue overflow, the Overflow bit
         * (flag) in the InfoBits portion of the DataValue statusCode is set in the new value.
         * The following values have special meaning for event monitored items:
         *
         * Value      Meaning
         * 0          the Server returns the default queue size for Event Notifications as
         *            revisedQueueSize for event monitored items.
         * 1          the Server returns the minimum queue size the Server requires for Event
         *            Notifications as revisedQueueSize.
         * MaxUInt32  the Server returns the maximum queue size that the Server
         *            can support for Event Notifications as revisedQueueSize.
         *
         * If a Client chooses a value between the minimum and maximum settings of the
         * Server the value shall be returned in the revisedQueueSize. If the requested
         * queueSize is outside the minimum or maximum, the Server shall return the
         * corresponding bounding value.
         * In the case of a queue overflow, an Event of the type
         * EventQueueOverflowEventType is generated.
         */
        { name: "queueSize", fieldType: "Counter" },
        /*
         * A boolean parameter that specifies the discard policy when the queue is full and a
         * new Notification is to be queued. It has the following values:
         *      TRUE     the oldest (first) Notification in the queue is discarded. The new
         *               Notification is added to the end of the queue.
         *      FALSE    the last Notification added to the queue gets replaced with the new
         *               Notification.
         */
        { name: "discardOldest", fieldType: "Boolean" }
    ]
};
exports.MonitoringParameters_Schema = MonitoringParameters_Schema;

