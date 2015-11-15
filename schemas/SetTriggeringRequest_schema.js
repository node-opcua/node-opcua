var SetTriggeringRequest_Schema = {
    name:"SetTriggeringRequest",
    fields:[
        { name:"requestHeader",                            fieldType:"RequestHeader",               documentation:"A standard header included in all requests sent to a server." },
        {name:"subscriptionId",            fieldType: "IntegerId"},
        {name:"triggeringItemId",          fieldType: "IntegerId"},
        {name:"linksToAdd",     isArray: true,fieldType: "IntegerId"},
        {name:"linksToRemove",  isArray: true,fieldType: "IntegerId"}
    ]
};
exports.SetTriggeringRequest_Schema = SetTriggeringRequest_Schema;

