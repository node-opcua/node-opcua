/**
 * @module node-opcua-status-codes
 */
// this file has been automatically generated
import { ConstantStatusCode, StatusCode } from "./opcua_status_code";
export class StatusCodes {
    /** The operation succeeded. */
    static Good: ConstantStatusCode = new ConstantStatusCode({ name: "Good", value: 0x0, description: "The operation succeeded." });
    /** The operation was uncertain. */
    static Uncertain: ConstantStatusCode = new ConstantStatusCode({
        name: "Uncertain",
        value: 0x40000000,
        description: "The operation was uncertain."
    });
    /** The operation failed. */
    static Bad: ConstantStatusCode = new ConstantStatusCode({
        name: "Bad",
        value: 0x80000000,
        description: "The operation failed."
    });
    /** An unexpected error occurred. */
    static BadUnexpectedError: ConstantStatusCode = new ConstantStatusCode({
        name: "BadUnexpectedError",
        value: 0x80010000,
        description: "An unexpected error occurred."
    });
    /** An internal error occurred as a result of a programming or configuration error. */
    static BadInternalError: ConstantStatusCode = new ConstantStatusCode({
        name: "BadInternalError",
        value: 0x80020000,
        description: "An internal error occurred as a result of a programming or configuration error."
    });
    /** Not enough memory to complete the operation. */
    static BadOutOfMemory: ConstantStatusCode = new ConstantStatusCode({
        name: "BadOutOfMemory",
        value: 0x80030000,
        description: "Not enough memory to complete the operation."
    });
    /** An operating system resource is not available. */
    static BadResourceUnavailable: ConstantStatusCode = new ConstantStatusCode({
        name: "BadResourceUnavailable",
        value: 0x80040000,
        description: "An operating system resource is not available."
    });
    /** A low level communication error occurred. */
    static BadCommunicationError: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCommunicationError",
        value: 0x80050000,
        description: "A low level communication error occurred."
    });
    /** Encoding halted because of invalid data in the objects being serialized. */
    static BadEncodingError: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEncodingError",
        value: 0x80060000,
        description: "Encoding halted because of invalid data in the objects being serialized."
    });
    /** Decoding halted because of invalid data in the stream. */
    static BadDecodingError: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDecodingError",
        value: 0x80070000,
        description: "Decoding halted because of invalid data in the stream."
    });
    /** The message encoding/decoding limits imposed by the stack have been exceeded. */
    static BadEncodingLimitsExceeded: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEncodingLimitsExceeded",
        value: 0x80080000,
        description: "The message encoding/decoding limits imposed by the stack have been exceeded."
    });
    /** The request message size exceeds limits set by the server. */
    static BadRequestTooLarge: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRequestTooLarge",
        value: 0x80b80000,
        description: "The request message size exceeds limits set by the server."
    });
    /** The response message size exceeds limits set by the client. */
    static BadResponseTooLarge: ConstantStatusCode = new ConstantStatusCode({
        name: "BadResponseTooLarge",
        value: 0x80b90000,
        description: "The response message size exceeds limits set by the client."
    });
    /** An unrecognized response was received from the server. */
    static BadUnknownResponse: ConstantStatusCode = new ConstantStatusCode({
        name: "BadUnknownResponse",
        value: 0x80090000,
        description: "An unrecognized response was received from the server."
    });
    /** The operation timed out. */
    static BadTimeout: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTimeout",
        value: 0x800a0000,
        description: "The operation timed out."
    });
    /** The server does not support the requested service. */
    static BadServiceUnsupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadServiceUnsupported",
        value: 0x800b0000,
        description: "The server does not support the requested service."
    });
    /** The operation was cancelled because the application is shutting down. */
    static BadShutdown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadShutdown",
        value: 0x800c0000,
        description: "The operation was cancelled because the application is shutting down."
    });
    /** The operation could not complete because the client is not connected to the server. */
    static BadServerNotConnected: ConstantStatusCode = new ConstantStatusCode({
        name: "BadServerNotConnected",
        value: 0x800d0000,
        description: "The operation could not complete because the client is not connected to the server."
    });
    /** The server has stopped and cannot process any requests. */
    static BadServerHalted: ConstantStatusCode = new ConstantStatusCode({
        name: "BadServerHalted",
        value: 0x800e0000,
        description: "The server has stopped and cannot process any requests."
    });
    /** No processing could be done because there was nothing to do. */
    static BadNothingToDo: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNothingToDo",
        value: 0x800f0000,
        description: "No processing could be done because there was nothing to do."
    });
    /** The request could not be processed because it specified too many operations. */
    static BadTooManyOperations: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTooManyOperations",
        value: 0x80100000,
        description: "The request could not be processed because it specified too many operations."
    });
    /** The request could not be processed because there are too many monitored items in the subscription. */
    static BadTooManyMonitoredItems: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTooManyMonitoredItems",
        value: 0x80db0000,
        description: "The request could not be processed because there are too many monitored items in the subscription."
    });
    /** The extension object cannot be (de)serialized because the data type id is not recognized. */
    static BadDataTypeIdUnknown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDataTypeIdUnknown",
        value: 0x80110000,
        description: "The extension object cannot be (de)serialized because the data type id is not recognized."
    });
    /** The certificate provided as a parameter is not valid. */
    static BadCertificateInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateInvalid",
        value: 0x80120000,
        description: "The certificate provided as a parameter is not valid."
    });
    /** An error occurred verifying security. */
    static BadSecurityChecksFailed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSecurityChecksFailed",
        value: 0x80130000,
        description: "An error occurred verifying security."
    });
    /** The certificate does not meet the requirements of the security policy. */
    static BadCertificatePolicyCheckFailed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificatePolicyCheckFailed",
        value: 0x81140000,
        description: "The certificate does not meet the requirements of the security policy."
    });
    /** The certificate has expired or is not yet valid. */
    static BadCertificateTimeInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateTimeInvalid",
        value: 0x80140000,
        description: "The certificate has expired or is not yet valid."
    });
    /** An issuer certificate has expired or is not yet valid. */
    static BadCertificateIssuerTimeInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateIssuerTimeInvalid",
        value: 0x80150000,
        description: "An issuer certificate has expired or is not yet valid."
    });
    /** The HostName used to connect to a server does not match a HostName in the certificate. */
    static BadCertificateHostNameInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateHostNameInvalid",
        value: 0x80160000,
        description: "The HostName used to connect to a server does not match a HostName in the certificate."
    });
    /** The URI specified in the ApplicationDescription does not match the URI in the certificate. */
    static BadCertificateUriInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateUriInvalid",
        value: 0x80170000,
        description: "The URI specified in the ApplicationDescription does not match the URI in the certificate."
    });
    /** The certificate may not be used for the requested operation. */
    static BadCertificateUseNotAllowed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateUseNotAllowed",
        value: 0x80180000,
        description: "The certificate may not be used for the requested operation."
    });
    /** The issuer certificate may not be used for the requested operation. */
    static BadCertificateIssuerUseNotAllowed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateIssuerUseNotAllowed",
        value: 0x80190000,
        description: "The issuer certificate may not be used for the requested operation."
    });
    /** The certificate is not trusted. */
    static BadCertificateUntrusted: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateUntrusted",
        value: 0x801a0000,
        description: "The certificate is not trusted."
    });
    /** It was not possible to determine if the certificate has been revoked. */
    static BadCertificateRevocationUnknown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateRevocationUnknown",
        value: 0x801b0000,
        description: "It was not possible to determine if the certificate has been revoked."
    });
    /** It was not possible to determine if the issuer certificate has been revoked. */
    static BadCertificateIssuerRevocationUnknown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateIssuerRevocationUnknown",
        value: 0x801c0000,
        description: "It was not possible to determine if the issuer certificate has been revoked."
    });
    /** The certificate has been revoked. */
    static BadCertificateRevoked: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateRevoked",
        value: 0x801d0000,
        description: "The certificate has been revoked."
    });
    /** The issuer certificate has been revoked. */
    static BadCertificateIssuerRevoked: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateIssuerRevoked",
        value: 0x801e0000,
        description: "The issuer certificate has been revoked."
    });
    /** The certificate chain is incomplete. */
    static BadCertificateChainIncomplete: ConstantStatusCode = new ConstantStatusCode({
        name: "BadCertificateChainIncomplete",
        value: 0x810d0000,
        description: "The certificate chain is incomplete."
    });
    /** User does not have permission to perform the requested operation. */
    static BadUserAccessDenied: ConstantStatusCode = new ConstantStatusCode({
        name: "BadUserAccessDenied",
        value: 0x801f0000,
        description: "User does not have permission to perform the requested operation."
    });
    /** The user identity token is not valid. */
    static BadIdentityTokenInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadIdentityTokenInvalid",
        value: 0x80200000,
        description: "The user identity token is not valid."
    });
    /** The user identity token is valid but the server has rejected it. */
    static BadIdentityTokenRejected: ConstantStatusCode = new ConstantStatusCode({
        name: "BadIdentityTokenRejected",
        value: 0x80210000,
        description: "The user identity token is valid but the server has rejected it."
    });
    /** The specified secure channel is no longer valid. */
    static BadSecureChannelIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSecureChannelIdInvalid",
        value: 0x80220000,
        description: "The specified secure channel is no longer valid."
    });
    /** The timestamp is outside the range allowed by the server. */
    static BadInvalidTimestamp: ConstantStatusCode = new ConstantStatusCode({
        name: "BadInvalidTimestamp",
        value: 0x80230000,
        description: "The timestamp is outside the range allowed by the server."
    });
    /** The nonce does appear to be not a random value or it is not the correct length. */
    static BadNonceInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNonceInvalid",
        value: 0x80240000,
        description: "The nonce does appear to be not a random value or it is not the correct length."
    });
    /** The session id is not valid. */
    static BadSessionIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSessionIdInvalid",
        value: 0x80250000,
        description: "The session id is not valid."
    });
    /** The session was closed by the client. */
    static BadSessionClosed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSessionClosed",
        value: 0x80260000,
        description: "The session was closed by the client."
    });
    /** The session cannot be used because ActivateSession has not been called. */
    static BadSessionNotActivated: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSessionNotActivated",
        value: 0x80270000,
        description: "The session cannot be used because ActivateSession has not been called."
    });
    /** The subscription id is not valid. */
    static BadSubscriptionIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSubscriptionIdInvalid",
        value: 0x80280000,
        description: "The subscription id is not valid."
    });
    /** The header for the request is missing or invalid. */
    static BadRequestHeaderInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRequestHeaderInvalid",
        value: 0x802a0000,
        description: "The header for the request is missing or invalid."
    });
    /** The timestamps to return parameter is invalid. */
    static BadTimestampsToReturnInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTimestampsToReturnInvalid",
        value: 0x802b0000,
        description: "The timestamps to return parameter is invalid."
    });
    /** The request was cancelled by the client. */
    static BadRequestCancelledByClient: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRequestCancelledByClient",
        value: 0x802c0000,
        description: "The request was cancelled by the client."
    });
    /** Too many arguments were provided. */
    static BadTooManyArguments: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTooManyArguments",
        value: 0x80e50000,
        description: "Too many arguments were provided."
    });
    /** The server requires a license to operate in general or to perform a service or operation, but existing license is expired. */
    static BadLicenseExpired: ConstantStatusCode = new ConstantStatusCode({
        name: "BadLicenseExpired",
        value: 0x810e0000,
        description:
            "The server requires a license to operate in general or to perform a service or operation, but existing license is expired."
    });
    /** The server has limits on number of allowed operations / objects, based on installed licenses, and these limits where exceeded. */
    static BadLicenseLimitsExceeded: ConstantStatusCode = new ConstantStatusCode({
        name: "BadLicenseLimitsExceeded",
        value: 0x810f0000,
        description:
            "The server has limits on number of allowed operations / objects, based on installed licenses, and these limits where exceeded."
    });
    /** The server does not have a license which is required to operate in general or to perform a service or operation. */
    static BadLicenseNotAvailable: ConstantStatusCode = new ConstantStatusCode({
        name: "BadLicenseNotAvailable",
        value: 0x81100000,
        description:
            "The server does not have a license which is required to operate in general or to perform a service or operation."
    });
    /** The subscription was transferred to another session. */
    static GoodSubscriptionTransferred: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodSubscriptionTransferred",
        value: 0x2d0000,
        description: "The subscription was transferred to another session."
    });
    /** The processing will complete asynchronously. */
    static GoodCompletesAsynchronously: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodCompletesAsynchronously",
        value: 0x2e0000,
        description: "The processing will complete asynchronously."
    });
    /** Sampling has slowed down due to resource limitations. */
    static GoodOverload: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodOverload",
        value: 0x2f0000,
        description: "Sampling has slowed down due to resource limitations."
    });
    /** The value written was accepted but was clamped. */
    static GoodClamped: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodClamped",
        value: 0x300000,
        description: "The value written was accepted but was clamped."
    });
    /** Communication with the data source is defined, but not established, and there is no last known value available. */
    static BadNoCommunication: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNoCommunication",
        value: 0x80310000,
        description:
            "Communication with the data source is defined, but not established, and there is no last known value available."
    });
    /** Waiting for the server to obtain values from the underlying data source. */
    static BadWaitingForInitialData: ConstantStatusCode = new ConstantStatusCode({
        name: "BadWaitingForInitialData",
        value: 0x80320000,
        description: "Waiting for the server to obtain values from the underlying data source."
    });
    /** The syntax of the node id is not valid. */
    static BadNodeIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNodeIdInvalid",
        value: 0x80330000,
        description: "The syntax of the node id is not valid."
    });
    /** The node id refers to a node that does not exist in the server address space. */
    static BadNodeIdUnknown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNodeIdUnknown",
        value: 0x80340000,
        description: "The node id refers to a node that does not exist in the server address space."
    });
    /** The attribute is not supported for the specified Node. */
    static BadAttributeIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadAttributeIdInvalid",
        value: 0x80350000,
        description: "The attribute is not supported for the specified Node."
    });
    /** The syntax of the index range parameter is invalid. */
    static BadIndexRangeInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadIndexRangeInvalid",
        value: 0x80360000,
        description: "The syntax of the index range parameter is invalid."
    });
    /** No data exists within the range of indexes specified. */
    static BadIndexRangeNoData: ConstantStatusCode = new ConstantStatusCode({
        name: "BadIndexRangeNoData",
        value: 0x80370000,
        description: "No data exists within the range of indexes specified."
    });
    /** The data encoding is invalid. */
    static BadDataEncodingInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDataEncodingInvalid",
        value: 0x80380000,
        description: "The data encoding is invalid."
    });
    /** The server does not support the requested data encoding for the node. */
    static BadDataEncodingUnsupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDataEncodingUnsupported",
        value: 0x80390000,
        description: "The server does not support the requested data encoding for the node."
    });
    /** The access level does not allow reading or subscribing to the Node. */
    static BadNotReadable: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNotReadable",
        value: 0x803a0000,
        description: "The access level does not allow reading or subscribing to the Node."
    });
    /** The access level does not allow writing to the Node. */
    static BadNotWritable: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNotWritable",
        value: 0x803b0000,
        description: "The access level does not allow writing to the Node."
    });
    /** The value was out of range. */
    static BadOutOfRange: ConstantStatusCode = new ConstantStatusCode({
        name: "BadOutOfRange",
        value: 0x803c0000,
        description: "The value was out of range."
    });
    /** The requested operation is not supported. */
    static BadNotSupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNotSupported",
        value: 0x803d0000,
        description: "The requested operation is not supported."
    });
    /** A requested item was not found or a search operation ended without success. */
    static BadNotFound: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNotFound",
        value: 0x803e0000,
        description: "A requested item was not found or a search operation ended without success."
    });
    /** The object cannot be used because it has been deleted. */
    static BadObjectDeleted: ConstantStatusCode = new ConstantStatusCode({
        name: "BadObjectDeleted",
        value: 0x803f0000,
        description: "The object cannot be used because it has been deleted."
    });
    /** Requested operation is not implemented. */
    static BadNotImplemented: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNotImplemented",
        value: 0x80400000,
        description: "Requested operation is not implemented."
    });
    /** The monitoring mode is invalid. */
    static BadMonitoringModeInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadMonitoringModeInvalid",
        value: 0x80410000,
        description: "The monitoring mode is invalid."
    });
    /** The monitoring item id does not refer to a valid monitored item. */
    static BadMonitoredItemIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadMonitoredItemIdInvalid",
        value: 0x80420000,
        description: "The monitoring item id does not refer to a valid monitored item."
    });
    /** The monitored item filter parameter is not valid. */
    static BadMonitoredItemFilterInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadMonitoredItemFilterInvalid",
        value: 0x80430000,
        description: "The monitored item filter parameter is not valid."
    });
    /** The server does not support the requested monitored item filter. */
    static BadMonitoredItemFilterUnsupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadMonitoredItemFilterUnsupported",
        value: 0x80440000,
        description: "The server does not support the requested monitored item filter."
    });
    /** A monitoring filter cannot be used in combination with the attribute specified. */
    static BadFilterNotAllowed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadFilterNotAllowed",
        value: 0x80450000,
        description: "A monitoring filter cannot be used in combination with the attribute specified."
    });
    /** A mandatory structured parameter was missing or null. */
    static BadStructureMissing: ConstantStatusCode = new ConstantStatusCode({
        name: "BadStructureMissing",
        value: 0x80460000,
        description: "A mandatory structured parameter was missing or null."
    });
    /** The event filter is not valid. */
    static BadEventFilterInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEventFilterInvalid",
        value: 0x80470000,
        description: "The event filter is not valid."
    });
    /** The content filter is not valid. */
    static BadContentFilterInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadContentFilterInvalid",
        value: 0x80480000,
        description: "The content filter is not valid."
    });
    /** An unrecognized operator was provided in a filter. */
    static BadFilterOperatorInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadFilterOperatorInvalid",
        value: 0x80c10000,
        description: "An unrecognized operator was provided in a filter."
    });
    /** A valid operator was provided, but the server does not provide support for this filter operator. */
    static BadFilterOperatorUnsupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadFilterOperatorUnsupported",
        value: 0x80c20000,
        description: "A valid operator was provided, but the server does not provide support for this filter operator."
    });
    /** The number of operands provided for the filter operator was less then expected for the operand provided. */
    static BadFilterOperandCountMismatch: ConstantStatusCode = new ConstantStatusCode({
        name: "BadFilterOperandCountMismatch",
        value: 0x80c30000,
        description: "The number of operands provided for the filter operator was less then expected for the operand provided."
    });
    /** The operand used in a content filter is not valid. */
    static BadFilterOperandInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadFilterOperandInvalid",
        value: 0x80490000,
        description: "The operand used in a content filter is not valid."
    });
    /** The referenced element is not a valid element in the content filter. */
    static BadFilterElementInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadFilterElementInvalid",
        value: 0x80c40000,
        description: "The referenced element is not a valid element in the content filter."
    });
    /** The referenced literal is not a valid value. */
    static BadFilterLiteralInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadFilterLiteralInvalid",
        value: 0x80c50000,
        description: "The referenced literal is not a valid value."
    });
    /** The continuation point provide is longer valid. */
    static BadContinuationPointInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadContinuationPointInvalid",
        value: 0x804a0000,
        description: "The continuation point provide is longer valid."
    });
    /** The operation could not be processed because all continuation points have been allocated. */
    static BadNoContinuationPoints: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNoContinuationPoints",
        value: 0x804b0000,
        description: "The operation could not be processed because all continuation points have been allocated."
    });
    /** The reference type id does not refer to a valid reference type node. */
    static BadReferenceTypeIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadReferenceTypeIdInvalid",
        value: 0x804c0000,
        description: "The reference type id does not refer to a valid reference type node."
    });
    /** The browse direction is not valid. */
    static BadBrowseDirectionInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadBrowseDirectionInvalid",
        value: 0x804d0000,
        description: "The browse direction is not valid."
    });
    /** The node is not part of the view. */
    static BadNodeNotInView: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNodeNotInView",
        value: 0x804e0000,
        description: "The node is not part of the view."
    });
    /** The number was not accepted because of a numeric overflow. */
    static BadNumericOverflow: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNumericOverflow",
        value: 0x81120000,
        description: "The number was not accepted because of a numeric overflow."
    });
    /** The ServerUri is not a valid URI. */
    static BadServerUriInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadServerUriInvalid",
        value: 0x804f0000,
        description: "The ServerUri is not a valid URI."
    });
    /** No ServerName was specified. */
    static BadServerNameMissing: ConstantStatusCode = new ConstantStatusCode({
        name: "BadServerNameMissing",
        value: 0x80500000,
        description: "No ServerName was specified."
    });
    /** No DiscoveryUrl was specified. */
    static BadDiscoveryUrlMissing: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDiscoveryUrlMissing",
        value: 0x80510000,
        description: "No DiscoveryUrl was specified."
    });
    /** The semaphore file specified by the client is not valid. */
    static BadSempahoreFileMissing: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSempahoreFileMissing",
        value: 0x80520000,
        description: "The semaphore file specified by the client is not valid."
    });
    /** The security token request type is not valid. */
    static BadRequestTypeInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRequestTypeInvalid",
        value: 0x80530000,
        description: "The security token request type is not valid."
    });
    /** The security mode does not meet the requirements set by the server. */
    static BadSecurityModeRejected: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSecurityModeRejected",
        value: 0x80540000,
        description: "The security mode does not meet the requirements set by the server."
    });
    /** The security policy does not meet the requirements set by the server. */
    static BadSecurityPolicyRejected: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSecurityPolicyRejected",
        value: 0x80550000,
        description: "The security policy does not meet the requirements set by the server."
    });
    /** The server has reached its maximum number of sessions. */
    static BadTooManySessions: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTooManySessions",
        value: 0x80560000,
        description: "The server has reached its maximum number of sessions."
    });
    /** The user token signature is missing or invalid. */
    static BadUserSignatureInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadUserSignatureInvalid",
        value: 0x80570000,
        description: "The user token signature is missing or invalid."
    });
    /** The signature generated with the client certificate is missing or invalid. */
    static BadApplicationSignatureInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadApplicationSignatureInvalid",
        value: 0x80580000,
        description: "The signature generated with the client certificate is missing or invalid."
    });
    /** The client did not provide at least one software certificate that is valid and meets the profile requirements for the server. */
    static BadNoValidCertificates: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNoValidCertificates",
        value: 0x80590000,
        description:
            "The client did not provide at least one software certificate that is valid and meets the profile requirements for the server."
    });
    /** The server does not support changing the user identity assigned to the session. */
    static BadIdentityChangeNotSupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadIdentityChangeNotSupported",
        value: 0x80c60000,
        description: "The server does not support changing the user identity assigned to the session."
    });
    /** The request was cancelled by the client with the Cancel service. */
    static BadRequestCancelledByRequest: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRequestCancelledByRequest",
        value: 0x805a0000,
        description: "The request was cancelled by the client with the Cancel service."
    });
    /** The parent node id does not to refer to a valid node. */
    static BadParentNodeIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadParentNodeIdInvalid",
        value: 0x805b0000,
        description: "The parent node id does not to refer to a valid node."
    });
    /** The reference could not be created because it violates constraints imposed by the data model. */
    static BadReferenceNotAllowed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadReferenceNotAllowed",
        value: 0x805c0000,
        description: "The reference could not be created because it violates constraints imposed by the data model."
    });
    /** The requested node id was reject because it was either invalid or server does not allow node ids to be specified by the client. */
    static BadNodeIdRejected: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNodeIdRejected",
        value: 0x805d0000,
        description:
            "The requested node id was reject because it was either invalid or server does not allow node ids to be specified by the client."
    });
    /** The requested node id is already used by another node. */
    static BadNodeIdExists: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNodeIdExists",
        value: 0x805e0000,
        description: "The requested node id is already used by another node."
    });
    /** The node class is not valid. */
    static BadNodeClassInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNodeClassInvalid",
        value: 0x805f0000,
        description: "The node class is not valid."
    });
    /** The browse name is invalid. */
    static BadBrowseNameInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadBrowseNameInvalid",
        value: 0x80600000,
        description: "The browse name is invalid."
    });
    /** The browse name is not unique among nodes that share the same relationship with the parent. */
    static BadBrowseNameDuplicated: ConstantStatusCode = new ConstantStatusCode({
        name: "BadBrowseNameDuplicated",
        value: 0x80610000,
        description: "The browse name is not unique among nodes that share the same relationship with the parent."
    });
    /** The node attributes are not valid for the node class. */
    static BadNodeAttributesInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNodeAttributesInvalid",
        value: 0x80620000,
        description: "The node attributes are not valid for the node class."
    });
    /** The type definition node id does not reference an appropriate type node. */
    static BadTypeDefinitionInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTypeDefinitionInvalid",
        value: 0x80630000,
        description: "The type definition node id does not reference an appropriate type node."
    });
    /** The source node id does not reference a valid node. */
    static BadSourceNodeIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSourceNodeIdInvalid",
        value: 0x80640000,
        description: "The source node id does not reference a valid node."
    });
    /** The target node id does not reference a valid node. */
    static BadTargetNodeIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTargetNodeIdInvalid",
        value: 0x80650000,
        description: "The target node id does not reference a valid node."
    });
    /** The reference type between the nodes is already defined. */
    static BadDuplicateReferenceNotAllowed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDuplicateReferenceNotAllowed",
        value: 0x80660000,
        description: "The reference type between the nodes is already defined."
    });
    /** The server does not allow this type of self reference on this node. */
    static BadInvalidSelfReference: ConstantStatusCode = new ConstantStatusCode({
        name: "BadInvalidSelfReference",
        value: 0x80670000,
        description: "The server does not allow this type of self reference on this node."
    });
    /** The reference type is not valid for a reference to a remote server. */
    static BadReferenceLocalOnly: ConstantStatusCode = new ConstantStatusCode({
        name: "BadReferenceLocalOnly",
        value: 0x80680000,
        description: "The reference type is not valid for a reference to a remote server."
    });
    /** The server will not allow the node to be deleted. */
    static BadNoDeleteRights: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNoDeleteRights",
        value: 0x80690000,
        description: "The server will not allow the node to be deleted."
    });
    /** The server was not able to delete all target references. */
    static UncertainReferenceNotDeleted: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainReferenceNotDeleted",
        value: 0x40bc0000,
        description: "The server was not able to delete all target references."
    });
    /** The server index is not valid. */
    static BadServerIndexInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadServerIndexInvalid",
        value: 0x806a0000,
        description: "The server index is not valid."
    });
    /** The view id does not refer to a valid view node. */
    static BadViewIdUnknown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadViewIdUnknown",
        value: 0x806b0000,
        description: "The view id does not refer to a valid view node."
    });
    /** The view timestamp is not available or not supported. */
    static BadViewTimestampInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadViewTimestampInvalid",
        value: 0x80c90000,
        description: "The view timestamp is not available or not supported."
    });
    /** The view parameters are not consistent with each other. */
    static BadViewParameterMismatch: ConstantStatusCode = new ConstantStatusCode({
        name: "BadViewParameterMismatch",
        value: 0x80ca0000,
        description: "The view parameters are not consistent with each other."
    });
    /** The view version is not available or not supported. */
    static BadViewVersionInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadViewVersionInvalid",
        value: 0x80cb0000,
        description: "The view version is not available or not supported."
    });
    /** The list of references may not be complete because the underlying system is not available. */
    static UncertainNotAllNodesAvailable: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainNotAllNodesAvailable",
        value: 0x40c00000,
        description: "The list of references may not be complete because the underlying system is not available."
    });
    /** The server should have followed a reference to a node in a remote server but did not. The result set may be incomplete. */
    static GoodResultsMayBeIncomplete: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodResultsMayBeIncomplete",
        value: 0xba0000,
        description:
            "The server should have followed a reference to a node in a remote server but did not. The result set may be incomplete."
    });
    /** The provided Nodeid was not a type definition nodeid. */
    static BadNotTypeDefinition: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNotTypeDefinition",
        value: 0x80c80000,
        description: "The provided Nodeid was not a type definition nodeid."
    });
    /** One of the references to follow in the relative path references to a node in the address space in another server. */
    static UncertainReferenceOutOfServer: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainReferenceOutOfServer",
        value: 0x406c0000,
        description:
            "One of the references to follow in the relative path references to a node in the address space in another server."
    });
    /** The requested operation has too many matches to return. */
    static BadTooManyMatches: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTooManyMatches",
        value: 0x806d0000,
        description: "The requested operation has too many matches to return."
    });
    /** The requested operation requires too many resources in the server. */
    static BadQueryTooComplex: ConstantStatusCode = new ConstantStatusCode({
        name: "BadQueryTooComplex",
        value: 0x806e0000,
        description: "The requested operation requires too many resources in the server."
    });
    /** The requested operation has no match to return. */
    static BadNoMatch: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNoMatch",
        value: 0x806f0000,
        description: "The requested operation has no match to return."
    });
    /** The max age parameter is invalid. */
    static BadMaxAgeInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadMaxAgeInvalid",
        value: 0x80700000,
        description: "The max age parameter is invalid."
    });
    /** The operation is not permitted over the current secure channel. */
    static BadSecurityModeInsufficient: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSecurityModeInsufficient",
        value: 0x80e60000,
        description: "The operation is not permitted over the current secure channel."
    });
    /** The history details parameter is not valid. */
    static BadHistoryOperationInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadHistoryOperationInvalid",
        value: 0x80710000,
        description: "The history details parameter is not valid."
    });
    /** The server does not support the requested operation. */
    static BadHistoryOperationUnsupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadHistoryOperationUnsupported",
        value: 0x80720000,
        description: "The server does not support the requested operation."
    });
    /** The defined timestamp to return was invalid. */
    static BadInvalidTimestampArgument: ConstantStatusCode = new ConstantStatusCode({
        name: "BadInvalidTimestampArgument",
        value: 0x80bd0000,
        description: "The defined timestamp to return was invalid."
    });
    /** The server does not support writing the combination of value, status and timestamps provided. */
    static BadWriteNotSupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadWriteNotSupported",
        value: 0x80730000,
        description: "The server does not support writing the combination of value, status and timestamps provided."
    });
    /** The value supplied for the attribute is not of the same type as the attribute's value. */
    static BadTypeMismatch: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTypeMismatch",
        value: 0x80740000,
        description: "The value supplied for the attribute is not of the same type as the attribute's value."
    });
    /** The method id does not refer to a method for the specified object. */
    static BadMethodInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadMethodInvalid",
        value: 0x80750000,
        description: "The method id does not refer to a method for the specified object."
    });
    /** The client did not specify all of the input arguments for the method. */
    static BadArgumentsMissing: ConstantStatusCode = new ConstantStatusCode({
        name: "BadArgumentsMissing",
        value: 0x80760000,
        description: "The client did not specify all of the input arguments for the method."
    });
    /** The executable attribute does not allow the execution of the method. */
    static BadNotExecutable: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNotExecutable",
        value: 0x81110000,
        description: "The executable attribute does not allow the execution of the method."
    });
    /** The server has reached its maximum number of subscriptions. */
    static BadTooManySubscriptions: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTooManySubscriptions",
        value: 0x80770000,
        description: "The server has reached its maximum number of subscriptions."
    });
    /** The server has reached the maximum number of queued publish requests. */
    static BadTooManyPublishRequests: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTooManyPublishRequests",
        value: 0x80780000,
        description: "The server has reached the maximum number of queued publish requests."
    });
    /** There is no subscription available for this session. */
    static BadNoSubscription: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNoSubscription",
        value: 0x80790000,
        description: "There is no subscription available for this session."
    });
    /** The sequence number is unknown to the server. */
    static BadSequenceNumberUnknown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSequenceNumberUnknown",
        value: 0x807a0000,
        description: "The sequence number is unknown to the server."
    });
    /** The Server does not support retransmission queue and acknowledgement of sequence numbers is not available. */
    static GoodRetransmissionQueueNotSupported: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodRetransmissionQueueNotSupported",
        value: 0xdf0000,
        description: "The Server does not support retransmission queue and acknowledgement of sequence numbers is not available."
    });
    /** The requested notification message is no longer available. */
    static BadMessageNotAvailable: ConstantStatusCode = new ConstantStatusCode({
        name: "BadMessageNotAvailable",
        value: 0x807b0000,
        description: "The requested notification message is no longer available."
    });
    /** The client of the current session does not support one or more Profiles that are necessary for the subscription. */
    static BadInsufficientClientProfile: ConstantStatusCode = new ConstantStatusCode({
        name: "BadInsufficientClientProfile",
        value: 0x807c0000,
        description:
            "The client of the current session does not support one or more Profiles that are necessary for the subscription."
    });
    /** The sub-state machine is not currently active. */
    static BadStateNotActive: ConstantStatusCode = new ConstantStatusCode({
        name: "BadStateNotActive",
        value: 0x80bf0000,
        description: "The sub-state machine is not currently active."
    });
    /** An equivalent rule already exists. */
    static BadAlreadyExists: ConstantStatusCode = new ConstantStatusCode({
        name: "BadAlreadyExists",
        value: 0x81150000,
        description: "An equivalent rule already exists."
    });
    /** The server cannot process the request because it is too busy. */
    static BadTcpServerTooBusy: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTcpServerTooBusy",
        value: 0x807d0000,
        description: "The server cannot process the request because it is too busy."
    });
    /** The type of the message specified in the header invalid. */
    static BadTcpMessageTypeInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTcpMessageTypeInvalid",
        value: 0x807e0000,
        description: "The type of the message specified in the header invalid."
    });
    /** The SecureChannelId and/or TokenId are not currently in use. */
    static BadTcpSecureChannelUnknown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTcpSecureChannelUnknown",
        value: 0x807f0000,
        description: "The SecureChannelId and/or TokenId are not currently in use."
    });
    /** The size of the message chunk specified in the header is too large. */
    static BadTcpMessageTooLarge: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTcpMessageTooLarge",
        value: 0x80800000,
        description: "The size of the message chunk specified in the header is too large."
    });
    /** There are not enough resources to process the request. */
    static BadTcpNotEnoughResources: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTcpNotEnoughResources",
        value: 0x80810000,
        description: "There are not enough resources to process the request."
    });
    /** An internal error occurred. */
    static BadTcpInternalError: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTcpInternalError",
        value: 0x80820000,
        description: "An internal error occurred."
    });
    /** The server does not recognize the QueryString specified. */
    static BadTcpEndpointUrlInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTcpEndpointUrlInvalid",
        value: 0x80830000,
        description: "The server does not recognize the QueryString specified."
    });
    /** The request could not be sent because of a network interruption. */
    static BadRequestInterrupted: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRequestInterrupted",
        value: 0x80840000,
        description: "The request could not be sent because of a network interruption."
    });
    /** Timeout occurred while processing the request. */
    static BadRequestTimeout: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRequestTimeout",
        value: 0x80850000,
        description: "Timeout occurred while processing the request."
    });
    /** The secure channel has been closed. */
    static BadSecureChannelClosed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSecureChannelClosed",
        value: 0x80860000,
        description: "The secure channel has been closed."
    });
    /** The token has expired or is not recognized. */
    static BadSecureChannelTokenUnknown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSecureChannelTokenUnknown",
        value: 0x80870000,
        description: "The token has expired or is not recognized."
    });
    /** The sequence number is not valid. */
    static BadSequenceNumberInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSequenceNumberInvalid",
        value: 0x80880000,
        description: "The sequence number is not valid."
    });
    /** The applications do not have compatible protocol versions. */
    static BadProtocolVersionUnsupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadProtocolVersionUnsupported",
        value: 0x80be0000,
        description: "The applications do not have compatible protocol versions."
    });
    /** There is a problem with the configuration that affects the usefulness of the value. */
    static BadConfigurationError: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConfigurationError",
        value: 0x80890000,
        description: "There is a problem with the configuration that affects the usefulness of the value."
    });
    /** The variable should receive its value from another variable, but has never been configured to do so. */
    static BadNotConnected: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNotConnected",
        value: 0x808a0000,
        description: "The variable should receive its value from another variable, but has never been configured to do so."
    });
    /** There has been a failure in the device/data source that generates the value that has affected the value. */
    static BadDeviceFailure: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDeviceFailure",
        value: 0x808b0000,
        description: "There has been a failure in the device/data source that generates the value that has affected the value."
    });
    /** There has been a failure in the sensor from which the value is derived by the device/data source. */
    static BadSensorFailure: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSensorFailure",
        value: 0x808c0000,
        description: "There has been a failure in the sensor from which the value is derived by the device/data source."
    });
    /** The source of the data is not operational. */
    static BadOutOfService: ConstantStatusCode = new ConstantStatusCode({
        name: "BadOutOfService",
        value: 0x808d0000,
        description: "The source of the data is not operational."
    });
    /** The deadband filter is not valid. */
    static BadDeadbandFilterInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDeadbandFilterInvalid",
        value: 0x808e0000,
        description: "The deadband filter is not valid."
    });
    /** Communication to the data source has failed. The variable value is the last value that had a good quality. */
    static UncertainNoCommunicationLastUsableValue: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainNoCommunicationLastUsableValue",
        value: 0x408f0000,
        description: "Communication to the data source has failed. The variable value is the last value that had a good quality."
    });
    /** Whatever was updating this value has stopped doing so. */
    static UncertainLastUsableValue: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainLastUsableValue",
        value: 0x40900000,
        description: "Whatever was updating this value has stopped doing so."
    });
    /** The value is an operational value that was manually overwritten. */
    static UncertainSubstituteValue: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainSubstituteValue",
        value: 0x40910000,
        description: "The value is an operational value that was manually overwritten."
    });
    /** The value is an initial value for a variable that normally receives its value from another variable. */
    static UncertainInitialValue: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainInitialValue",
        value: 0x40920000,
        description: "The value is an initial value for a variable that normally receives its value from another variable."
    });
    /** The value is at one of the sensor limits. */
    static UncertainSensorNotAccurate: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainSensorNotAccurate",
        value: 0x40930000,
        description: "The value is at one of the sensor limits."
    });
    /** The value is outside of the range of values defined for this parameter. */
    static UncertainEngineeringUnitsExceeded: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainEngineeringUnitsExceeded",
        value: 0x40940000,
        description: "The value is outside of the range of values defined for this parameter."
    });
    /** The value is derived from multiple sources and has less than the required number of Good sources. */
    static UncertainSubNormal: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainSubNormal",
        value: 0x40950000,
        description: "The value is derived from multiple sources and has less than the required number of Good sources."
    });
    /** The value has been overridden. */
    static GoodLocalOverride: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodLocalOverride",
        value: 0x960000,
        description: "The value has been overridden."
    });
    /** This Condition refresh failed, a Condition refresh operation is already in progress. */
    static BadRefreshInProgress: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRefreshInProgress",
        value: 0x80970000,
        description: "This Condition refresh failed, a Condition refresh operation is already in progress."
    });
    /** This condition has already been disabled. */
    static BadConditionAlreadyDisabled: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConditionAlreadyDisabled",
        value: 0x80980000,
        description: "This condition has already been disabled."
    });
    /** This condition has already been enabled. */
    static BadConditionAlreadyEnabled: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConditionAlreadyEnabled",
        value: 0x80cc0000,
        description: "This condition has already been enabled."
    });
    /** Property not available, this condition is disabled. */
    static BadConditionDisabled: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConditionDisabled",
        value: 0x80990000,
        description: "Property not available, this condition is disabled."
    });
    /** The specified event id is not recognized. */
    static BadEventIdUnknown: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEventIdUnknown",
        value: 0x809a0000,
        description: "The specified event id is not recognized."
    });
    /** The event cannot be acknowledged. */
    static BadEventNotAcknowledgeable: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEventNotAcknowledgeable",
        value: 0x80bb0000,
        description: "The event cannot be acknowledged."
    });
    /** The dialog condition is not active. */
    static BadDialogNotActive: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDialogNotActive",
        value: 0x80cd0000,
        description: "The dialog condition is not active."
    });
    /** The response is not valid for the dialog. */
    static BadDialogResponseInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDialogResponseInvalid",
        value: 0x80ce0000,
        description: "The response is not valid for the dialog."
    });
    /** The condition branch has already been acknowledged. */
    static BadConditionBranchAlreadyAcked: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConditionBranchAlreadyAcked",
        value: 0x80cf0000,
        description: "The condition branch has already been acknowledged."
    });
    /** The condition branch has already been confirmed. */
    static BadConditionBranchAlreadyConfirmed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConditionBranchAlreadyConfirmed",
        value: 0x80d00000,
        description: "The condition branch has already been confirmed."
    });
    /** The condition has already been shelved. */
    static BadConditionAlreadyShelved: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConditionAlreadyShelved",
        value: 0x80d10000,
        description: "The condition has already been shelved."
    });
    /** The condition is not currently shelved. */
    static BadConditionNotShelved: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConditionNotShelved",
        value: 0x80d20000,
        description: "The condition is not currently shelved."
    });
    /** The shelving time not within an acceptable range. */
    static BadShelvingTimeOutOfRange: ConstantStatusCode = new ConstantStatusCode({
        name: "BadShelvingTimeOutOfRange",
        value: 0x80d30000,
        description: "The shelving time not within an acceptable range."
    });
    /** No data exists for the requested time range or event filter. */
    static BadNoData: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNoData",
        value: 0x809b0000,
        description: "No data exists for the requested time range or event filter."
    });
    /** No data found to provide upper or lower bound value. */
    static BadBoundNotFound: ConstantStatusCode = new ConstantStatusCode({
        name: "BadBoundNotFound",
        value: 0x80d70000,
        description: "No data found to provide upper or lower bound value."
    });
    /** The server cannot retrieve a bound for the variable. */
    static BadBoundNotSupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadBoundNotSupported",
        value: 0x80d80000,
        description: "The server cannot retrieve a bound for the variable."
    });
    /** Data is missing due to collection started/stopped/lost. */
    static BadDataLost: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDataLost",
        value: 0x809d0000,
        description: "Data is missing due to collection started/stopped/lost."
    });
    /** Expected data is unavailable for the requested time range due to an un-mounted volume, an off-line archive or tape, or similar reason for temporary unavailability. */
    static BadDataUnavailable: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDataUnavailable",
        value: 0x809e0000,
        description:
            "Expected data is unavailable for the requested time range due to an un-mounted volume, an off-line archive or tape, or similar reason for temporary unavailability."
    });
    /** The data or event was not successfully inserted because a matching entry exists. */
    static BadEntryExists: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEntryExists",
        value: 0x809f0000,
        description: "The data or event was not successfully inserted because a matching entry exists."
    });
    /** The data or event was not successfully updated because no matching entry exists. */
    static BadNoEntryExists: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNoEntryExists",
        value: 0x80a00000,
        description: "The data or event was not successfully updated because no matching entry exists."
    });
    /** The client requested history using a timestamp format the server does not support (i.e requested ServerTimestamp when server only supports SourceTimestamp). */
    static BadTimestampNotSupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTimestampNotSupported",
        value: 0x80a10000,
        description:
            "The client requested history using a timestamp format the server does not support (i.e requested ServerTimestamp when server only supports SourceTimestamp)."
    });
    /** The data or event was successfully inserted into the historical database. */
    static GoodEntryInserted: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodEntryInserted",
        value: 0xa20000,
        description: "The data or event was successfully inserted into the historical database."
    });
    /** The data or event field was successfully replaced in the historical database. */
    static GoodEntryReplaced: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodEntryReplaced",
        value: 0xa30000,
        description: "The data or event field was successfully replaced in the historical database."
    });
    /** The value is derived from multiple values and has less than the required number of Good values. */
    static UncertainDataSubNormal: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainDataSubNormal",
        value: 0x40a40000,
        description: "The value is derived from multiple values and has less than the required number of Good values."
    });
    /** No data exists for the requested time range or event filter. */
    static GoodNoData: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodNoData",
        value: 0xa50000,
        description: "No data exists for the requested time range or event filter."
    });
    /** The data or event field was successfully replaced in the historical database. */
    static GoodMoreData: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodMoreData",
        value: 0xa60000,
        description: "The data or event field was successfully replaced in the historical database."
    });
    /** The requested number of Aggregates does not match the requested number of NodeIds. */
    static BadAggregateListMismatch: ConstantStatusCode = new ConstantStatusCode({
        name: "BadAggregateListMismatch",
        value: 0x80d40000,
        description: "The requested number of Aggregates does not match the requested number of NodeIds."
    });
    /** The requested Aggregate is not support by the server. */
    static BadAggregateNotSupported: ConstantStatusCode = new ConstantStatusCode({
        name: "BadAggregateNotSupported",
        value: 0x80d50000,
        description: "The requested Aggregate is not support by the server."
    });
    /** The aggregate value could not be derived due to invalid data inputs. */
    static BadAggregateInvalidInputs: ConstantStatusCode = new ConstantStatusCode({
        name: "BadAggregateInvalidInputs",
        value: 0x80d60000,
        description: "The aggregate value could not be derived due to invalid data inputs."
    });
    /** The aggregate configuration is not valid for specified node. */
    static BadAggregateConfigurationRejected: ConstantStatusCode = new ConstantStatusCode({
        name: "BadAggregateConfigurationRejected",
        value: 0x80da0000,
        description: "The aggregate configuration is not valid for specified node."
    });
    /** The request specifies fields which are not valid for the EventType or cannot be saved by the historian. */
    static GoodDataIgnored: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodDataIgnored",
        value: 0xd90000,
        description: "The request specifies fields which are not valid for the EventType or cannot be saved by the historian."
    });
    /** The request was rejected by the server because it did not meet the criteria set by the server. */
    static BadRequestNotAllowed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRequestNotAllowed",
        value: 0x80e40000,
        description: "The request was rejected by the server because it did not meet the criteria set by the server."
    });
    /** The request has not been processed by the server yet. */
    static BadRequestNotComplete: ConstantStatusCode = new ConstantStatusCode({
        name: "BadRequestNotComplete",
        value: 0x81130000,
        description: "The request has not been processed by the server yet."
    });
    /** The device identity needs a ticket before it can be accepted. */
    static BadTicketRequired: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTicketRequired",
        value: 0x811f0000,
        description: "The device identity needs a ticket before it can be accepted."
    });
    /** The device identity needs a ticket before it can be accepted. */
    static BadTicketInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadTicketInvalid",
        value: 0x81200000,
        description: "The device identity needs a ticket before it can be accepted."
    });
    /** The value does not come from the real source and has been edited by the server. */
    static GoodEdited: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodEdited",
        value: 0xdc0000,
        description: "The value does not come from the real source and has been edited by the server."
    });
    /** There was an error in execution of these post-actions. */
    static GoodPostActionFailed: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodPostActionFailed",
        value: 0xdd0000,
        description: "There was an error in execution of these post-actions."
    });
    /** The related EngineeringUnit has been changed but the Variable Value is still provided based on the previous unit. */
    static UncertainDominantValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainDominantValueChanged",
        value: 0x40de0000,
        description:
            "The related EngineeringUnit has been changed but the Variable Value is still provided based on the previous unit."
    });
    /** A dependent value has been changed but the change has not been applied to the device. */
    static GoodDependentValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodDependentValueChanged",
        value: 0xe00000,
        description: "A dependent value has been changed but the change has not been applied to the device."
    });
    /** The related EngineeringUnit has been changed but this change has not been applied to the device. The Variable Value is still dependent on the previous unit but its status is currently Bad. */
    static BadDominantValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDominantValueChanged",
        value: 0x80e10000,
        description:
            "The related EngineeringUnit has been changed but this change has not been applied to the device. The Variable Value is still dependent on the previous unit but its status is currently Bad."
    });
    /** A dependent value has been changed but the change has not been applied to the device. The quality of the dominant variable is uncertain. */
    static UncertainDependentValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainDependentValueChanged",
        value: 0x40e20000,
        description:
            "A dependent value has been changed but the change has not been applied to the device. The quality of the dominant variable is uncertain."
    });
    /** A dependent value has been changed but the change has not been applied to the device. The quality of the dominant variable is Bad. */
    static BadDependentValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDependentValueChanged",
        value: 0x80e30000,
        description:
            "A dependent value has been changed but the change has not been applied to the device. The quality of the dominant variable is Bad."
    });
    /** It is delivered with a dominant Variable value when a dependent Variable has changed but the change has not been applied. */
    static GoodEdited_DependentValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodEdited_DependentValueChanged",
        value: 0x1160000,
        description:
            "It is delivered with a dominant Variable value when a dependent Variable has changed but the change has not been applied."
    });
    /** It is delivered with a dependent Variable value when a dominant Variable has changed but the change has not been applied. */
    static GoodEdited_DominantValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodEdited_DominantValueChanged",
        value: 0x1170000,
        description:
            "It is delivered with a dependent Variable value when a dominant Variable has changed but the change has not been applied."
    });
    /** It is delivered with a dependent Variable value when a dominant or dependent Variable has changed but change has not been applied. */
    static GoodEdited_DominantValueChanged_DependentValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodEdited_DominantValueChanged_DependentValueChanged",
        value: 0x1180000,
        description:
            "It is delivered with a dependent Variable value when a dominant or dependent Variable has changed but change has not been applied."
    });
    /** It is delivered with a Variable value when Variable has changed but the value is not legal. */
    static BadEdited_OutOfRange: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEdited_OutOfRange",
        value: 0x81190000,
        description: "It is delivered with a Variable value when Variable has changed but the value is not legal."
    });
    /** It is delivered with a Variable value when a source Variable has changed but the value is not legal. */
    static BadInitialValue_OutOfRange: ConstantStatusCode = new ConstantStatusCode({
        name: "BadInitialValue_OutOfRange",
        value: 0x811a0000,
        description: "It is delivered with a Variable value when a source Variable has changed but the value is not legal."
    });
    /** It is delivered with a dependent Variable value when a dominant Variable has changed and the value is not legal. */
    static BadOutOfRange_DominantValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "BadOutOfRange_DominantValueChanged",
        value: 0x811b0000,
        description:
            "It is delivered with a dependent Variable value when a dominant Variable has changed and the value is not legal."
    });
    /** It is delivered with a dependent Variable value when a dominant Variable has changed, the value is not legal and the change has not been applied. */
    static BadEdited_OutOfRange_DominantValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEdited_OutOfRange_DominantValueChanged",
        value: 0x811c0000,
        description:
            "It is delivered with a dependent Variable value when a dominant Variable has changed, the value is not legal and the change has not been applied."
    });
    /** It is delivered with a dependent Variable value when a dominant or dependent Variable has changed and the value is not legal. */
    static BadOutOfRange_DominantValueChanged_DependentValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "BadOutOfRange_DominantValueChanged_DependentValueChanged",
        value: 0x811d0000,
        description:
            "It is delivered with a dependent Variable value when a dominant or dependent Variable has changed and the value is not legal."
    });
    /** It is delivered with a dependent Variable value when a dominant or dependent Variable has changed, the value is not legal and the change has not been applied. */
    static BadEdited_OutOfRange_DominantValueChanged_DependentValueChanged: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEdited_OutOfRange_DominantValueChanged_DependentValueChanged",
        value: 0x811e0000,
        description:
            "It is delivered with a dependent Variable value when a dominant or dependent Variable has changed, the value is not legal and the change has not been applied."
    });
    /** The communication layer has raised an event. */
    static GoodCommunicationEvent: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodCommunicationEvent",
        value: 0xa70000,
        description: "The communication layer has raised an event."
    });
    /** The system is shutting down. */
    static GoodShutdownEvent: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodShutdownEvent",
        value: 0xa80000,
        description: "The system is shutting down."
    });
    /** The operation is not finished and needs to be called again. */
    static GoodCallAgain: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodCallAgain",
        value: 0xa90000,
        description: "The operation is not finished and needs to be called again."
    });
    /** A non-critical timeout occurred. */
    static GoodNonCriticalTimeout: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodNonCriticalTimeout",
        value: 0xaa0000,
        description: "A non-critical timeout occurred."
    });
    /** One or more arguments are invalid. */
    static BadInvalidArgument: ConstantStatusCode = new ConstantStatusCode({
        name: "BadInvalidArgument",
        value: 0x80ab0000,
        description: "One or more arguments are invalid."
    });
    /** Could not establish a network connection to remote server. */
    static BadConnectionRejected: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConnectionRejected",
        value: 0x80ac0000,
        description: "Could not establish a network connection to remote server."
    });
    /** The server has disconnected from the client. */
    static BadDisconnect: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDisconnect",
        value: 0x80ad0000,
        description: "The server has disconnected from the client."
    });
    /** The network connection has been closed. */
    static BadConnectionClosed: ConstantStatusCode = new ConstantStatusCode({
        name: "BadConnectionClosed",
        value: 0x80ae0000,
        description: "The network connection has been closed."
    });
    /** The operation cannot be completed because the object is closed, uninitialized or in some other invalid state. */
    static BadInvalidState: ConstantStatusCode = new ConstantStatusCode({
        name: "BadInvalidState",
        value: 0x80af0000,
        description: "The operation cannot be completed because the object is closed, uninitialized or in some other invalid state."
    });
    /** Cannot move beyond end of the stream. */
    static BadEndOfStream: ConstantStatusCode = new ConstantStatusCode({
        name: "BadEndOfStream",
        value: 0x80b00000,
        description: "Cannot move beyond end of the stream."
    });
    /** No data is currently available for reading from a non-blocking stream. */
    static BadNoDataAvailable: ConstantStatusCode = new ConstantStatusCode({
        name: "BadNoDataAvailable",
        value: 0x80b10000,
        description: "No data is currently available for reading from a non-blocking stream."
    });
    /** The asynchronous operation is waiting for a response. */
    static BadWaitingForResponse: ConstantStatusCode = new ConstantStatusCode({
        name: "BadWaitingForResponse",
        value: 0x80b20000,
        description: "The asynchronous operation is waiting for a response."
    });
    /** The asynchronous operation was abandoned by the caller. */
    static BadOperationAbandoned: ConstantStatusCode = new ConstantStatusCode({
        name: "BadOperationAbandoned",
        value: 0x80b30000,
        description: "The asynchronous operation was abandoned by the caller."
    });
    /** The stream did not return all data requested (possibly because it is a non-blocking stream). */
    static BadExpectedStreamToBlock: ConstantStatusCode = new ConstantStatusCode({
        name: "BadExpectedStreamToBlock",
        value: 0x80b40000,
        description: "The stream did not return all data requested (possibly because it is a non-blocking stream)."
    });
    /** Non blocking behaviour is required and the operation would block. */
    static BadWouldBlock: ConstantStatusCode = new ConstantStatusCode({
        name: "BadWouldBlock",
        value: 0x80b50000,
        description: "Non blocking behaviour is required and the operation would block."
    });
    /** A value had an invalid syntax. */
    static BadSyntaxError: ConstantStatusCode = new ConstantStatusCode({
        name: "BadSyntaxError",
        value: 0x80b60000,
        description: "A value had an invalid syntax."
    });
    /** The operation could not be finished because all available connections are in use. */
    static BadMaxConnectionsReached: ConstantStatusCode = new ConstantStatusCode({
        name: "BadMaxConnectionsReached",
        value: 0x80b70000,
        description: "The operation could not be finished because all available connections are in use."
    });
    /** The value may not be accurate because the transducer is in manual mode. */
    static UncertainTransducerInManual: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainTransducerInManual",
        value: 0x42080000,
        description: "The value may not be accurate because the transducer is in manual mode."
    });
    /** The value is simulated. */
    static UncertainSimulatedValue: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainSimulatedValue",
        value: 0x42090000,
        description: "The value is simulated."
    });
    /** The value may not be accurate due to a sensor calibration fault. */
    static UncertainSensorCalibration: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainSensorCalibration",
        value: 0x420a0000,
        description: "The value may not be accurate due to a sensor calibration fault."
    });
    /** The value may not be accurate due to a configuration issue. */
    static UncertainConfigurationError: ConstantStatusCode = new ConstantStatusCode({
        name: "UncertainConfigurationError",
        value: 0x420f0000,
        description: "The value may not be accurate due to a configuration issue."
    });
    /** The value source supports cascade handshaking and the value has been Initialized based on an initialization request from a cascade secondary. */
    static GoodCascadeInitializationAcknowledged: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodCascadeInitializationAcknowledged",
        value: 0x4010000,
        description:
            "The value source supports cascade handshaking and the value has been Initialized based on an initialization request from a cascade secondary."
    });
    /** The value source supports cascade handshaking and is requesting initialization of a cascade primary. */
    static GoodCascadeInitializationRequest: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodCascadeInitializationRequest",
        value: 0x4020000,
        description: "The value source supports cascade handshaking and is requesting initialization of a cascade primary."
    });
    /** The value source supports cascade handshaking, however, the source’s current state does not allow for cascade. */
    static GoodCascadeNotInvited: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodCascadeNotInvited",
        value: 0x4030000,
        description:
            "The value source supports cascade handshaking, however, the source’s current state does not allow for cascade."
    });
    /** The value source supports cascade handshaking, however, the source has not selected the corresponding cascade primary for use. */
    static GoodCascadeNotSelected: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodCascadeNotSelected",
        value: 0x4040000,
        description:
            "The value source supports cascade handshaking, however, the source has not selected the corresponding cascade primary for use."
    });
    /** There is a fault state condition active in the value source. */
    static GoodFaultStateActive: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodFaultStateActive",
        value: 0x4070000,
        description: "There is a fault state condition active in the value source."
    });
    /** A fault state condition is being requested of the destination. */
    static GoodInitiateFaultState: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodInitiateFaultState",
        value: 0x4080000,
        description: "A fault state condition is being requested of the destination."
    });
    /** The value is accurate, and the signal source supports cascade handshaking. */
    static GoodCascade: ConstantStatusCode = new ConstantStatusCode({
        name: "GoodCascade",
        value: 0x4090000,
        description: "The value is accurate, and the signal source supports cascade handshaking."
    });
    /** The DataSet specified for the DataSetWriter creation is invalid. */
    static BadDataSetIdInvalid: ConstantStatusCode = new ConstantStatusCode({
        name: "BadDataSetIdInvalid",
        value: 0x80e70000,
        description: "The DataSet specified for the DataSetWriter creation is invalid."
    });
    static GoodWithOverflowBit = StatusCode.makeStatusCode(StatusCodes.Good, `Overflow | InfoTypeDataValue`);
}
