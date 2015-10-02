

REM make sure to install  browserify and  minifyjs
REM   npm i -g browserify  minifyjs

SET OPTIONS=--mangle toplevel --reserved '$,require,exports'  --comments  --preamble "// * Copyright 2014-2015 NodeOPCUA"
SET "NODE_PATH=%CD%"

MKDIR dist
REM CALL browserify  --bare bin\simple_server.js --exclude usage --exclude memcpy --exclude node-expat --exclude ursa --exclude x509  --list
CALL browserify  --bare bin\simple_server.js --exclude usage --exclude memcpy --exclude node-expat --exclude ursa --exclude x509 > tmp\tmp.js
cat tmp\tmp.js  | minifyjs %OPTIONS% -m -o dist/simple_server.min.js

REM   you can now launch the standalone version of simple_server
REM      node dist/simple_server.min.js

