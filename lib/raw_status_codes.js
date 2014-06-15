// this file has been automatically generated
 exports.StatusCodes = { 
  Good: { name:'Good', value: 0, description:'No Error' }
,                      Bad_UnexpectedError: { name:                    'Bad_UnexpectedError' , value:      1  ,description: "An unexpected error occurred."}
,                        Bad_InternalError: { name:                      'Bad_InternalError' , value:      2  ,description: "An internal error occurred as a result of a programming or configuration error."}
,                          Bad_OutOfMemory: { name:                        'Bad_OutOfMemory' , value:      3  ,description: "Not enough memory to complete the operation."}
,                  Bad_ResourceUnavailable: { name:                'Bad_ResourceUnavailable' , value:      4  ,description: "An operating system resource is not available."}
,                   Bad_CommunicationError: { name:                 'Bad_CommunicationError' , value:      5  ,description: "A low level communication error occurred."}
,                        Bad_EncodingError: { name:                      'Bad_EncodingError' , value:      6  ,description: "Encoding halted because of invalid data in the objects being serialized."}
,                        Bad_DecodingError: { name:                      'Bad_DecodingError' , value:      7  ,description: "Decoding halted because of invalid data in the stream."}
,               Bad_EncodingLimitsExceeded: { name:             'Bad_EncodingLimitsExceeded' , value:      8  ,description: "The message encoding/decoding limits imposed by the stack have been exceeded."}
,                      Bad_RequestTooLarge: { name:                    'Bad_RequestTooLarge' , value:    184  ,description: "The request message size exceeds limits set by the server."}
,                     Bad_ResponseTooLarge: { name:                   'Bad_ResponseTooLarge' , value:    185  ,description: "The response message size exceeds limits set by the client."}
,                      Bad_UnknownResponse: { name:                    'Bad_UnknownResponse' , value:      9  ,description: "An unrecognized response was received from the server."}
,                              Bad_Timeout: { name:                            'Bad_Timeout' , value:     10  ,description: "The operation timed out."}
,                   Bad_ServiceUnsupported: { name:                 'Bad_ServiceUnsupported' , value:     11  ,description: "The server does not support the requested service."}
,                             Bad_Shutdown: { name:                           'Bad_Shutdown' , value:     12  ,description: "The operation was cancelled because the application is shutting down."}
,                   Bad_ServerNotConnected: { name:                 'Bad_ServerNotConnected' , value:     13  ,description: "The operation could not complete because the client is not connected to the server."}
,                         Bad_ServerHalted: { name:                       'Bad_ServerHalted' , value:     14  ,description: "The server has stopped and cannot process any requests."}
,                          Bad_NothingToDo: { name:                        'Bad_NothingToDo' , value:     15  ,description: "There was nothing to do because the client passed a list of operations with no elements."}
,                    Bad_TooManyOperations: { name:                  'Bad_TooManyOperations' , value:     16  ,description: "The request could not be processed because it specified too many operations."}
,                    Bad_TooManyOperations: { name:                  'Bad_TooManyOperations' , value:     16  ,description: "The request could not be processed because there are too many monitored items in the subscription."}
,                    Bad_DataTypeIdUnknown: { name:                  'Bad_DataTypeIdUnknown' , value:     17  ,description: "The extension object cannot be (de)serialized because the data type id is not recognized."}
,                   Bad_CertificateInvalid: { name:                 'Bad_CertificateInvalid' , value:     18  ,description: "The certificate provided as a parameter is not valid."}
,                 Bad_SecurityChecksFailed: { name:               'Bad_SecurityChecksFailed' , value:     19  ,description: "An error occurred verifying security."}
,               Bad_CertificateTimeInvalid: { name:             'Bad_CertificateTimeInvalid' , value:     20  ,description: "The Certificate has expired or is not yet valid."}
,         Bad_CertificateIssuerTimeInvalid: { name:       'Bad_CertificateIssuerTimeInvalid' , value:     21  ,description: "An Issuer Certificate has expired or is not yet valid."}
,           Bad_CertificateHostNameInvalid: { name:         'Bad_CertificateHostNameInvalid' , value:     22  ,description: "The HostName used to connect to a Server does not match a HostName in the Certificate."}
,                Bad_CertificateUriInvalid: { name:              'Bad_CertificateUriInvalid' , value:     23  ,description: "The URI specified in the ApplicationDescription does not match the URI in the Certificate."}
,             Bad_CertificateUseNotAllowed: { name:           'Bad_CertificateUseNotAllowed' , value:     24  ,description: "The Certificate may not be used for the requested operation."}
,       Bad_CertificateIssuerUseNotAllowed: { name:     'Bad_CertificateIssuerUseNotAllowed' , value:     25  ,description: "The Issuer Certificate may not be used for the requested operation."}
,                 Bad_CertificateUntrusted: { name:               'Bad_CertificateUntrusted' , value:     26  ,description: "The Certificate is not trusted."}
,         Bad_CertificateRevocationUnknown: { name:       'Bad_CertificateRevocationUnknown' , value:     27  ,description: "It was not possible to determine if the Certificate has been revoked."}
,   Bad_CertificateIssuerRevocationUnknown: { name: 'Bad_CertificateIssuerRevocationUnknown' , value:     28  ,description: "It was not possible to determine if the Issuer Certificate has been revoked."}
,                   Bad_CertificateRevoked: { name:                 'Bad_CertificateRevoked' , value:     29  ,description: "The Certificate has been revoked."}
,             Bad_CertificateIssuerRevoked: { name:           'Bad_CertificateIssuerRevoked' , value:     30  ,description: "The Issuer Certificate has been revoked."}
,                     Bad_UserAccessDenied: { name:                   'Bad_UserAccessDenied' , value:     31  ,description: "User does not have permission to perform the requested operation."}
,                 Bad_IdentityTokenInvalid: { name:               'Bad_IdentityTokenInvalid' , value:     32  ,description: "The user identity token is not valid."}
,                Bad_IdentityTokenRejected: { name:              'Bad_IdentityTokenRejected' , value:     33  ,description: "The user identity token is valid but the server has rejected it."}
,               Bad_SecureChannelIdInvalid: { name:             'Bad_SecureChannelIdInvalid' , value:     34  ,description: "The specified secure channel is no longer valid."}
,                     Bad_InvalidTimestamp: { name:                   'Bad_InvalidTimestamp' , value:     35  ,description: "The timestamp is outside the range allowed by the server."}
,                         Bad_NonceInvalid: { name:                       'Bad_NonceInvalid' , value:     36  ,description: "The nonce does appear to be not a random value or it is not the correct length."}
,                     Bad_SessionIdInvalid: { name:                   'Bad_SessionIdInvalid' , value:     37  ,description: "The session id is not valid."}
,                        Bad_SessionClosed: { name:                      'Bad_SessionClosed' , value:     38  ,description: "The session was closed by the client."}
,                  Bad_SessionNotActivated: { name:                'Bad_SessionNotActivated' , value:     39  ,description: "The session cannot be used because ActivateSession has not been called."}
,                Bad_SubscriptionIdInvalid: { name:              'Bad_SubscriptionIdInvalid' , value:     40  ,description: "The subscription id is not valid."}
,                 Bad_RequestHeaderInvalid: { name:               'Bad_RequestHeaderInvalid' , value:     42  ,description: "The header for the request is missing or invalid."}
,            Bad_TimestampsToReturnInvalid: { name:          'Bad_TimestampsToReturnInvalid' , value:     43  ,description: "The timestamps to return parameter is invalid."}
,             Bad_RequestCancelledByClient: { name:           'Bad_RequestCancelledByClient' , value:     44  ,description: "The request was cancelled by the client."}
,             Good_SubscriptionTransferred: { name:           'Good_SubscriptionTransferred' , value:     45  ,description: "The subscription was transferred to another session."}
,             Good_CompletesAsynchronously: { name:           'Good_CompletesAsynchronously' , value:     46  ,description: "The processing will complete asynchronously."}
,                            Good_Overload: { name:                          'Good_Overload' , value:     47  ,description: "Sampling has slowed down due to resource limitations."}
,                             Good_Clamped: { name:                           'Good_Clamped' , value:     48  ,description: "The value written was accepted but was clamped."}
,                      Bad_NoCommunication: { name:                    'Bad_NoCommunication' , value:     49  ,description: "Communication with the data source is defined, but not established, and there is no last known value available."}
,                Bad_WaitingForInitialData: { name:              'Bad_WaitingForInitialData' , value:     50  ,description: "Waiting for the server to obtain values from the underlying data source."}
,                        Bad_NodeIdInvalid: { name:                      'Bad_NodeIdInvalid' , value:     51  ,description: "The syntax of the node id is not valid."}
,                        Bad_NodeIdUnknown: { name:                      'Bad_NodeIdUnknown' , value:     52  ,description: "The node id refers to a node that does not exist in the server address space."}
,                   Bad_AttributeIdInvalid: { name:                 'Bad_AttributeIdInvalid' , value:     53  ,description: "The attribute is not supported for the specified Node."}
,                    Bad_IndexRangeInvalid: { name:                  'Bad_IndexRangeInvalid' , value:     54  ,description: "The syntax of the index range parameter is invalid."}
,                     Bad_IndexRangeNoData: { name:                   'Bad_IndexRangeNoData' , value:     55  ,description: "No data exists within the range of indexes specified."}
,                  Bad_DataEncodingInvalid: { name:                'Bad_DataEncodingInvalid' , value:     56  ,description: "The data encoding is invalid."}
,              Bad_DataEncodingUnsupported: { name:            'Bad_DataEncodingUnsupported' , value:     57  ,description: "The server does not support the requested data encoding for the node."}
,                          Bad_NotReadable: { name:                        'Bad_NotReadable' , value:     58  ,description: "The access level does not allow reading or subscribing to the Node."}
,                          Bad_NotWritable: { name:                        'Bad_NotWritable' , value:     59  ,description: "The access level does not allow writing to the Node."}
,                           Bad_OutOfRange: { name:                         'Bad_OutOfRange' , value:     60  ,description: "The value was out of range."}
,                         Bad_NotSupported: { name:                       'Bad_NotSupported' , value:     61  ,description: "The requested operation is not supported."}
,                             Bad_NotFound: { name:                           'Bad_NotFound' , value:     62  ,description: "A requested item was not found or a search operation ended without success."}
,                        Bad_ObjectDeleted: { name:                      'Bad_ObjectDeleted' , value:     63  ,description: "The object cannot be used because it has been deleted."}
,                       Bad_NotImplemented: { name:                     'Bad_NotImplemented' , value:     64  ,description: "Requested operation is not implemented."}
,                Bad_MonitoringModeInvalid: { name:              'Bad_MonitoringModeInvalid' , value:     65  ,description: "The monitoring mode is invalid."}
,               Bad_MonitoredItemIdInvalid: { name:             'Bad_MonitoredItemIdInvalid' , value:     66  ,description: "The monitoring item id does not refer to a valid monitored item."}
,           Bad_MonitoredItemFilterInvalid: { name:         'Bad_MonitoredItemFilterInvalid' , value:     67  ,description: "The monitored item filter parameter is not valid."}
,       Bad_MonitoredItemFilterUnsupported: { name:     'Bad_MonitoredItemFilterUnsupported' , value:     68  ,description: "The server does not support the requested monitored item filter."}
,                     Bad_FilterNotAllowed: { name:                   'Bad_FilterNotAllowed' , value:     69  ,description: "A monitoring filter cannot be used in combination with the attribute specified."}
,                     Bad_StructureMissing: { name:                   'Bad_StructureMissing' , value:     70  ,description: "A mandatory structured parameter was missing or null."}
,                   Bad_EventFilterInvalid: { name:                 'Bad_EventFilterInvalid' , value:     71  ,description: "The event filter is not valid."}
,                 Bad_ContentFilterInvalid: { name:               'Bad_ContentFilterInvalid' , value:     72  ,description: "The content filter is not valid."}
,                Bad_FilterOperatorInvalid: { name:              'Bad_FilterOperatorInvalid' , value:    193  ,description: "An unregognized operator was provided in a filter."}
,            Bad_FilterOperatorUnsupported: { name:          'Bad_FilterOperatorUnsupported' , value:    194  ,description: "A valid operator was provided, but the server does not provide support for this filter operator."}
,           Bad_FilterOperandCountMismatch: { name:         'Bad_FilterOperandCountMismatch' , value:    195  ,description: "The number of operands provided for the filter operator was less then expected for the operand provided."}
,                 Bad_FilterOperandInvalid: { name:               'Bad_FilterOperandInvalid' , value:     73  ,description: "The operand used in a content filter is not valid."}
,                 Bad_FilterElementInvalid: { name:               'Bad_FilterElementInvalid' , value:    196  ,description: "The referenced element is not a valid element in the content filter."}
,                 Bad_FilterLiteralInvalid: { name:               'Bad_FilterLiteralInvalid' , value:    197  ,description: "The referenced literal is not a valid value."}
,             Bad_ContinuationPointInvalid: { name:           'Bad_ContinuationPointInvalid' , value:     74  ,description: "The continuation point provide is longer valid."}
,                 Bad_NoContinuationPoints: { name:               'Bad_NoContinuationPoints' , value:     75  ,description: "The operation could not be processed because all continuation points have been allocated."}
,               Bad_ReferenceTypeIdInvalid: { name:             'Bad_ReferenceTypeIdInvalid' , value:     76  ,description: "The operation could not be processed because all continuation points have been allocated."}
,               Bad_BrowseDirectionInvalid: { name:             'Bad_BrowseDirectionInvalid' , value:     77  ,description: "The browse direction is not valid."}
,                        Bad_NodeNotInView: { name:                      'Bad_NodeNotInView' , value:     78  ,description: "The node is not part of the view."}
,                     Bad_ServerUriInvalid: { name:                   'Bad_ServerUriInvalid' , value:     79  ,description: "The ServerUri is not a valid URI."}
,                    Bad_ServerNameMissing: { name:                  'Bad_ServerNameMissing' , value:     80  ,description: "No ServerName was specified."}
,                  Bad_DiscoveryUrlMissing: { name:                'Bad_DiscoveryUrlMissing' , value:     81  ,description: "No DiscoveryUrl was specified."}
,                 Bad_SempahoreFileMissing: { name:               'Bad_SempahoreFileMissing' , value:     82  ,description: "The semaphore file specified by the client is not valid."}
,                   Bad_RequestTypeInvalid: { name:                 'Bad_RequestTypeInvalid' , value:     83  ,description: "The security token request type is not valid."}
,                 Bad_SecurityModeRejected: { name:               'Bad_SecurityModeRejected' , value:     84  ,description: "The security mode does not meet the requirements set by the Server."}
,               Bad_SecurityPolicyRejected: { name:             'Bad_SecurityPolicyRejected' , value:     85  ,description: "The security policy does not meet the requirements set by the Server."}
,                      Bad_TooManySessions: { name:                    'Bad_TooManySessions' , value:     86  ,description: "The server has reached its maximum number of sessions."}
,                 Bad_UserSignatureInvalid: { name:               'Bad_UserSignatureInvalid' , value:     87  ,description: "The user token signature is missing or invalid."}
,          Bad_ApplicationSignatureInvalid: { name:        'Bad_ApplicationSignatureInvalid' , value:     88  ,description: "The signature generated with the client certificate is missing or invalid."}
,                  Bad_NoValidCertificates: { name:                'Bad_NoValidCertificates' , value:     89  ,description: "The client did not provide at least one software certificate that is valid and meets the profile requirements for the server."}
,           Bad_IdentityChangeNotSupported: { name:         'Bad_IdentityChangeNotSupported' , value:    198  ,description: "The Server does not support changing the user identity assigned to the session."}
,            Bad_RequestCancelledByRequest: { name:          'Bad_RequestCancelledByRequest' , value:     90  ,description: "The request was cancelled by the client with the Cancel service."}
,                  Bad_ParentNodeIdInvalid: { name:                'Bad_ParentNodeIdInvalid' , value:     91  ,description: "The parent node id does not to refer to a valid node."}
,                  Bad_ReferenceNotAllowed: { name:                'Bad_ReferenceNotAllowed' , value:     92  ,description: "The reference could not be created because it violates constraints imposed by the data model."}
,                       Bad_NodeIdRejected: { name:                     'Bad_NodeIdRejected' , value:     93  ,description: "The requested node id was reject because it was either invalid or server does not allow node ids to be specified by the client."}
,                         Bad_NodeIdExists: { name:                       'Bad_NodeIdExists' , value:     94  ,description: "The requested node id is already used by another node."}
,                     Bad_NodeClassInvalid: { name:                   'Bad_NodeClassInvalid' , value:     95  ,description: "The node class is not valid."}
,                    Bad_BrowseNameInvalid: { name:                  'Bad_BrowseNameInvalid' , value:     96  ,description: "The browse name is invalid."}
,                 Bad_BrowseNameDuplicated: { name:               'Bad_BrowseNameDuplicated' , value:     97  ,description: "The browse name is not unique among nodes that share the same relationship with the parent."}
,                Bad_NodeAttributesInvalid: { name:              'Bad_NodeAttributesInvalid' , value:     98  ,description: "The node attributes are not valid for the node class."}
,                Bad_TypeDefinitionInvalid: { name:              'Bad_TypeDefinitionInvalid' , value:     99  ,description: "The type definition node id does not reference an appropriate type node."}
,                  Bad_SourceNodeIdInvalid: { name:                'Bad_SourceNodeIdInvalid' , value:    100  ,description: "The source node id does not reference a valid node."}
,                  Bad_TargetNodeIdInvalid: { name:                'Bad_TargetNodeIdInvalid' , value:    101  ,description: "The target node id does not reference a valid node."}
,         Bad_DuplicateReferenceNotAllowed: { name:       'Bad_DuplicateReferenceNotAllowed' , value:    102  ,description: "The reference type between the nodes is already defined."}
,                 Bad_InvalidSelfReference: { name:               'Bad_InvalidSelfReference' , value:    103  ,description: "The server does not allow this type of self reference on this node."}
,                   Bad_ReferenceLocalOnly: { name:                 'Bad_ReferenceLocalOnly' , value:    104  ,description: "The reference type is not valid for a reference to a remote server."}
,                       Bad_NoDeleteRights: { name:                     'Bad_NoDeleteRights' , value:    105  ,description: "The server will not allow the node to be deleted."}
,            Uncertain_ReferenceNotDeleted: { name:          'Uncertain_ReferenceNotDeleted' , value:    188  ,description: "The server was not able to delete all target references."}
,                   Bad_ServerIndexInvalid: { name:                 'Bad_ServerIndexInvalid' , value:    106  ,description: "The server index is not valid."}
,                        Bad_ViewIdUnknown: { name:                      'Bad_ViewIdUnknown' , value:    107  ,description: "The view id does not refer to a valid view node."}
,                 Bad_ViewTimestampInvalid: { name:               'Bad_ViewTimestampInvalid' , value:    201  ,description: "The view timestamp is not available or not supported."}
,                Bad_ViewParameterMismatch: { name:              'Bad_ViewParameterMismatch' , value:    202  ,description: "The view parameters are not consistent with each other."}
,                   Bad_ViewVersionInvalid: { name:                 'Bad_ViewVersionInvalid' , value:    203  ,description: "The view version is not available or not supported."}
,           Uncertain_NotAllNodesAvailable: { name:         'Uncertain_NotAllNodesAvailable' , value:    192  ,description: "The list of references may not be complete because the underlying system is not available."}
,              Good_ResultsMayBeIncomplete: { name:            'Good_ResultsMayBeIncomplete' , value:    186  ,description: "The server should have followed a reference to a node in a remote server but did not. The result set may be incomplete."}
,                    Bad_NotTypeDefinition: { name:                  'Bad_NotTypeDefinition' , value:    200  ,description: "The provided Nodeid was not a type definition nodeid."}
,           Uncertain_ReferenceOutOfServer: { name:         'Uncertain_ReferenceOutOfServer' , value:    108  ,description: "One of the references to follow in the relative path references to a node in the address space in another server."}
,                       Bad_TooManyMatches: { name:                     'Bad_TooManyMatches' , value:    109  ,description: "The requested operation has too many matches to return."}
,                      Bad_QueryTooComplex: { name:                    'Bad_QueryTooComplex' , value:    110  ,description: "The requested operation requires too many resources in the server."}
,                              Bad_NoMatch: { name:                            'Bad_NoMatch' , value:    111  ,description: "The requested operation has no match to return."}
,                        Bad_MaxAgeInvalid: { name:                      'Bad_MaxAgeInvalid' , value:    112  ,description: "The max age parameter is invalid."}
,              Bad_HistoryOperationInvalid: { name:            'Bad_HistoryOperationInvalid' , value:    113  ,description: "The history details parameter is not valid."}
,          Bad_HistoryOperationUnsupported: { name:        'Bad_HistoryOperationUnsupported' , value:    114  ,description: "The server does not support the requested operation."}
,             Bad_InvalidTimestampArgument: { name:           'Bad_InvalidTimestampArgument' , value:    189  ,description: "The defined timestamp to return was invalid."}
,                    Bad_WriteNotSupported: { name:                  'Bad_WriteNotSupported' , value:    115  ,description: "The server not does support writing the combination of value, status and timestamps provided."}
,                         Bad_TypeMismatch: { name:                       'Bad_TypeMismatch' , value:    116  ,description: "The value supplied for the attribute is not of the same type as the attribute's value."}
,                        Bad_MethodInvalid: { name:                      'Bad_MethodInvalid' , value:    117  ,description: "The method id does not refer to a method for the specified object."}
,                     Bad_ArgumentsMissing: { name:                   'Bad_ArgumentsMissing' , value:    118  ,description: "The client did not specify all of the input arguments for the method."}
,                 Bad_TooManySubscriptions: { name:               'Bad_TooManySubscriptions' , value:    119  ,description: "The server has reached its  maximum number of subscriptions."}
,               Bad_TooManyPublishRequests: { name:             'Bad_TooManyPublishRequests' , value:    120  ,description: "The server has reached the maximum number of queued publish requests."}
,                       Bad_NoSubscription: { name:                     'Bad_NoSubscription' , value:    121  ,description: "There is no subscription available for this session."}
,                Bad_SequenceNumberUnknown: { name:              'Bad_SequenceNumberUnknown' , value:    122  ,description: "The sequence number is unknown to the server."}
,                  Bad_MessageNotAvailable: { name:                'Bad_MessageNotAvailable' , value:    123  ,description: "The requested notification message is no longer available."}
,            Bad_InsufficientClientProfile: { name:          'Bad_InsufficientClientProfile' , value:    124  ,description: "The Client of the current Session does not support one or more Profiles that are necessary for the Subscription."}
,                       Bad_StateNotActive: { name:                     'Bad_StateNotActive' , value:    191  ,description: "The sub-state machine is not currently active."}
,                     Bad_TcpServerTooBusy: { name:                   'Bad_TcpServerTooBusy' , value:    125  ,description: "The server cannot process the request because it is too busy."}
,                Bad_TcpMessageTypeInvalid: { name:              'Bad_TcpMessageTypeInvalid' , value:    126  ,description: "The type of the message specified in the header invalid."}
,              Bad_TcpSecureChannelUnknown: { name:            'Bad_TcpSecureChannelUnknown' , value:    127  ,description: "The SecureChannelId and/or TokenId are not currently in use."}
,                   Bad_TcpMessageTooLarge: { name:                 'Bad_TcpMessageTooLarge' , value:    128  ,description: "The size of the message specified in the header is too large."}
,                Bad_TcpNotEnoughResources: { name:              'Bad_TcpNotEnoughResources' , value:    129  ,description: "There are not enough resources to process the request."}
,                     Bad_TcpInternalError: { name:                   'Bad_TcpInternalError' , value:    130  ,description: "An internal error occurred."}
,                Bad_TcpEndpointUrlInvalid: { name:              'Bad_TcpEndpointUrlInvalid' , value:    131  ,description: "The Server does not recognize the QueryString specified."}
,                   Bad_RequestInterrupted: { name:                 'Bad_RequestInterrupted' , value:    132  ,description: "The request could not be sent because of a network interruption."}
,                       Bad_RequestTimeout: { name:                     'Bad_RequestTimeout' , value:    133  ,description: "Timeout occurred while processing the request."}
,                  Bad_SecureChannelClosed: { name:                'Bad_SecureChannelClosed' , value:    134  ,description: "The secure channel has been closed."}
,            Bad_SecureChannelTokenUnknown: { name:          'Bad_SecureChannelTokenUnknown' , value:    135  ,description: "The token has expired or is not recognized."}
,                Bad_SequenceNumberInvalid: { name:              'Bad_SequenceNumberInvalid' , value:    136  ,description: "The sequence number is not valid."}
,           Bad_ProtocolVersionUnsupported: { name:         'Bad_ProtocolVersionUnsupported' , value:    190  ,description: "The applications do not have compatible protocol versions."}
,                   Bad_ConfigurationError: { name:                 'Bad_ConfigurationError' , value:    137  ,description: "There is a problem with the configuration that affects the usefulness of the value."}
,                         Bad_NotConnected: { name:                       'Bad_NotConnected' , value:    138  ,description: "The variable should receive its value from another variable, but has never been configured to do so."}
,                        Bad_DeviceFailure: { name:                      'Bad_DeviceFailure' , value:    139  ,description: "There has been a failure in the device/data source that generates the value that has affected the value."}
,                        Bad_SensorFailure: { name:                      'Bad_SensorFailure' , value:    140  ,description: "There has been a failure in the sensor from which the value is derived by the device/data source."}
,                         Bad_OutOfService: { name:                       'Bad_OutOfService' , value:    141  ,description: "The source of the data is not operational."}
,                Bad_DeadbandFilterInvalid: { name:              'Bad_DeadbandFilterInvalid' , value:    142  ,description: "The deadband filter is not valid."}
, Uncertain_NoCommunicationLastUsableValue: { name: 'Uncertain_NoCommunicationLastUsableValue' , value:    143  ,description: "Communication to the data source has failed. The variable value is the last value that had a good quality."}
,                Uncertain_LastUsableValue: { name:              'Uncertain_LastUsableValue' , value:    144  ,description: "Whatever was updating this value has stopped doing so."}
,                Uncertain_SubstituteValue: { name:              'Uncertain_SubstituteValue' , value:    145  ,description: "The value is an operational value that was manually overwritten."}
,                   Uncertain_InitialValue: { name:                 'Uncertain_InitialValue' , value:    146  ,description: "The value is an initial value for a variable that normally receives its value from another variable."}
,              Uncertain_SensorNotAccurate: { name:            'Uncertain_SensorNotAccurate' , value:    147  ,description: "The value is at one of the sensor limits."}
,       Uncertain_EngineeringUnitsExceeded: { name:     'Uncertain_EngineeringUnitsExceeded' , value:    148  ,description: "The value is outside of the range of values defined for this parameter."}
,                      Uncertain_SubNormal: { name:                    'Uncertain_SubNormal' , value:    149  ,description: "The value is derived from multiple sources and has less than the required number of Good sources."}
,                       Good_LocalOverride: { name:                     'Good_LocalOverride' , value:    150  ,description: "The value has been overridden."}
,                    Bad_RefreshInProgress: { name:                  'Bad_RefreshInProgress' , value:    151  ,description: "This Condition refresh failed, a Condition refresh operation is already in progress."}
,             Bad_ConditionAlreadyDisabled: { name:           'Bad_ConditionAlreadyDisabled' , value:    152  ,description: "This condition has already been disabled."}
,              Bad_ConditionAlreadyEnabled: { name:            'Bad_ConditionAlreadyEnabled' , value:    204  ,description: "This condition has already been enabled."}
,                    Bad_ConditionDisabled: { name:                  'Bad_ConditionDisabled' , value:    153  ,description: "Property not available, this condition is disabled."}
,                       Bad_EventIdUnknown: { name:                     'Bad_EventIdUnknown' , value:    154  ,description: "The specified event id is not recognized."}
,              Bad_EventNotAcknowledgeable: { name:            'Bad_EventNotAcknowledgeable' , value:    187  ,description: "The event cannot be acknowledged."}
,                      Bad_DialogNotActive: { name:                    'Bad_DialogNotActive' , value:    205  ,description: "The dialog condition is not active."}
,                Bad_DialogResponseInvalid: { name:              'Bad_DialogResponseInvalid' , value:    206  ,description: "The response is not valid for the dialog."}
,          Bad_ConditionBranchAlreadyAcked: { name:        'Bad_ConditionBranchAlreadyAcked' , value:    207  ,description: "The condition branch has already been acknowledged."}
,      Bad_ConditionBranchAlreadyConfirmed: { name:    'Bad_ConditionBranchAlreadyConfirmed' , value:    208  ,description: "The condition branch has already been confirmed."}
,              Bad_ConditionAlreadyShelved: { name:            'Bad_ConditionAlreadyShelved' , value:    209  ,description: "The condition has already been shelved."}
,                  Bad_ConditionNotShelved: { name:                'Bad_ConditionNotShelved' , value:    210  ,description: "The condition is not currently shelved."}
,               Bad_ShelvingTimeOutOfRange: { name:             'Bad_ShelvingTimeOutOfRange' , value:    211  ,description: "The shelving time not within an acceptable range."}
,                               Bad_NoData: { name:                             'Bad_NoData' , value:    155  ,description: "The server cannot retrieve a bound for the variable."}
,                             Bad_DataLost: { name:                           'Bad_DataLost' , value:    157  ,description: "Data is missing due to collection started/stopped/lost."}
,                      Bad_DataUnavailable: { name:                    'Bad_DataUnavailable' , value:    158  ,description: "Expected data is unavailable for the requested time range due to an un-mounted volume, an off-line archive or tape, or similar reason for temporary unavailability."}
,                          Bad_EntryExists: { name:                        'Bad_EntryExists' , value:    159  ,description: "The data or event was not successfully inserted because a matching entry exists."}
,                        Bad_NoEntryExists: { name:                      'Bad_NoEntryExists' , value:    160  ,description: "The data or event was not successfully updated because no matching entry exists."}
,                Bad_TimestampNotSupported: { name:              'Bad_TimestampNotSupported' , value:    161  ,description: "The client requested history using a timestamp format the server does not support (i.e requested ServerTimestamp when server only supports SourceTimestamp)."}
,                       Good_EntryInserted: { name:                     'Good_EntryInserted' , value:    162  ,description: "The data or event was successfully inserted into the historical database."}
,                       Good_EntryReplaced: { name:                     'Good_EntryReplaced' , value:    163  ,description: "The data or event field was successfully replaced in the historical database."}
,                  Uncertain_DataSubNormal: { name:                'Uncertain_DataSubNormal' , value:    164  ,description: "The value is derived from multiple values and has less than the required number of Good values."}
,                              Good_NoData: { name:                            'Good_NoData' , value:    165  ,description: "No data exists for the requested time range or event filter."}
,                            Good_MoreData: { name:                          'Good_MoreData' , value:    166  ,description: "The data or event field was successfully replaced in the historical database."}
,                  Good_CommunicationEvent: { name:                'Good_CommunicationEvent' , value:    167  ,description: "The communication layer has raised an event."}
,                       Good_ShutdownEvent: { name:                     'Good_ShutdownEvent' , value:    168  ,description: "The system is shutting down."}
,                           Good_CallAgain: { name:                         'Good_CallAgain' , value:    169  ,description: "The operation is not finished and needs to be called again."}
,                  Good_NonCriticalTimeout: { name:                'Good_NonCriticalTimeout' , value:    170  ,description: "A non-critical timeout occurred."}
,                      Bad_InvalidArgument: { name:                    'Bad_InvalidArgument' , value:    171  ,description: "One or more arguments are invalid."}
,                   Bad_ConnectionRejected: { name:                 'Bad_ConnectionRejected' , value:    172  ,description: "Could not establish a network connection to remote server."}
,                           Bad_Disconnect: { name:                         'Bad_Disconnect' , value:    173  ,description: "The server has disconnected from the client."}
,                     Bad_ConnectionClosed: { name:                   'Bad_ConnectionClosed' , value:    174  ,description: "The network connection has been closed."}
,                         Bad_InvalidState: { name:                       'Bad_InvalidState' , value:    175  ,description: "The operation cannot be completed because the object is closed, uninitialized or in some other invalid state."}
,                          Bad_EndOfStream: { name:                        'Bad_EndOfStream' , value:    176  ,description: "Cannot move beyond end of the stream."}
,                      Bad_NoDataAvailable: { name:                    'Bad_NoDataAvailable' , value:    177  ,description: "No data is currently available for reading from a non-blocking stream."}
,                   Bad_WaitingForResponse: { name:                 'Bad_WaitingForResponse' , value:    178  ,description: "The asynchronous operation is waiting for a response."}
,                   Bad_OperationAbandoned: { name:                 'Bad_OperationAbandoned' , value:    179  ,description: "The asynchronous operation was abandoned by the caller."}
,                Bad_ExpectedStreamToBlock: { name:              'Bad_ExpectedStreamToBlock' , value:    180  ,description: "The stream did not return all data requested (possibly because it is a non-blocking stream)."}
,                           Bad_WouldBlock: { name:                         'Bad_WouldBlock' , value:    181  ,description: "Non blocking behaviour is required and the operation would block."}
,                          Bad_SyntaxError: { name:                        'Bad_SyntaxError' , value:    182  ,description: "A value had an invalid syntax."}
,                Bad_MaxConnectionsReached: { name:              'Bad_MaxConnectionsReached' , value:    183  ,description: "The operation could not be finished because all available connections are in use."}

};
