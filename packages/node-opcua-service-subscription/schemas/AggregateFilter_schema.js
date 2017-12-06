
/*
  <opc:StructuredType Name="AggregateFilter" BaseType="tns:MonitoringFilter">
    <opc:Field Name="StartTime" TypeName="opc:DateTime" />
    <opc:Field Name="AggregateType" TypeName="ua:NodeId" />
    <opc:Field Name="ProcessingInterval" TypeName="opc:Double" />
    <opc:Field Name="AggregateConfiguration" TypeName="tns:AggregateConfiguration" />
  </opc:StructuredType>
*/
var AggregateFilter_Schema = {
    name: "AggregateFilter",
    fields: [
        { name: "StartTime",          isArray: false, fieldType: "DateTime" },
        { name: "AggregateType",      isArray: false, fieldType: "NodeId" },
        { name: "ProcessingInterval", isArray: false, fieldType: "Double" },
        { name: "AggregateType",      isArray: false, fieldType: "AggregateConfiguration" },
    ]
};
exports.AggregateFilter_Schema = AggregateFilter_Schema;
