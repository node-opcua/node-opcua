# Supported Features

## OPC UA Services

| __**Service**__             |                          |                    |
|-----------------------------|-----------------------|---------------------------|
|  Discovery Service Set     |                        |         |
|                            |FindServers()           |  :white_check_mark:       |
|                            |GetEndpoints()          |  :white_check_mark:       |
|                            |RegisterServer()        |  :white_check_mark:       |
|                            |RegisterServer2()       |  :white_check_mark:       |
|                            |FindServersOnNetwork()  |  :white_check_mark:       |
| Secure Channel Service Set |                        |         |
|                            |OpenSecureChannel()     |  :white_check_mark:       |
|                            |CloseSecureChannel()    |  :white_check_mark:       |
| Session Service Set        |                        |         |
|                            |CreateSession()         |  :white_check_mark:       |
|                            |CloseSession()          |  :white_check_mark:       |
|                            |ActivateSession()       |  :white_check_mark:       |
|                            |Cancel()                |         |
| View Service Set           |                        |         |
|                            |Browse()                |  :white_check_mark:       |
|                            |BrowseNext()            |  :white_check_mark:       |
|                            |TranslateBrowsePathsToNodeIds() | :white_check_mark:|
|                            |RegisterNodes()                 | :white_check_mark:|
|                            |UnregisterNodes()      |:white_check_mark:|
| Attribute Service Set      |                       ||
|                            |Read()                 |:white_check_mark:|
|                            |Write()                |:white_check_mark:|
|                            |HistoryRead()          |:waxing_crescent_moon:|
|                            |HistoryUpdate()        |:waxing_crescent_moon:|
|MonitoredItems Service Set  |                       ||
|                            |CreateMonitoredItems() |:white_check_mark:|
|                            |ModifyMonitoredItems() |:white_check_mark:|
|                            |SetMonitoringMode()    |:white_check_mark:|
|                            |SetTriggering()        |:new_moon:|
|                            |DeleteMonitoredItems() |:white_check_mark:|
|Subscription Service Set    |                       ||
|                            |CreateSubscription()   |:white_check_mark:|
|                            |ModifySubscription()   |:white_check_mark:|
|                            |DeleteSubscriptions()  |:white_check_mark:|
|                            |Publish()              |:white_check_mark:|
|                            |Republish()            |:white_check_mark:|
|                            |TransferSubscriptions()|:white_check_mark:|
|Node Management Service Set |                       ||
|                            |AddNodes()             |:new_moon:|
|                            |AddReferences()        |:new_moon:|
|                            |DeleteNodes()          |:new_moon:|
|                            |DeleteReferences()     |:new_moon:|
|Query Service Set           |                       ||
|                            |QueryFirst()           |:new_moon:|
|                            |QueryNext()            |:new_moon:|
| PubSUB                     | as a commercial module |:white_check_mark:|
| GDS                        | as a commercial module |:white_check_mark:|


## Transport, Security & Profiles

|                                        |                          |                    |
|----------------------------------------|:------------------------:|--------------------|
| __**Transport Protocol**__             |                          |                    |
| **Transport**                          | **Status**               | **Comment**        |
| UA-TCP UA-SC UA Binary                 |  :white_check_mark:      | OPC.TCP - Binary   |          
| SOAP-HTTP WS-SC UA Binary              |  :new_moon:              | HTTP/HTTPS - Binary|               
| SOAP-HTTP WS-SC UA XML                 |  :new_moon:              |                    |               
| SOAP-HTTP WS-SC UA XML-UA Binary       |  :new_moon:              |                    |               
| __**Security Policies**__              |                          |                    |
| **Policy**                             | **Status**               | **Comment**        |
| None                                   | :white_check_mark:       |                    |               
| Basic128Rsa15                          | :white_check_mark:       | deprecated in 1.04 |               
| Basic256                               | :white_check_mark:       | deprecated in 1.04 |               
| Basic256Sha256                         | :white_check_mark:       |                    |               
| **Authentication**                     | **Status**               | **Comment**        |
| Anonymous                              |:white_check_mark:        |                    |
| User Name Password                     |:white_check_mark:        |                    |
| X509 Certificate                       |:white_check_mark:        |                    |
| __**client facets**__                  |                          |                    |
| Base Client Behaviour                  |:white_check_mark:       | |
| AddressSpace Lookup                    |:white_check_mark:       | |
| Attribute Read                         |:white_check_mark:       | |
| DataChange Subscription                |:white_check_mark:       | |
| DataAccess                             |:white_check_mark:       | |
| Discovery                              |:white_check_mark:       | |
| Event Subscription                     |:white_check_mark:       | |
| Method call                            |:white_check_mark:       | |
| Historical Access                      |:first_quarter_moon:     | |
| Advanced Type                          |:white_check_mark:       | |
| Programming                            |:new_moon:               | |
| Auditing                               |:first_quarter_moon:               | |
| Redundancy                             |:new_moon:               |Sponsors wanted |
| __**server profiles**__                |                         | |
| Core Server                            | :white_check_mark:      | |
| Data Access Server                     | :white_check_mark:      | |
| Embedded Server                        | :white_check_mark:      | |
| Nano Embedded Device Server            | :white_check_mark:      | |
| Micro Embedded Device Server           | :white_check_mark:      | |
| Standard DataChange Subscription Server| :white_check_mark:                         | |
| Standard Event Subscription Server     | :white_check_mark:                         | |
| Standard UA Server                     | :white_check_mark:                         | |
| Redundancy Transparent Server          | :new_moon:              |Sponsors wanted |
| Redundancy Visible Server              | :new_moon:              |Sponsors wanted |
| Node Management Server                 | :new_moon:              |Sponsors wanted |
| Auditing Server                        | :first_quarter_moon:   | |
| Complex Type Server                    | :white_check_mark:                        |(sponsored) |
| Session Diagnostics                    |  :white_check_mark:                         | (sponsored)|
| Subscription Diagnostics               |  :white_check_mark:                         | (sponsored)|
| Alarms & Conditions                    |  :white_check_mark:                         | (sponsored)|
| Pub & Sub                              |  :new_moon:                         |Sponsors wanted |
