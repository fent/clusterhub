find test -name "*-test.js" | \
  grep -o -E "\/([^\.]+)" | \
  xargs -I {} -n 1 sh -c 'export f="{}"; \
  istanbul cover --report json --dir coverage/each${f} --print none node_modules/.bin/_mocha -- test${f}.js'
istanbul report --root coverage/each --dir coverage/full lcov
istanbul report --root coverage/each text-summary
