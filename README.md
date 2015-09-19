node-opcua
==========

an implementation of a OPC UA stack fully written in javascript and nodejs

[![NPM download](https://img.shields.io/npm/dm/node-opcua.svg)](http://www.npm-stats.com/~packages/node-opcua)
[![NPM version](https://badge.fury.io/js/node-opcua.png)](http://badge.fury.io/js/node-opcua)
[![Build Status](https://travis-ci.org/node-opcua/node-opcua.png?branch=master)](https://travis-ci.org/node-opcua/node-opcua)
[![Build status](https://ci.appveyor.com/api/projects/status/8sgtm3n15aii98oc?svg=true)](https://ci.appveyor.com/project/erossignon/node-opcua)

[![Dependency Status](https://gemnasium.com/node-opcua/node-opcua.png)](https://gemnasium.com/node-opcua/node-opcua)
[![Coverage Status](https://coveralls.io/repos/node-opcua/node-opcua/badge.png)](https://coveralls.io/r/node-opcua/node-opcua)
[![Code Climate](https://codeclimate.com/github/node-opcua/node-opcua.png)](https://codeclimate.com/github/node-opcua/node-opcua)

[![OPC UA](http://b.repl.ca/v1/OPC-UA-blue.png)](http://opcfoundation.org/)


[![Gitter chat](https://badges.gitter.im/node-opcua/node-opcua.png)](https://gitter.im/node-opcua/node-opcua)

[Node-opcua](http://node-opcua.github.io/) is an full OPC-UA stack written in NodeJS.

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
    $ npm init
    $ node bin/simple_server
    
running the demo client
-----------------------

    $ git clone https://github.com/node-opcua/node-opcua.git
    $ cd node-opcua
    $ npm init
    $ node bin/simple_client.js -e "opc.tcp://opcserver.mAutomation.net:4841" -n="ns=1;s=EVR2.system.RTC_SEC"
        
        
Tutorials
---------

 * [create a server](http://node-opcua.github.io/create_a_server.html)
 
 * [create a client](https://github.com/node-opcua/node-opcua/blob/master/documentation/creating_a_client.md)
   

API Documentation
----------------- 
   
 * check out the [API documentation](http://node-opcua.github.io/api_doc/index.html)
                                 
Contributing
============

    $ git clone git://github.com/node-opcua/node-opcua.git node-opcua
    $ cd node-opcua
    $ npm install
    $ npm test

Supporting the project
======================

If you like the project, please [![Flattr us](http://api.flattr.com/button/flattr-badge-large.png)](https://flattr.com/submit/auto?user_id=gadz_er&url=https://node-opcua.github.io&title=Node-OPCUA&language=nodejs&tags=github&category=software).
This will give us full of motivation to carry on and keep working on the roadmap.

[![NPM](https://nodei.co/npm/node-opcua.png?downloads=true&stars=true)](https://nodei.co/npm/node-opcua/)

[![Project Stats](https://www.ohloh.net/p/713850/widgets/project_thin_badge.gif)](https://www.ohloh.net/p/node-opcua)
               

Road-map
=========

This are the item we would like to achieve in the next version of the API.

  * sign 
  * sign & encrypt
  * improved documentation 
  * Compliance testing and certification (CTT) 
  * HA Support : supporting the historizing service
  * more tutorials


Feedback
========

  * if you're using node-opcua in one of your project, please feel free to leave a comment and a quick description in the [wiki](https://github.com/node-opcua/node-opcua/wiki)
  
  * if you have a particular wish or found a issue, let us known and [create a issue](https://github.com/node-opcua/node-opcua/issues?state=open) 
  