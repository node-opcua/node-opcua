
const CancelRequest_Schema =  {
    documentation: "Cancels an outstanding request.",
    name: "CancelRequest",
    fields: [
        { name:"requestHeader",        fieldType:"RequestHeader",  documentation:"A standard header included in all requests sent to a server."}
    ]
};
export {CancelRequest_Schema};
