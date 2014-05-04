#/bin/sh
BASEDIR=$(dirname $0)
echo ${BASEDIR}
cd ${BASEDIR}
../node_modules/literate-programming/bin/literate-programming.js  ./creating_a_server.md