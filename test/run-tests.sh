rm -rf coverage/
istanbul cover --report json --dir coverage/each/master --print none \
  ./node_modules/.bin/_mocha -- -t 4000 test/*-test.js
istanbul report --root coverage/each --dir coverage/full lcov
istanbul report --root coverage text-summary
