node-opcua
==========

node-opcua is a full OPC UA stack for NodeJS and the Browser written in Typescript.

[![NPM version](https://img.shields.io/npm/v/node-opcua)](https://img.shields.io/npm/v/node-opcua)
[![Node.js CI](https://github.com/node-opcua/node-opcua/actions/workflows/workflow.yml/badge.svg)](https://github.com/node-opcua/node-opcua/actions/workflows/workflow.yml)
[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lernajs.io/)
[![Coverage Status](https://img.shields.io/coverallsCoverage/github/node-opcua/node-opcua)](https://coveralls.io/r/node-opcua/node-opcua)
[![Gitter chat](https://img.shields.io/gitter/room/node-opcua/node-opcua
)](https://gitter.im/node-opcua/node-opcua)
[![The Book](https://img.shields.io/static/v1?label=the%20book&message=NodeOPCUA%20by%20example&color=blueviolet&logo=leanpub)](https://leanpub.com/node-opcuabyexample-edition2022)

[![NPM download - server](https://img.shields.io/npm/dm/node-opcua.svg?logo=npm&label=node-opcua-server)](https://www.npmtrends.com/node-opcua-server)
[![NPM download - server -total](https://img.shields.io/npm/dt/node-opcua.svg?label=total)](https://www.npmtrends.com/node-opcua-server)
 
[![NPM download - client](https://img.shields.io/npm/dm/node-opcua-client.svg?logo=npm&label=node-opcua-client)](https://www.npmtrends.com/node-opcua-client)
[![NPM download - client -total](https://img.shields.io/npm/dt/node-opcua-client.svg?label=total)](https://www.npmtrends.com/node-opcua-client)


[Node-opcua](https://node-opcua.github.io/) is the OPC-UA stack running on NodeJS.

Why NodeJS ?

Because NodeJs is a great framework to design high-performing asynchronous applications.


## Getting started

### installing node-opcua as a node package

    $ mkdir mytest
    $ cd mytest
    $ npm init 
    $ npm install node-opcua --unsafe-perms
    $ # create your first app.js file!


### installing node-opcua samples as a node package

```shell
$ mkdir myserver
$ cd myserver
$ npm init
$ npm install node-opcua-samples --unsafe-perms
$ ./node_modules/.bin/simple_server
```   

or
    
```shell
$ ./node_modules/.bin/simple_client  -e "opc.tcp://opcserver.mAutomation.net:4841" -n="ns=1;s=EVR2.system.RTC_SEC"
```
or 

```shell
$ ./node_modules/.bin/simple_client  -e "opc.tcp://opcuademo.sterfive.com:26543" 
```


## Minimum nodejs requirement 

  * nodejs version 14 or above

                
## tutorials and guided examples


[![The Book](https://img.shields.io/static/v1?label=the%20book&message=NodeOPCUA%20by%20example&color=blueviolet&logo=leanpub)](https://leanpub.com/node-opcuabyexample-edition2022).  This book provides a large number of practical and ready-to-use and fully documented examples. It's the best starting point to learn about node-opcua.

## Sponsors & Backers 

The funding of node-opcua enterily relies on its users.  
We appreciate that, once you have evaluated the software and you have decided to use it in one of your applications, you consider supporting our effort by either financially contributing to one of our sponsor programs:

  - https://github.com/sponsors/node-opcua
  - https://opencollective.com/node-opcua

Grants ensure the following:

- 🔨 Long-term maintenance of the project
- ⚙️ maintain the website and continuous integration platform
- 🛣  Progress on the road-map
- 🐛 Quick responses to bug reports
- 🚀 New features & enhancements
- ⚖️ representing the node-opcua user community at the OPC Foundation
 

## Sponsors

<a href="https://opencollective.com/node-opcua/donate" target="_blank">
  <img src="https://opencollective.com/node-opcua/donate/button@2x.png?color=blue" width=300 />
</a>

<a href="https://opencollective.com/node-opcua/sponsor/0/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/0/avatar.svg"></a>
<a href="https://opencollective.com/node-opcua/sponsor/1/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/1/avatar.svg"></a>
<a href="https://opencollective.com/node-opcua/sponsor/2/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/2/avatar.svg"></a>
<a href="https://opencollective.com/node-opcua/sponsor/3/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/3/avatar.svg"></a>
<a href="https://opencollective.com/node-opcua/sponsor/4/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/4/avatar.svg"></a>
<a href="https://opencollective.com/node-opcua/sponsor/5/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/5/avatar.svg"></a>
<a href="https://opencollective.com/node-opcua/sponsor/6/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/6/avatar.svg"></a>
<a href="https://opencollective.com/node-opcua/sponsor/7/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/7/avatar.svg"></a>
<a href="https://opencollective.com/node-opcua/sponsor/8/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/8/avatar.svg"></a>
<a href="https://opencollective.com/node-opcua/sponsor/9/website" target="_blank"><img src="https://opencollective.com/node-opcua/sponsor/9/avatar.svg"></a>


## Backers

Thank you to all our backers! [Become a backer](https://opencollective.com/node-opcua#backer)

<img src=https://opencollective.com/node-opcua/tiers/badge.svg>

<a href="https://opencollective.com/node-opcua#backers" target="_blank"><img src="https://opencollective.com/node-opcua/tiers/backer.svg?width=890"></a>


## Contributors

This project exists thanks to all the people who contribute. 
<img src="https://opencollective.com/node-opcua/contributors.svg?width=890&button=true" /></a>


## Getting professional support

To get professional support, consider subscribing to the node-opcua membership community:

[![Professional Support](https://img.shields.io/static/v1?style=for-the-badge&label=Professional&message=Support&labelColor=blue&color=green&logo=data:image/svg%2bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB2ZXJzaW9uPSIxLjEiIGlkPSJMYXllcl8xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDQ5MS41MiA0OTEuNTIiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDQ5MS41MiA0OTEuNTI7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4NCjxnPg0KCTxnPg0KCQk8cGF0aCBkPSJNNDg3Ljk4OSwzODkuNzU1bC05My4xMDktOTIuOTc2Yy00LjgxMy00LjgwNi0xMi42NDItNC42NzQtMTcuMjczLDAuMzA3Yy03LjE0OCw3LjY4OS0xNC42NCwxNS41NTQtMjEuNzMsMjIuNjM0ICAgIGMtMC4yNzEsMC4yNy0wLjUwMSwwLjQ5My0wLjc2MywwLjc1NUw0NjcuMyw0MzIuNTA0YzguOTEtMTAuNjE0LDE2LjY1Ny0yMC40MSwyMS43My0yNi45NyAgICBDNDkyLjcyLDQwMC43NjIsNDkyLjI1NywzOTQuMDE5LDQ4Ny45ODksMzg5Ljc1NXoiLz4NCgk8L2c+DQo8L2c+DQo8Zz4NCgk8Zz4NCgkJPHBhdGggZD0iTTMzNC4zLDMzNy42NjFjLTM0LjMwNCwxMS4zNzktNzcuNTYsMC40MTMtMTE0LjU1NC0yOS41NDJjLTQ5LjAyMS0zOS42OTMtNzUuOTcyLTEwMi42NDItNjUuODM4LTE1MC41OTNMMzcuNjM0LDQxLjQxOCAgICBDMTcuNjUzLDU5LjQyNCwwLDc4LjU0NSwwLDkwYzAsMTQxLjc1MSwyNjAuMzQ0LDQxNS44OTYsNDAxLjUwMyw0MDAuOTMxYzExLjI5Ni0xLjE5OCwzMC4xNzYtMTguNjUxLDQ4LjA2Mi0zOC4xNjdMMzM0LjMsMzM3LjY2MSAgICB6Ii8+DQoJPC9nPg0KPC9nPg0KPGc+DQoJPGc+DQoJCTxwYXRoIGQ9Ik0xOTMuODU0LDk2LjA0MUwxMDEuMjEzLDMuNTNjLTQuMjI1LTQuMjItMTAuODgyLTQuNzI0LTE1LjY2NC0xLjE0NWMtNi42NTQsNC45ODMtMTYuNjQ4LDEyLjY1MS0yNy40NTMsMjEuNDk4ICAgIGwxMTEuOTQ1LDExMS43ODVjMC4wNjEtMC4wNiwwLjExMS0wLjExMywwLjE3Mi0wLjE3NGM3LjIzOC03LjIyOCwxNS4zNTUtMTQuODg1LDIzLjI5MS0yMi4xNjcgICAgQzE5OC41MzQsMTA4LjcxMywxOTguNjg0LDEwMC44NjMsMTkzLjg1NCw5Ni4wNDF6Ii8+DQoJPC9nPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPGc+DQo8L2c+DQo8Zz4NCjwvZz4NCjxnPg0KPC9nPg0KPC9zdmc+)](https://support.sterfive.com)

Registered members have access to an extended set of online documentation. 

Registered members can post and query Sterfive for any question related to NodeOPCUA in a private chat room. 

or contact [sterfive](https://www.sterfive.com) for dedicated consulting and more advanced support or for a certified version of node-opcua. (contact@sterfive.com).


## Road-map

If your company would like to participate and influence the development of future versions of node-opcua please contact [sterfive](mailto:contact@sterfive.com).

Those are the items we would like to achieve in the next version of the API.
  
  * improved documentation 
  * Compliance testing and certification (CTT) 
  * Pub-sub support 
  * support for redundancy
  * session-less transactions
  * WebSocket transport
  * JTokens and OAuth
  * reversed connection
  * more tutorials

## Advanced topics

### installing node-opcua from source

#### running the demo server from source

     $ git clone https://github.com/node-opcua/node-opcua.git
     $ cd node-opcua
     $ npm install -g pnpm 
     $ pnpm recursive install
     $ pnpm build
     $ node packages/node-opcua-samples/bin/simple_server
    
#### running the demo client from source

     $ git clone https://github.com/node-opcua/node-opcua.git
     $ cd node-opcua
     $ npm install -g pnpm 
     $ pnpm recursive install
     $ pnpm build
     $ node packages/node-opcua-samples/bin/simple_client.js -e "opc.tcp://opcserver.mAutomation.net:4841" -n="ns=1;s=EVR2.system.RTC_SEC"
        


### Tutorials

 * [create a server](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_server.md)
 * [create a client in typescript](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_client_typescript.md)
   
  *  more tutorials are available in the book (https://leanpub.com/node-opcuabyexample-edition2022)
  *  more advanced examples and training material are available for the NodeOPCUA Subscription members at (https://support.sterfive.com)

### API reference
 * check out the [API documentation](https://node-opcua.github.io/api_doc/index.html)

                     
## Contributing

    $ git clone git://github.com/node-opcua/node-opcua.git
    $ cd node-opcua
    $ npm install -g pnpm 
    $ pnpm install
    $ pnpm recursive install
    $ pnpm build
 

[![NPM](https://nodei.co/npm/node-opcua.png?downloads=true&stars=true)](https://nodei.co/npm/node-opcua/)

[![Project Stats](https://www.openhub.net/p/713850/widgets/project_thin_badge.gif)](https://www.openhub.net/p/node-opcua)



## Supported Features


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




## Feedback

  * if you're using node-opcua in one of your project, please feel free to leave a comment and a quick description in the [wiki](https://github.com/node-opcua/node-opcua/wiki)
  
  * if you have a particular wish or found a issue, let us known and [create an issue](https://github.com/node-opcua/node-opcua/issues?state=open)


## About licensing 

The node-opcua core module is [copyrighted and licenced under the term of the "The MIT License"](./LICENSE). 

This means that :
- node-opcua comes without any warranty of any kind.
- you can freely reuse in an open-source application or a commercial application 
- you have to clearly include the software copyright notice in all copies or substantial portions of the software.

You are strongly encourage to apply to our [NodeOPCUA Membership](https://support.sterfive.com) to get additional benefits and support.


## Copyright

Copyright (c) 2022-2023 Sterfive SAS - 833264583 RCS ORLEANS - France (https://www.sterfive.com)

Copyright (c) 2014-2022 Etienne Rossignon
