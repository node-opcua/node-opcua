test-cov: istanbul

istanbul:
	istanbul cover ./node_modules/mocha/bin/_mocha -- -R spec test --recursive

coveralls:
	cat ./coverage/lcov.info | ./node_modules/coveralls/bin/coveralls.js

