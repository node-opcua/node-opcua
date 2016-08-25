
version 0.41
============

call service:
-------------

  - #25 add Call service support on client and server
  - #25 add engine.addMethod so that new method can be added to the address space

subscription service:
---------------------

  - implement SetMonitoringMode Request/Response
  - fixes RepublishResponse behavior on server
  - make sure monitoredItem timer func is not called if timer has been shutdown
  - #25 implement GetMonitoredItems method on Server Object

session service:
----------------

  - add ability to restrict number of concurrent sessions on server.
 -  make sure running sessions are automatically discarded after the timeout period has been reached without any activity from the client. (sessionTimeout)

read service:
-------------

  - #34, #35 Add asynchronous value read/write capability on server side

data access:
------------

  - start implementation of DataAccess (Part 8)
  - add some standard units for EUInformation
  - AxisInformation
  - add addAnalogDataItem to create DA node in address space

usability:
----------

  - #48  provides a way to pass specify serverInfo and buildInfo as options to OPCUAServer
  - #50 add flexible ways to specify typeDefinition and dataType in engine.addressSpace.addVariable
  - expose transactionCount Variables on VendorServerInfo
  - expose bytesWritten and bytesRead Variables on VendorServerInfo
  - use fully qualified domain name (fqdn), whenever possible, to build default endpoint urn instead of hostname only.
  - #40, set timeoutHint to non zero value to cope with servers that wrongly assume that timeoutHint =0 is 0s ( instead of 'no timeout' as per spec)

bug fixing
----------

  - fix various issues with secure connection
  - fix issue in TranslateBrowsePath
  - #42 GUID : permit lower case letters in GUID strings
  - fix high low inversion in Int64 encoding
  - #36 handle HEL messages received by server that are received in small chunks
  - #36 handle samplingInterval === -1 in CreateMonitoredItem Request


Contributors:
-------------

* special thanks to limjunliang, longtranphu2006, paragonRobotics, Diti24, yping, anson2004, Jochen1980, MackyNacky


version 0.40
============

  - #17 add support for Sign and Encrypt
  - #17 add ability for server to specify which endpoint to expose
  - #20 fix nodecrawler missing resultMask
  - #21 Add the ability to handle a specific source timestamp on variable
  - #23 clamp monitored item samplingInterval
  - #24 ServerSecureChannelLayer timeout between message was too short and is now be configurable

Contributors:
-------------

* special thanks: trongtin, ChrisJansson ,VincentGijsen, longtranphu2006


