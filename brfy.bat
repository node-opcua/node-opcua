SET OPTIONS=--mangle toplevel --reserved '$,require,exports'  --comments  --preamble "// * Copyright 2014-2015 NodeOPCUA"
SET "NODE_PATH=%CD%"

MKDIR dist
REM CALL browserify  --bare bin\simple_server.js --exclude usage --exclude node-expat --exclude ursa --exclude x509  --list
CALL browserify  --bare bin\simple_server.js --exclude usage --exclude node-expat --exclude ursa --exclude x509 > tmp\tmp.js
cat tmp\tmp.js  | minifyjs %OPTIONS% -m -o dist/simple_server.min.js
