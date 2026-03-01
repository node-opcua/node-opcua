npx -y c8 --all node -r source-map-support/register --max_old_space_size=8192 ./packages/run_all_mocha_tests.js
npx -y c8 report --reporter=lcov --reporter=html
start ./coverage/index.html
