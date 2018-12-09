"use strict";
/**
 * @module services.endpoints
 */
module.exports = {

    ApplicationType: require("./schemas/ApplicationType_enum").ApplicationType,

    ApplicationDescription: require("./_generated_/_auto_generated_ApplicationDescription").ApplicationDescription,
    UserTokenPolicy: require("./_generated_/_auto_generated_UserTokenPolicy").UserTokenPolicy,
    EndpointDescription: require("./_generated_/_auto_generated_EndpointDescription").EndpointDescription,
    UserIdentityTokenType: require("./schemas/UserIdentityTokenType_enum").UserIdentityTokenType,

    GetEndpointsRequest: require("./_generated_/_auto_generated_GetEndpointsRequest").GetEndpointsRequest,
    GetEndpointsResponse: require("./_generated_/_auto_generated_GetEndpointsResponse").GetEndpointsResponse
};