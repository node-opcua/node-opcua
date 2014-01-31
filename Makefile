test-cov: istanbul

istanbul:
	istanbul cover _mocha -- -R spec test

coveralls:
	cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js

