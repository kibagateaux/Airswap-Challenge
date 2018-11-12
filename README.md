![Challenge overview](https://photos.app.goo.gl/oaz7zgJmpyBRm45t9)

`mkdir airswap-challenge && cd airswap-challenge && touch index.js package.json`

Copy in files

`npm install`

`npm i -g` inside `airswap-challenge/` which should install CLI globally

`kiba ethbtc binance` should start program

if you get error saying "kiba not found" 
  run `node ./index.js ethbtc binance`
  
Final output should look like :
11/7, 5:05:36 PM  -  BTCUSDT 1m avg is: 6541.94593220

Bitfinex API will return 429 after a while even on 2 second intervals
Binance API will continue running no matter what
