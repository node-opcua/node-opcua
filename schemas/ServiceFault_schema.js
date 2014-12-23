
var ServiceFault_Schema = {
    documentation: "The response returned by all services when there is a service level error.",
    name: "ServiceFault",
    fields: [
        { name: "responseHeader", fieldType: "ResponseHeader"                  }
    ],
    construct_hook: function (options) {
        var breakpoint;
        return options;
    }

};
exports.ServiceFault_Schema =ServiceFault_Schema;