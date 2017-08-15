// see OPCUA V1.02 part 4 $7.19.4

// The StatusChangeNotification informs the client about a change in the status of a Subscription.
var StatusChangeNotification_Schema = {

    name:"StatusChangeNotification",
    fields: [
        {
          name: "statusCode", fieldType:"StatusCode", documentation:"The StatusCode that indicates the status change."
        },
        {
          name: "diagnosticInfo", fieldType:"DiagnosticInfo"
        }
    ]
};

exports.StatusChangeNotification_Schema = StatusChangeNotification_Schema;
