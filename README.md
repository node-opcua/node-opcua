node-opcua
==========

an implementation of a OPC UA stack fully written in javascript and nodejs

[![NPM download](https://img.shields.io/npm/dm/node-opcua.svg)](http://www.npm-stats.com/~packages/node-opcua)
[![NPM version](https://badge.fury.io/js/node-opcua.png)](http://badge.fury.io/js/node-opcua)
[![Build Status](https://travis-ci.org/node-opcua/node-opcua.png?branch=master)](https://travis-ci.org/node-opcua/node-opcua)
[![Build status](https://ci.appveyor.com/api/projects/status/8sgtm3n15aii98oc/branch/master?svg=true)](https://ci.appveyor.com/project/erossignon/node-opcua/branch/master)

[![Dependency Status](https://gemnasium.com/node-opcua/node-opcua.png)](https://gemnasium.com/node-opcua/node-opcua)
[![Coverage Status](https://coveralls.io/repos/node-opcua/node-opcua/badge.png)](https://coveralls.io/r/node-opcua/node-opcua)
[![Code Climate](https://codeclimate.com/github/node-opcua/node-opcua.png)](https://codeclimate.com/github/node-opcua/node-opcua)

[![OPC UA](http://b.repl.ca/v1/OPC-UA-blue.png)](http://opcfoundation.org/)


[![Gitter chat](https://badges.gitter.im/node-opcua/node-opcua.png)](https://gitter.im/node-opcua/node-opcua)

[Node-opcua](http://node-opcua.github.io/) is an full OPC-UA stack written in NodeJS.

[![Flattr us](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?fid=me93y1&url=https%3A%2F%2Fgithub.com%2Fnode-opcua%2Fnode-opcua&title=Node-OPCUA&language=nodejs&tags=github&category=software).

Why NodeJS ?

Because nodeJs is a great framework to design asynchronous application.


Getting started
================

installing node-opcua
---------------------

    $ npm install node-opcua


running the demo server
-----------------------

    $ git clone https://github.com/node-opcua/node-opcua.git
    $ cd node-opcua
    $ npm install
    $ node bin/simple_server
    
running the demo client
-----------------------

    $ git clone https://github.com/node-opcua/node-opcua.git
    $ cd node-opcua
    $ npm install
    $ node bin/simple_client.js -e "opc.tcp://opcserver.mAutomation.net:4841" -n="ns=1;s=EVR2.system.RTC_SEC"
        
        
Tutorials
---------

 * [create a server](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_server.md)
 
 * [create a client](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_client.md)
   

API Documentation
----------------- 
   
 * check out the [API documentation](http://node-opcua.github.io/api_doc/index.html)
                                 
Contributing
============

    $ git clone git://github.com/node-opcua/node-opcua.git
    $ cd node-opcua
    $ npm install
    $ npm test

Supporting the project
======================



If you like the project, please [![Flattr us](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?fid=me93y1&url=https%3A%2F%2Fnode-opcua.github.io%2F&title=Node-OPCUA&language=nodejs&tags=github&category=software).
This will give us full of motivation to carry on and keep working on the roadmap.

[![NPM](https://nodei.co/npm/node-opcua.png?downloads=true&stars=true)](https://nodei.co/npm/node-opcua/)

[![Project Stats](https://www.ohloh.net/p/713850/widgets/project_thin_badge.gif)](https://www.ohloh.net/p/node-opcua)

               
## Supported Features


| __**Service**__             |                          |                    |
|-----------------------------|-----------------------|---------------------------|
|  Discovery Service Set     |                        |         |
|                            |FindServers()           |  :white_check_mark:       |
|                            |GetEndpoints()          |  :white_check_mark:       |
|                            |RegisterServer()        |  :white_check_mark:       |
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
|                            |TransferSubscriptions()|:waxing_crescent_moon:|
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
| Auditing                               |:new_moon:               | |
| Redundancy                             |:new_moon:               | |
| __**server profiles**__                |                         | |
| Core Server                            | :white_check_mark:      | |
| Data Access Server                     | :white_check_mark:      | |
| Embedded Server                        | :white_check_mark:      | |
| Nano Embedded Device Server            | :white_check_mark:      | |
| Micro Embedded Device Server           | :white_check_mark:      | |
| Standard DataChange Subscription Server|                         | |
| Standard Event Subscription Server     |                         | |
| Standard UA Server                     |                         | |
| Redundancy Transparent Server          | :new_moon:              | |
| Redundancy Visible Server              | :new_moon:              | |
| Node Management Server                 | :new_moon:              | |
| Auditing Server                        | :new_moon:              | |
| Complex Type Server                    |                         | |



Road-map
=========

This are the item we would like to achieve in the next version of the API.

  * improved documentation 
  * Compliance testing and certification (CTT) 
  * HA Support : supporting the historizing service
  * more tutorials


Feedback
========

  * if you're using node-opcua in one of your project, please feel free to leave a comment and a quick description in the [wiki](https://github.com/node-opcua/node-opcua/wiki)
  
  * if you have a particular wish or found a issue, let us known and [create an issue](https://github.com/node-opcua/node-opcua/issues?state=open)

