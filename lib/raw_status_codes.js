// this file has been automatically generated
 exports.StatusCodes = { 
  Good: { name:'Good', value: 0, description:'No Error' }
,                       BadUnexpectedError: { name:                     'BadUnexpectedError' , value: 0x80010000  ,description: "An unexpected error occurred."}
,                         BadInternalError: { name:                       'BadInternalError' , value: 0x80020000  ,description: "An internal error occurred as a result of a programming or configuration error."}
,                           BadOutOfMemory: { name:                         'BadOutOfMemory' , value: 0x80030000  ,description: "Not enough memory to complete the operation."}
,                   BadResourceUnavailable: { name:                 'BadResourceUnavailable' , value: 0x80040000  ,description: "An operating system resource is not available."}
,                    BadCommunicationError: { name:                  'BadCommunicationError' , value: 0x80050000  ,description: "A low level communication error occurred."}
,                         BadEncodingError: { name:                       'BadEncodingError' , value: 0x80060000  ,description: "Encoding halted because of invalid data in the objects being serialized."}
,                         BadDecodingError: { name:                       'BadDecodingError' , value: 0x80070000  ,description: "Decoding halted because of invalid data in the stream."}
,                BadEncodingLimitsExceeded: { name:              'BadEncodingLimitsExceeded' , value: 0x80080000  ,description: "The message encoding/decoding limits imposed by the stack have been exceeded."}
,                       BadRequestTooLarge: { name:                     'BadRequestTooLarge' , value: 0x80b80000  ,description: "The request message size exceeds limits set by the server."}
,                      BadResponseTooLarge: { name:                    'BadResponseTooLarge' , value: 0x80b90000  ,description: "The response message size exceeds limits set by the client."}
,                       BadUnknownResponse: { name:                     'BadUnknownResponse' , value: 0x80090000  ,description: "An unrecognized response was received from the server."}
,                               BadTimeout: { name:                             'BadTimeout' , value: 0x800a0000  ,description: "The operation timed out."}
,                    BadServiceUnsupported: { name:                  'BadServiceUnsupported' , value: 0x800b0000  ,description: "The server does not support the requested service."}
,                              BadShutdown: { name:                            'BadShutdown' , value: 0x800c0000  ,description: "The operation was cancelled because the application is shutting down."}
,                    BadServerNotConnected: { name:                  'BadServerNotConnected' , value: 0x800d0000  ,description: "The operation could not complete because the client is not connected to the server."}
,                          BadServerHalted: { name:                        'BadServerHalted' , value: 0x800e0000  ,description: "The server has stopped and cannot process any requests."}
,                           BadNothingToDo: { name:                         'BadNothingToDo' , value: 0x800f0000  ,description: "There was nothing to do because the client passed a list of operations with no elements."}
,                     BadTooManyOperations: { name:                   'BadTooManyOperations' , value: 0x80100000  ,description: "The request could not be processed because it specified too many operations."}
,                 BadTooManyMonitoredItems: { name:               'BadTooManyMonitoredItems' , value: 0x80db0000  ,description: "The request could not be processed because there are too many monitored items in the subscription."}
,                     BadDataTypeIdUnknown: { name:                   'BadDataTypeIdUnknown' , value: 0x80110000  ,description: "The extension object cannot be (de)serialized because the data type id is not recognized."}
,                    BadCertificateInvalid: { name:                  'BadCertificateInvalid' , value: 0x80120000  ,description: "The certificate provided as a parameter is not valid."}
,                  BadSecurityChecksFailed: { name:                'BadSecurityChecksFailed' , value: 0x80130000  ,description: "An error occurred verifying security."}
,                BadCertificateTimeInvalid: { name:              'BadCertificateTimeInvalid' , value: 0x80140000  ,description: "The Certificate has expired or is not yet valid."}
,          BadCertificateIssuerTimeInvalid: { name:        'BadCertificateIssuerTimeInvalid' , value: 0x80150000  ,description: "An Issuer Certificate has expired or is not yet valid."}
,            BadCertificateHostNameInvalid: { name:          'BadCertificateHostNameInvalid' , value: 0x80160000  ,description: "The HostName used to connect to a Server does not match a HostName in the Certificate."}
,                 BadCertificateUriInvalid: { name:               'BadCertificateUriInvalid' , value: 0x80170000  ,description: "The URI specified in the ApplicationDescription does not match the URI in the Certificate."}
,              BadCertificateUseNotAllowed: { name:            'BadCertificateUseNotAllowed' , value: 0x80180000  ,description: "The Certificate may not be used for the requested operation."}
,        BadCertificateIssuerUseNotAllowed: { name:      'BadCertificateIssuerUseNotAllowed' , value: 0x80190000  ,description: "The Issuer Certificate may not be used for the requested operation."}
,                  BadCertificateUntrusted: { name:                'BadCertificateUntrusted' , value: 0x801a0000  ,description: "The Certificate is not trusted."}
,          BadCertificateRevocationUnknown: { name:        'BadCertificateRevocationUnknown' , value: 0x801b0000  ,description: "It was not possible to determine if the Certificate has been revoked."}
,    BadCertificateIssuerRevocationUnknown: { name:  'BadCertificateIssuerRevocationUnknown' , value: 0x801c0000  ,description: "It was not possible to determine if the Issuer Certificate has been revoked."}
,                    BadCertificateRevoked: { name:                  'BadCertificateRevoked' , value: 0x801d0000  ,description: "The Certificate has been revoked."}
,              BadCertificateIssuerRevoked: { name:            'BadCertificateIssuerRevoked' , value: 0x801e0000  ,description: "The Issuer Certificate has been revoked."}
,                      BadUserAccessDenied: { name:                    'BadUserAccessDenied' , value: 0x801f0000  ,description: "User does not have permission to perform the requested operation."}
,                  BadIdentityTokenInvalid: { name:                'BadIdentityTokenInvalid' , value: 0x80200000  ,description: "The user identity token is not valid."}
,                 BadIdentityTokenRejected: { name:               'BadIdentityTokenRejected' , value: 0x80210000  ,description: "The user identity token is valid but the server has rejected it."}
,                BadSecureChannelIdInvalid: { name:              'BadSecureChannelIdInvalid' , value: 0x80220000  ,description: "The specified secure channel is no longer valid."}
,                      BadInvalidTimestamp: { name:                    'BadInvalidTimestamp' , value: 0x80230000  ,description: "The timestamp is outside the range allowed by the server."}
,                          BadNonceInvalid: { name:                        'BadNonceInvalid' , value: 0x80240000  ,description: "The nonce does appear to be not a random value or it is not the correct length."}
,                      BadSessionIdInvalid: { name:                    'BadSessionIdInvalid' , value: 0x80250000  ,description: "The session id is not valid."}
,                         BadSessionClosed: { name:                       'BadSessionClosed' , value: 0x80260000  ,description: "The session was closed by the client."}
,                   BadSessionNotActivated: { name:                 'BadSessionNotActivated' , value: 0x80270000  ,description: "The session cannot be used because ActivateSession has not been called."}
,                 BadSubscriptionIdInvalid: { name:               'BadSubscriptionIdInvalid' , value: 0x80280000  ,description: "The subscription id is not valid."}
,                  BadRequestHeaderInvalid: { name:                'BadRequestHeaderInvalid' , value: 0x802a0000  ,description: "The header for the request is missing or invalid."}
,             BadTimestampsToReturnInvalid: { name:           'BadTimestampsToReturnInvalid' , value: 0x802b0000  ,description: "The timestamps to return parameter is invalid."}
,              BadRequestCancelledByClient: { name:            'BadRequestCancelledByClient' , value: 0x802c0000  ,description: "The request was cancelled by the client."}
,              GoodSubscriptionTransferred: { name:            'GoodSubscriptionTransferred' , value: 0x2d0000  ,description: "The subscription was transferred to another session."}
,              GoodCompletesAsynchronously: { name:            'GoodCompletesAsynchronously' , value: 0x2e0000  ,description: "The processing will complete asynchronously."}
,                             GoodOverload: { name:                           'GoodOverload' , value: 0x2f0000  ,description: "Sampling has slowed down due to resource limitations."}
,                              GoodClamped: { name:                            'GoodClamped' , value: 0x300000  ,description: "The value written was accepted but was clamped."}
,                       BadNoCommunication: { name:                     'BadNoCommunication' , value: 0x80310000  ,description: "Communication with the data source is defined"}
,                 BadWaitingForInitialData: { name:               'BadWaitingForInitialData' , value: 0x80320000  ,description: "Waiting for the server to obtain values from the underlying data source."}
,                         BadNodeIdInvalid: { name:                       'BadNodeIdInvalid' , value: 0x80330000  ,description: "The syntax of the node id is not valid."}
,                         BadNodeIdUnknown: { name:                       'BadNodeIdUnknown' , value: 0x80340000  ,description: "The node id refers to a node that does not exist in the server address space."}
,                    BadAttributeIdInvalid: { name:                  'BadAttributeIdInvalid' , value: 0x80350000  ,description: "The attribute is not supported for the specified Node."}
,                     BadIndexRangeInvalid: { name:                   'BadIndexRangeInvalid' , value: 0x80360000  ,description: "The syntax of the index range parameter is invalid."}
,                      BadIndexRangeNoData: { name:                    'BadIndexRangeNoData' , value: 0x80370000  ,description: "No data exists within the range of indexes specified."}
,                   BadDataEncodingInvalid: { name:                 'BadDataEncodingInvalid' , value: 0x80380000  ,description: "The data encoding is invalid."}
,               BadDataEncodingUnsupported: { name:             'BadDataEncodingUnsupported' , value: 0x80390000  ,description: "The server does not support the requested data encoding for the node."}
,                           BadNotReadable: { name:                         'BadNotReadable' , value: 0x803a0000  ,description: "The access level does not allow reading or subscribing to the Node."}
,                           BadNotWritable: { name:                         'BadNotWritable' , value: 0x803b0000  ,description: "The access level does not allow writing to the Node."}
,                            BadOutOfRange: { name:                          'BadOutOfRange' , value: 0x803c0000  ,description: "The value was out of range."}
,                          BadNotSupported: { name:                        'BadNotSupported' , value: 0x803d0000  ,description: "The requested operation is not supported."}
,                              BadNotFound: { name:                            'BadNotFound' , value: 0x803e0000  ,description: "A requested item was not found or a search operation ended without success."}
,                         BadObjectDeleted: { name:                       'BadObjectDeleted' , value: 0x803f0000  ,description: "The object cannot be used because it has been deleted."}
,                        BadNotImplemented: { name:                      'BadNotImplemented' , value: 0x80400000  ,description: "Requested operation is not implemented."}
,                 BadMonitoringModeInvalid: { name:               'BadMonitoringModeInvalid' , value: 0x80410000  ,description: "The monitoring mode is invalid."}
,                BadMonitoredItemIdInvalid: { name:              'BadMonitoredItemIdInvalid' , value: 0x80420000  ,description: "The monitoring item id does not refer to a valid monitored item."}
,            BadMonitoredItemFilterInvalid: { name:          'BadMonitoredItemFilterInvalid' , value: 0x80430000  ,description: "The monitored item filter parameter is not valid."}
,        BadMonitoredItemFilterUnsupported: { name:      'BadMonitoredItemFilterUnsupported' , value: 0x80440000  ,description: "The server does not support the requested monitored item filter."}
,                      BadFilterNotAllowed: { name:                    'BadFilterNotAllowed' , value: 0x80450000  ,description: "A monitoring filter cannot be used in combination with the attribute specified."}
,                      BadStructureMissing: { name:                    'BadStructureMissing' , value: 0x80460000  ,description: "A mandatory structured parameter was missing or null."}
,                    BadEventFilterInvalid: { name:                  'BadEventFilterInvalid' , value: 0x80470000  ,description: "The event filter is not valid."}
,                  BadContentFilterInvalid: { name:                'BadContentFilterInvalid' , value: 0x80480000  ,description: "The content filter is not valid."}
,                 BadFilterOperatorInvalid: { name:               'BadFilterOperatorInvalid' , value: 0x80c10000  ,description: "An unregognized operator was provided in a filter."}
,             BadFilterOperatorUnsupported: { name:           'BadFilterOperatorUnsupported' , value: 0x80c20000  ,description: "A valid operator was provided"}
,            BadFilterOperandCountMismatch: { name:          'BadFilterOperandCountMismatch' , value: 0x80c30000  ,description: "The number of operands provided for the filter operator was less then expected for the operand provided."}
,                  BadFilterOperandInvalid: { name:                'BadFilterOperandInvalid' , value: 0x80490000  ,description: "The operand used in a content filter is not valid."}
,                  BadFilterElementInvalid: { name:                'BadFilterElementInvalid' , value: 0x80c40000  ,description: "The referenced element is not a valid element in the content filter."}
,                  BadFilterLiteralInvalid: { name:                'BadFilterLiteralInvalid' , value: 0x80c50000  ,description: "The referenced literal is not a valid value."}
,              BadContinuationPointInvalid: { name:            'BadContinuationPointInvalid' , value: 0x804a0000  ,description: "The continuation point provide is longer valid."}
,                  BadNoContinuationPoints: { name:                'BadNoContinuationPoints' , value: 0x804b0000  ,description: "The operation could not be processed because all continuation points have been allocated."}
,                BadReferenceTypeIdInvalid: { name:              'BadReferenceTypeIdInvalid' , value: 0x804c0000  ,description: "The operation could not be processed because all continuation points have been allocated."}
,                BadBrowseDirectionInvalid: { name:              'BadBrowseDirectionInvalid' , value: 0x804d0000  ,description: "The browse direction is not valid."}
,                         BadNodeNotInView: { name:                       'BadNodeNotInView' , value: 0x804e0000  ,description: "The node is not part of the view."}
,                      BadServerUriInvalid: { name:                    'BadServerUriInvalid' , value: 0x804f0000  ,description: "The ServerUri is not a valid URI."}
,                     BadServerNameMissing: { name:                   'BadServerNameMissing' , value: 0x80500000  ,description: "No ServerName was specified."}
,                   BadDiscoveryUrlMissing: { name:                 'BadDiscoveryUrlMissing' , value: 0x80510000  ,description: "No DiscoveryUrl was specified."}
,                  BadSempahoreFileMissing: { name:                'BadSempahoreFileMissing' , value: 0x80520000  ,description: "The semaphore file specified by the client is not valid."}
,                    BadRequestTypeInvalid: { name:                  'BadRequestTypeInvalid' , value: 0x80530000  ,description: "The security token request type is not valid."}
,                  BadSecurityModeRejected: { name:                'BadSecurityModeRejected' , value: 0x80540000  ,description: "The security mode does not meet the requirements set by the Server."}
,                BadSecurityPolicyRejected: { name:              'BadSecurityPolicyRejected' , value: 0x80550000  ,description: "The security policy does not meet the requirements set by the Server."}
,                       BadTooManySessions: { name:                     'BadTooManySessions' , value: 0x80560000  ,description: "The server has reached its maximum number of sessions."}
,                  BadUserSignatureInvalid: { name:                'BadUserSignatureInvalid' , value: 0x80570000  ,description: "The user token signature is missing or invalid."}
,           BadApplicationSignatureInvalid: { name:         'BadApplicationSignatureInvalid' , value: 0x80580000  ,description: "The signature generated with the client certificate is missing or invalid."}
,                   BadNoValidCertificates: { name:                 'BadNoValidCertificates' , value: 0x80590000  ,description: "The client did not provide at least one software certificate that is valid and meets the profile requirements for the server."}
,            BadIdentityChangeNotSupported: { name:          'BadIdentityChangeNotSupported' , value: 0x80c60000  ,description: "The Server does not support changing the user identity assigned to the session."}
,             BadRequestCancelledByRequest: { name:           'BadRequestCancelledByRequest' , value: 0x805a0000  ,description: "The request was cancelled by the client with the Cancel service."}
,                   BadParentNodeIdInvalid: { name:                 'BadParentNodeIdInvalid' , value: 0x805b0000  ,description: "The parent node id does not to refer to a valid node."}
,                   BadReferenceNotAllowed: { name:                 'BadReferenceNotAllowed' , value: 0x805c0000  ,description: "The reference could not be created because it violates constraints imposed by the data model."}
,                        BadNodeIdRejected: { name:                      'BadNodeIdRejected' , value: 0x805d0000  ,description: "The requested node id was reject because it was either invalid or server does not allow node ids to be specified by the client."}
,                          BadNodeIdExists: { name:                        'BadNodeIdExists' , value: 0x805e0000  ,description: "The requested node id is already used by another node."}
,                      BadNodeClassInvalid: { name:                    'BadNodeClassInvalid' , value: 0x805f0000  ,description: "The node class is not valid."}
,                     BadBrowseNameInvalid: { name:                   'BadBrowseNameInvalid' , value: 0x80600000  ,description: "The browse name is invalid."}
,                  BadBrowseNameDuplicated: { name:                'BadBrowseNameDuplicated' , value: 0x80610000  ,description: "The browse name is not unique among nodes that share the same relationship with the parent."}
,                 BadNodeAttributesInvalid: { name:               'BadNodeAttributesInvalid' , value: 0x80620000  ,description: "The node attributes are not valid for the node class."}
,                 BadTypeDefinitionInvalid: { name:               'BadTypeDefinitionInvalid' , value: 0x80630000  ,description: "The type definition node id does not reference an appropriate type node."}
,                   BadSourceNodeIdInvalid: { name:                 'BadSourceNodeIdInvalid' , value: 0x80640000  ,description: "The source node id does not reference a valid node."}
,                   BadTargetNodeIdInvalid: { name:                 'BadTargetNodeIdInvalid' , value: 0x80650000  ,description: "The target node id does not reference a valid node."}
,          BadDuplicateReferenceNotAllowed: { name:        'BadDuplicateReferenceNotAllowed' , value: 0x80660000  ,description: "The reference type between the nodes is already defined."}
,                  BadInvalidSelfReference: { name:                'BadInvalidSelfReference' , value: 0x80670000  ,description: "The server does not allow this type of self reference on this node."}
,                    BadReferenceLocalOnly: { name:                  'BadReferenceLocalOnly' , value: 0x80680000  ,description: "The reference type is not valid for a reference to a remote server."}
,                        BadNoDeleteRights: { name:                      'BadNoDeleteRights' , value: 0x80690000  ,description: "The server will not allow the node to be deleted."}
,             UncertainReferenceNotDeleted: { name:           'UncertainReferenceNotDeleted' , value: 0x40bc0000  ,description: "The server was not able to delete all target references."}
,                    BadServerIndexInvalid: { name:                  'BadServerIndexInvalid' , value: 0x806a0000  ,description: "The server index is not valid."}
,                         BadViewIdUnknown: { name:                       'BadViewIdUnknown' , value: 0x806b0000  ,description: "The view id does not refer to a valid view node."}
,                  BadViewTimestampInvalid: { name:                'BadViewTimestampInvalid' , value: 0x80c90000  ,description: "The view timestamp is not available or not supported."}
,                 BadViewParameterMismatch: { name:               'BadViewParameterMismatch' , value: 0x80ca0000  ,description: "The view parameters are not consistent with each other."}
,                    BadViewVersionInvalid: { name:                  'BadViewVersionInvalid' , value: 0x80cb0000  ,description: "The view version is not available or not supported."}
,            UncertainNotAllNodesAvailable: { name:          'UncertainNotAllNodesAvailable' , value: 0x40c00000  ,description: "The list of references may not be complete because the underlying system is not available."}
,               GoodResultsMayBeIncomplete: { name:             'GoodResultsMayBeIncomplete' , value: 0xba0000  ,description: "The server should have followed a reference to a node in a remote server but did not. The result set may be incomplete."}
,                     BadNotTypeDefinition: { name:                   'BadNotTypeDefinition' , value: 0x80c80000  ,description: "The provided Nodeid was not a type definition nodeid."}
,            UncertainReferenceOutOfServer: { name:          'UncertainReferenceOutOfServer' , value: 0x406c0000  ,description: "One of the references to follow in the relative path references to a node in the address space in another server."}
,                        BadTooManyMatches: { name:                      'BadTooManyMatches' , value: 0x806d0000  ,description: "The requested operation has too many matches to return."}
,                       BadQueryTooComplex: { name:                     'BadQueryTooComplex' , value: 0x806e0000  ,description: "The requested operation requires too many resources in the server."}
,                               BadNoMatch: { name:                             'BadNoMatch' , value: 0x806f0000  ,description: "The requested operation has no match to return."}
,                         BadMaxAgeInvalid: { name:                       'BadMaxAgeInvalid' , value: 0x80700000  ,description: "The max age parameter is invalid."}
,               BadHistoryOperationInvalid: { name:             'BadHistoryOperationInvalid' , value: 0x80710000  ,description: "The history details parameter is not valid."}
,           BadHistoryOperationUnsupported: { name:         'BadHistoryOperationUnsupported' , value: 0x80720000  ,description: "The server does not support the requested operation."}
,              BadInvalidTimestampArgument: { name:            'BadInvalidTimestampArgument' , value: 0x80bd0000  ,description: "The defined timestamp to return was invalid."}
,                     BadWriteNotSupported: { name:                   'BadWriteNotSupported' , value: 0x80730000  ,description: "The server not does support writing the combination of value"}
,                          BadTypeMismatch: { name:                        'BadTypeMismatch' , value: 0x80740000  ,description: "The value supplied for the attribute is not of the same type as the attribute's value."}
,                         BadMethodInvalid: { name:                       'BadMethodInvalid' , value: 0x80750000  ,description: "The method id does not refer to a method for the specified object."}
,                      BadArgumentsMissing: { name:                    'BadArgumentsMissing' , value: 0x80760000  ,description: "The client did not specify all of the input arguments for the method."}
,                  BadTooManySubscriptions: { name:                'BadTooManySubscriptions' , value: 0x80770000  ,description: "The server has reached its  maximum number of subscriptions."}
,                BadTooManyPublishRequests: { name:              'BadTooManyPublishRequests' , value: 0x80780000  ,description: "The server has reached the maximum number of queued publish requests."}
,                        BadNoSubscription: { name:                      'BadNoSubscription' , value: 0x80790000  ,description: "There is no subscription available for this session."}
,                 BadSequenceNumberUnknown: { name:               'BadSequenceNumberUnknown' , value: 0x807a0000  ,description: "The sequence number is unknown to the server."}
,                   BadMessageNotAvailable: { name:                 'BadMessageNotAvailable' , value: 0x807b0000  ,description: "The requested notification message is no longer available."}
,             BadInsufficientClientProfile: { name:           'BadInsufficientClientProfile' , value: 0x807c0000  ,description: "The Client of the current Session does not support one or more Profiles that are necessary for the Subscription."}
,                        BadStateNotActive: { name:                      'BadStateNotActive' , value: 0x80bf0000  ,description: "The sub-state machine is not currently active."}
,                      BadTcpServerTooBusy: { name:                    'BadTcpServerTooBusy' , value: 0x807d0000  ,description: "The server cannot process the request because it is too busy."}
,                 BadTcpMessageTypeInvalid: { name:               'BadTcpMessageTypeInvalid' , value: 0x807e0000  ,description: "The type of the message specified in the header invalid."}
,               BadTcpSecureChannelUnknown: { name:             'BadTcpSecureChannelUnknown' , value: 0x807f0000  ,description: "The SecureChannelId and/or TokenId are not currently in use."}
,                    BadTcpMessageTooLarge: { name:                  'BadTcpMessageTooLarge' , value: 0x80800000  ,description: "The size of the message specified in the header is too large."}
,                 BadTcpNotEnoughResources: { name:               'BadTcpNotEnoughResources' , value: 0x80810000  ,description: "There are not enough resources to process the request."}
,                      BadTcpInternalError: { name:                    'BadTcpInternalError' , value: 0x80820000  ,description: "An internal error occurred."}
,                 BadTcpEndpointUrlInvalid: { name:               'BadTcpEndpointUrlInvalid' , value: 0x80830000  ,description: "The Server does not recognize the QueryString specified."}
,                    BadRequestInterrupted: { name:                  'BadRequestInterrupted' , value: 0x80840000  ,description: "The request could not be sent because of a network interruption."}
,                        BadRequestTimeout: { name:                      'BadRequestTimeout' , value: 0x80850000  ,description: "Timeout occurred while processing the request."}
,                   BadSecureChannelClosed: { name:                 'BadSecureChannelClosed' , value: 0x80860000  ,description: "The secure channel has been closed."}
,             BadSecureChannelTokenUnknown: { name:           'BadSecureChannelTokenUnknown' , value: 0x80870000  ,description: "The token has expired or is not recognized."}
,                 BadSequenceNumberInvalid: { name:               'BadSequenceNumberInvalid' , value: 0x80880000  ,description: "The sequence number is not valid."}
,            BadProtocolVersionUnsupported: { name:          'BadProtocolVersionUnsupported' , value: 0x80be0000  ,description: "The applications do not have compatible protocol versions."}
,                    BadConfigurationError: { name:                  'BadConfigurationError' , value: 0x80890000  ,description: "There is a problem with the configuration that affects the usefulness of the value."}
,                          BadNotConnected: { name:                        'BadNotConnected' , value: 0x808a0000  ,description: "The variable should receive its value from another variable"}
,                         BadDeviceFailure: { name:                       'BadDeviceFailure' , value: 0x808b0000  ,description: "There has been a failure in the device/data source that generates the value that has affected the value."}
,                         BadSensorFailure: { name:                       'BadSensorFailure' , value: 0x808c0000  ,description: "There has been a failure in the sensor from which the value is derived by the device/data source."}
,                          BadOutOfService: { name:                        'BadOutOfService' , value: 0x808d0000  ,description: "The source of the data is not operational."}
,                 BadDeadbandFilterInvalid: { name:               'BadDeadbandFilterInvalid' , value: 0x808e0000  ,description: "The deadband filter is not valid."}
,  UncertainNoCommunicationLastUsableValue: { name: 'UncertainNoCommunicationLastUsableValue' , value: 0x408f0000  ,description: "Communication to the data source has failed. The variable value is the last value that had a good quality."}
,                 UncertainLastUsableValue: { name:               'UncertainLastUsableValue' , value: 0x40900000  ,description: "Whatever was updating this value has stopped doing so."}
,                 UncertainSubstituteValue: { name:               'UncertainSubstituteValue' , value: 0x40910000  ,description: "The value is an operational value that was manually overwritten."}
,                    UncertainInitialValue: { name:                  'UncertainInitialValue' , value: 0x40920000  ,description: "The value is an initial value for a variable that normally receives its value from another variable."}
,               UncertainSensorNotAccurate: { name:             'UncertainSensorNotAccurate' , value: 0x40930000  ,description: "The value is at one of the sensor limits."}
,        UncertainEngineeringUnitsExceeded: { name:      'UncertainEngineeringUnitsExceeded' , value: 0x40940000  ,description: "The value is outside of the range of values defined for this parameter."}
,                       UncertainSubNormal: { name:                     'UncertainSubNormal' , value: 0x40950000  ,description: "The value is derived from multiple sources and has less than the required number of Good sources."}
,                        GoodLocalOverride: { name:                      'GoodLocalOverride' , value: 0x960000  ,description: "The value has been overridden."}
,                     BadRefreshInProgress: { name:                   'BadRefreshInProgress' , value: 0x80970000  ,description: "This Condition refresh failed"}
,              BadConditionAlreadyDisabled: { name:            'BadConditionAlreadyDisabled' , value: 0x80980000  ,description: "This condition has already been disabled."}
,               BadConditionAlreadyEnabled: { name:             'BadConditionAlreadyEnabled' , value: 0x80cc0000  ,description: "This condition has already been enabled."}
,                     BadConditionDisabled: { name:                   'BadConditionDisabled' , value: 0x80990000  ,description: "Property not available"}
,                        BadEventIdUnknown: { name:                      'BadEventIdUnknown' , value: 0x809a0000  ,description: "The specified event id is not recognized."}
,               BadEventNotAcknowledgeable: { name:             'BadEventNotAcknowledgeable' , value: 0x80bb0000  ,description: "The event cannot be acknowledged."}
,                       BadDialogNotActive: { name:                     'BadDialogNotActive' , value: 0x80cd0000  ,description: "The dialog condition is not active."}
,                 BadDialogResponseInvalid: { name:               'BadDialogResponseInvalid' , value: 0x80ce0000  ,description: "The response is not valid for the dialog."}
,           BadConditionBranchAlreadyAcked: { name:         'BadConditionBranchAlreadyAcked' , value: 0x80cf0000  ,description: "The condition branch has already been acknowledged."}
,       BadConditionBranchAlreadyConfirmed: { name:     'BadConditionBranchAlreadyConfirmed' , value: 0x80d00000  ,description: "The condition branch has already been confirmed."}
,               BadConditionAlreadyShelved: { name:             'BadConditionAlreadyShelved' , value: 0x80d10000  ,description: "The condition has already been shelved."}
,                   BadConditionNotShelved: { name:                 'BadConditionNotShelved' , value: 0x80d20000  ,description: "The condition is not currently shelved."}
,                BadShelvingTimeOutOfRange: { name:              'BadShelvingTimeOutOfRange' , value: 0x80d30000  ,description: "The shelving time not within an acceptable range."}
,                                BadNoData: { name:                              'BadNoData' , value: 0x809b0000  ,description: "No data exists for the requested time range or event filter."}
,                         BadBoundNotFound: { name:                       'BadBoundNotFound' , value: 0x80d70000  ,description: "No data found to provide upper or lower bound value."}
,                     BadBoundNotSupported: { name:                   'BadBoundNotSupported' , value: 0x80d80000  ,description: "The server cannot retrieve a bound for the variable."}
,                              BadDataLost: { name:                            'BadDataLost' , value: 0x809d0000  ,description: "Data is missing due to collection started/stopped/lost."}
,                       BadDataUnavailable: { name:                     'BadDataUnavailable' , value: 0x809e0000  ,description: "Expected data is unavailable for the requested time range due to an un-mounted volume"}
,                           BadEntryExists: { name:                         'BadEntryExists' , value: 0x809f0000  ,description: "The data or event was not successfully inserted because a matching entry exists."}
,                         BadNoEntryExists: { name:                       'BadNoEntryExists' , value: 0x80a00000  ,description: "The data or event was not successfully updated because no matching entry exists."}
,                 BadTimestampNotSupported: { name:               'BadTimestampNotSupported' , value: 0x80a10000  ,description: "The client requested history using a timestamp format the server does not support (i.e requested ServerTimestamp when server only supports SourceTimestamp)."}
,                        GoodEntryInserted: { name:                      'GoodEntryInserted' , value: 0xa20000  ,description: "The data or event was successfully inserted into the historical database."}
,                        GoodEntryReplaced: { name:                      'GoodEntryReplaced' , value: 0xa30000  ,description: "The data or event field was successfully replaced in the historical database."}
,                   UncertainDataSubNormal: { name:                 'UncertainDataSubNormal' , value: 0x40a40000  ,description: "The value is derived from multiple values and has less than the required number of Good values."}
,                               GoodNoData: { name:                             'GoodNoData' , value: 0xa50000  ,description: "No data exists for the requested time range or event filter."}
,                             GoodMoreData: { name:                           'GoodMoreData' , value: 0xa60000  ,description: "The data or event field was successfully replaced in the historical database."}
,                 BadAggregateListMismatch: { name:               'BadAggregateListMismatch' , value: 0x80d40000  ,description: "The requested number of Aggregates does not match the requested number of NodeIds."}
,                 BadAggregateNotSupported: { name:               'BadAggregateNotSupported' , value: 0x80d50000  ,description: "The requested Aggregate is not support by the server."}
,                BadAggregateInvalidInputs: { name:              'BadAggregateInvalidInputs' , value: 0x80d60000  ,description: "The aggregate value could not be derived due to invalid data inputs."}
,        BadAggregateConfigurationRejected: { name:      'BadAggregateConfigurationRejected' , value: 0x80da0000  ,description: "The aggregate configuration is not valid for specified node."}
,                          GoodDataIgnored: { name:                        'GoodDataIgnored' , value: 0xd90000  ,description: "The request pecifies fields which are not valid for the EventType or cannot be saved by the historian."}
,                   GoodCommunicationEvent: { name:                 'GoodCommunicationEvent' , value: 0xa70000  ,description: "The communication layer has raised an event."}
,                        GoodShutdownEvent: { name:                      'GoodShutdownEvent' , value: 0xa80000  ,description: "The system is shutting down."}
,                            GoodCallAgain: { name:                          'GoodCallAgain' , value: 0xa90000  ,description: "The operation is not finished and needs to be called again."}
,                   GoodNonCriticalTimeout: { name:                 'GoodNonCriticalTimeout' , value: 0xaa0000  ,description: "A non-critical timeout occurred."}
,                       BadInvalidArgument: { name:                     'BadInvalidArgument' , value: 0x80ab0000  ,description: "One or more arguments are invalid."}
,                    BadConnectionRejected: { name:                  'BadConnectionRejected' , value: 0x80ac0000  ,description: "Could not establish a network connection to remote server."}
,                            BadDisconnect: { name:                          'BadDisconnect' , value: 0x80ad0000  ,description: "The server has disconnected from the client."}
,                      BadConnectionClosed: { name:                    'BadConnectionClosed' , value: 0x80ae0000  ,description: "The network connection has been closed."}
,                          BadInvalidState: { name:                        'BadInvalidState' , value: 0x80af0000  ,description: "The operation cannot be completed because the object is closed"}
,                           BadEndOfStream: { name:                         'BadEndOfStream' , value: 0x80b00000  ,description: "Cannot move beyond end of the stream."}
,                       BadNoDataAvailable: { name:                     'BadNoDataAvailable' , value: 0x80b10000  ,description: "No data is currently available for reading from a non-blocking stream."}
,                    BadWaitingForResponse: { name:                  'BadWaitingForResponse' , value: 0x80b20000  ,description: "The asynchronous operation is waiting for a response."}
,                    BadOperationAbandoned: { name:                  'BadOperationAbandoned' , value: 0x80b30000  ,description: "The asynchronous operation was abandoned by the caller."}
,                 BadExpectedStreamToBlock: { name:               'BadExpectedStreamToBlock' , value: 0x80b40000  ,description: "The stream did not return all data requested (possibly because it is a non-blocking stream)."}
,                            BadWouldBlock: { name:                          'BadWouldBlock' , value: 0x80b50000  ,description: "Non blocking behaviour is required and the operation would block."}
,                           BadSyntaxError: { name:                         'BadSyntaxError' , value: 0x80b60000  ,description: "A value had an invalid syntax."}
,                 BadMaxConnectionsReached: { name:               'BadMaxConnectionsReached' , value: 0x80b70000  ,description: "The operation could not be finished because all available connections are in use."}
};
