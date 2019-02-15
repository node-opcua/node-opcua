node-opcua
==========

an implementation of a OPC UA stack fully written in javascript and nodejs


[![NPM download](https://img.shields.io/npm/dm/node-opcua.svg)](http://www.npm-stats.com/~packages/node-opcua)
[![NPM version](https://badge.fury.io/js/node-opcua.png)](http://badge.fury.io/js/node-opcua)
[![Build Status](https://travis-ci.org/node-opcua/node-opcua.png?branch=master)](https://travis-ci.org/node-opcua/node-opcua)
[![Build status](https://ci.appveyor.com/api/projects/status/8sgtm3n15aii98oc/branch/master?svg=true)](https://ci.appveyor.com/project/erossignon/node-opcua/branch/master)
[![HitCount](http://hits.dwyl.io/node-opcua/node-opcua.svg)](http://hits.dwyl.io/node-opcua/node-opcua)
<!-- [![NSP Status](https://nodesecurity.io/orgs/node-opcua/projects/cb2eff26-fb17-4d6b-ab89-7fafafdc88bc/badge)](https://nodesecurity.io/orgs/node-opcua/projects/cb2eff26-fb17-4d6b-ab89-7fafafdc88bc) -->
<!-- [![Dependency Status](https://gemnasium.com/node-opcua/node-opcua.png)](https://gemnasium.com/node-opcua/node-opcua) -->
[![Coverage Status](https://coveralls.io/repos/node-opcua/node-opcua/badge.png)](https://coveralls.io/r/node-opcua/node-opcua)
[![Code Climate](https://codeclimate.com/github/node-opcua/node-opcua.png)](https://codeclimate.com/github/node-opcua/node-opcua)

[![OPC UA](http://b.repl.ca/v1/OPC-UA-blue.png)](http://opcfoundation.org/)
[![Gitter chat](https://badges.gitter.im/node-opcua/node-opcua.png)](https://gitter.im/node-opcua/node-opcua)
[Node-opcua](http://node-opcua.github.io/) is an full OPC-UA stack written in NodeJS.


[![Flattr us](https://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/@gadz_er).

Why NodeJS ?

Because nodeJs is a great framework to design asynchronous application.


## Getting started

### installing node-opcua as a node package

    $ npm install node-opcua


### installing node-opcua samples as a node package

```shell
    $ npm install node-opcua-samples
    $ ./node_modules/.bin/simple_server
```   
   or
    
```shell
    $ ./node_modules/.bin/simple_client  -e "opc.tcp://opcserver.mAutomation.net:4841" -n="ns=1;s=EVR2.system.RTC_SEC"
```

### installing node-opcua from source


#### running the demo server from source

     $ git clone https://github.com/node-opcua/node-opcua.git
     $ cd node-opcua
     $ npm install
     $ node packages/node-opcua-samples/bin/simple_server
    
#### running the demo client from source

     $ git clone https://github.com/node-opcua/node-opcua.git
     $ cd node-opcua
     $ npm install
     $ node packages/node-opcua-samples/bin/simple_client.js -e "opc.tcp://opcserver.mAutomation.net:4841" -n="ns=1;s=EVR2.system.RTC_SEC"
        


### Tutorials


 * [create a server](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_server.md)
 
 * [create a client](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_client.md)
   

### API Documentation
   
 * check out the [API documentation](http://node-opcua.github.io/api_doc/index.html)
                
## Minimum nodejs requirement 

  * nodejs version 6.10 or above
                                  
## Contributing

    $ git clone git://github.com/node-opcua/node-opcua.git
    $ cd node-opcua
    $ npm install
    $ npm test

## Supporting the project

If you like the project, please 
[![Flattr us](https://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/@gadz_er).
This will give us full of motivation to carry on and keep working on the roadmap.

[![NPM](https://nodei.co/npm/node-opcua.png?downloads=true&stars=true)](https://nodei.co/npm/node-opcua/)

[![Project Stats](https://www.openhub.net/p/713850/widgets/project_thin_badge.gif)](https://www.openhub.net/p/node-opcua)


## Getting commercial support

To get commercial support,  please contact [sterfive](https://www.sterfive.com)
               
## Supported Features


| __**Service**__             |                          |                    |
|-----------------------------|-----------------------|---------------------------|
|  Discovery Service Set     |                        |         |
|                            |FindServers()           |  :white_check_mark:       |
|                            |GetEndpoints()          |  :white_check_mark:       |
|                            |RegisterServer()        |  :white_check_mark:       |
|                            |RegisterServer2()        |  :white_check_mark:       |
|                            |FindServersOnNetwork()        |  :white_check_mark:       |
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
| Basic128Rsa15                          | :white_check_mark:       |                    |               
| Basic256                               | :white_check_mark:       |                    |               
| Basic256Sha256                         | :white_check_mark:       |                    |               
| **Authentication**                     | **Status**               | **Comment**        |
| Anonymous                              |:white_check_mark:        |                    |
| User Name Password                     |:white_check_mark:        |                    |
| X509 Certificate                       |:new_moon:                |                    |
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
| Redundancy                             |:new_moon:               | |
| __**server profiles**__                |                         | |
| Core Server                            | :white_check_mark:      | |
| Data Access Server                     | :white_check_mark:      | |
| Embedded Server                        | :white_check_mark:      | |
| Nano Embedded Device Server            | :white_check_mark:      | |
| Micro Embedded Device Server           | :white_check_mark:      | |
| Standard DataChange Subscription Server| :white_check_mark:                         | |
| Standard Event Subscription Server     | :white_check_mark:                         | |
| Standard UA Server                     | :white_check_mark:                         | |
| Redundancy Transparent Server          | :new_moon:              | |
| Redundancy Visible Server              | :new_moon:              | |
| Node Management Server                 | :new_moon:              | |
| Auditing Server                        | :first_quarter_moon:   | |
| Complex Type Server                    | :first_quarter_moon:                        | |
| Session Diagnostics                    |  :white_check_mark:                         | |
| Subscription Diagnostics               |  :white_check_mark:                         | |
| Alarms & Conditions                    |  :white_check_mark:                         | |



## Road-map

This are the item we would like to achieve in the next version of the API.

  * improved documentation 
  * Compliance testing and certification (CTT) 
  * more tutorials


## Feedback

  * if you're using node-opcua in one of your project, please feel free to leave a comment and a quick description in the [wiki](https://github.com/node-opcua/node-opcua/wiki)
  
  * if you have a particular wish or found a issue, let us known and [create an issue](https://github.com/node-opcua/node-opcua/issues?state=open)

