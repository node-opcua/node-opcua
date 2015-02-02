/*<opc:StructuredType Name="SetMonitoringModeRequest" BaseType="ua:ExtensionObject">
<opc:Field Name="RequestHeader" TypeName="tns:RequestHeader" />
<opc:Field Name="SubscriptionId" TypeName="opc:UInt32" />
<opc:Field Name="MonitoringMode" TypeName="tns:MonitoringMode" />
<opc:Field Name="NoOfMonitoredItemIds" TypeName="opc:Int32" />
<opc:Field Name="MonitoredItemIds" TypeName="opc:UInt32" LengthField="NoOfMonitoredItemIds" />
</opc:StructuredType>
*/

/*
 This Service is used to set the monitoring mode for one or more MonitoredItems of a Subscription.
 Setting the mode to DISABLED causes all queued Notifications to be deleted.

 */

var SetMonitoringModeRequest_Schema = {
    name: "SetMonitoringModeRequest",
    fields: [
        { name: "requestHeader", fieldType: "RequestHeader"  },
        // The Server-assigned identifier for the Subscription used to qualify the
        // monitoredItemIds.
        { name: "subscriptionId", fieldType: "IntegerId"  },
        // The monitoring mode to be set for the MonitoredItems. The MonitoringMode
        // enumeration is defined in 7.17.
        { name: "monitoringMode", fieldType: "MonitoringMode"  },
        // List of Server-assigned ids for the MonitoredItems.
        { name: "monitoredItemIds", isArray: true, fieldType: "IntegerId" }
    ]
};
exports.SetMonitoringModeRequest_Schema = SetMonitoringModeRequest_Schema;