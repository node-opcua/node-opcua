/*<opc:StructuredType Name="SetMonitoringModeResponse" BaseType="ua:ExtensionObject">
 <opc:Field Name="ResponseHeader" TypeName="tns:ResponseHeader" />
 <opc:Field Name="NoOfResults" TypeName="opc:Int32" />
 <opc:Field Name="Results" TypeName="ua:StatusCode" LengthField="NoOfResults" />
 <opc:Field Name="NoOfDiagnosticInfos" TypeName="opc:Int32" />
 <opc:Field Name="DiagnosticInfos" TypeName="ua:DiagnosticInfo" LengthField="NoOfDiagnosticInfos" />
 </opc:StructuredType>
 */
var SetMonitoringModeResponse_Schema = {
    name: "SetMonitoringModeResponse",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader" },
        // List of StatusCodes for the MonitoredItems to enable/disable
        // The size and order of the list matches the size and order
        // of the monitoredItemIds request parameter.
        { name: "results", isArray: true, fieldType: "StatusCode"     },
        // List of diagnostic information for the MonitoredItems to enable/disable (see 7.8
        // for DiagnosticInfo definition). The size and order of the list matches the size and
        // order of the monitoredItemIds request parameter. This list is empty if diagnostic
        // information was not requested in the request header or if no diagnostic
        // information was encountered in processing of the request.
        { name: "diagnosticInfos", isArray: true, fieldType: "DiagnosticInfo" }
    ]
};
exports.SetMonitoringModeResponse_Schema = SetMonitoringModeResponse_Schema;

