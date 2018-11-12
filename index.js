#!/usr/bin/env node
const Binance = require('node-binance-api');
const BFX = require('bitfinex-api-node')

// Binance SDK init
const binance = new Binance().options({
  /* API credentials not needed, all ticker info is on public routes */
  APIKEY: '<key>', 
  APISECRET: '<secret>',
  useServerTime: true, // If you get timestamp errors, synchronize to server time at startup
  test: true, // If you want to use sandbox mode where orders are simulated
  reconnect: true // If you want to keep websocket connected  
});

//Bitfinex SDK init
const bfx = new BFX({
  /* API credentials not needed, all ticker info is on public routes */
  apiKey: '...',
  apiSecret: '...',
  ws: {
    autoReconnect: true,
    seqAudit: true,
    packetWDDelay: 1000
  }
});

// Constants
const BINANCE = "BINANCE";
const BITFINEX = "BITFINEX";

const validTickers = [
  "ETH",
  "BTC",
  "ETC",
  "LTC",
  "NEO",
  "EOS", // <= lol jk
  "USDT",
  "TRX" // <= also lol
];



// ut
const isValidTicker = (ticker = "") =>
  validTickers.indexOf(ticker) !== -1 ? true : false;

const isValidExchange = (exchange = "") =>
  validExchanges[exchange] !== undefined ? true : false;

let tickerStreams = {};
let sma = {}; // simple moving averages

const updateMovingAvg = (ticker) => {
  // pulls all api streams containing ticker
  const activeStreams = Object.keys(tickerStreams)
    .map((exchange) => tickerStreams[exchange][ticker] || []);

  const movingAvg = activeStreams.length
    ? activeStreams
      .map((stream) =>  stream.reduce((s, n) => n + s, 0) / stream.length) // moving avg on each exchange
      .reduce((s, avg) => s + avg, 0) / activeStreams.length  // avg the moving avgs
    : null;

  if(movingAvg) {
    sma[ticker] = movingAvg.toFixed(8); // shortens avg to 8th decimal place
    return movingAvg;
  } else {
    console.warn("No data provided to moving average tracker for " + ticker);
    return null;
  }
};


const printMovingAvgs = () => {
  Object.keys(sma).forEach((ticker) => {
    var dateOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    };
    const ts = new Date().toLocaleDateString("en-US", dateOptions)
    const movingAvg = sma[ticker];

    console.log('');
    console.log(ts + "  -  " + ticker + " 1m avg is: "  + movingAvg);
    console.log('');
  });
};


const onDataStream = (ticker, closePoint, exchange) => {
  if(ticker && closePoint && exchange) {
    const tickerStream = tickerStreams[exchange][ticker] || [];
    const updatedStream = [parseFloat(closePoint, 10), ...tickerStream].slice(0, 59);
    tickerStreams[exchange][ticker] = updatedStream;
    updateMovingAvg(ticker);
  }
}


const createBitfinexTracker = (ticker) => {
  if(tickerStreams[BITFINEX] === undefined) {
    tickerStreams[BITFINEX] = {};
  }
  tickerStreams[BITFINEX][ticker] = [];

  const ws = bfx.ws(2);
 
  ws.on('error', (err) => console.log(err));

  ws.on('open', () => {
    ws.auth.bind(ws);
    ws.subscribeTicker(ticker);
  });

  ws.onTicker({}, (data, event) => {
    onDataStream(ticker, data[2], BITFINEX)
  });

  ws.open();
  return {exchange: BITFINEX, listener: ws};
};

const createBinanceTracker = (ticker) => {
  if(tickerStreams[BINANCE] === undefined) {
    tickerStreams[BINANCE] = {};
  }
  tickerStreams[BINANCE][ticker] = [];

  const streamReader = (data) => {
    if(data && !data.error) {
      const {c : closePoint}  = data;
      onDataStream(ticker, closePoint, BINANCE);
    }
  };
  const stream =  binance.websockets.subscribe(
    `${(ticker).toLowerCase()}@miniTicker`,
    streamReader,
    binance.options.reconnect
  );

  return {exchange: BINANCE, listener: stream}
};

const validExchanges = {
  BINANCE: createBinanceTracker,
  BITFINEX: createBitfinexTracker
};


const trackTickers = (tickers = []) => {
  const [tix1, tix2] = tickers;
  if(isValidTicker(tix1) && isValidTicker(tix2)) {
    if(tix1 !== tix2) {
      sma[tix1 + tix2];
      setInterval(printMovingAvgs, 1000); // set outside of callback so only one per ticker instead of per exchange (all exchanges get aggregated together in updateMovingAvg)
      return (preferredExchange = "") => {
        const exchangeCode = preferredExchange.toUpperCase()
        const exchange = isValidExchange(exchangeCode) ? exchangeCode : BINANCE;
        console.log("Reading moving average of " + tix1+tix2 + " from " + exchange + ".....")
        return validExchanges[exchange] ? validExchanges[exchange](tix1 + tix2) : null;
      }
    } else {
      console.warn("Tickers must be different from each other");
      return {error: "Tickers must be different from each other. Try `kiba ETH/BTC [binance | bitfinex]`"};
    }
  } else {
    console.warn("Invalid tickers supplied");
    return {error: "Invalid tickers supplied. Try `kiba ETH/BTC [binance | bitfinex]`"};
  }
};



// parses command line arguments
// tickers must be passed in as single pair e.g. ETC/BTC


const [node, fs, tradingPair, ...exchanges] = process.argv;


if(tradingPair && exchanges.length) {
  const [_, ticker1 = "", ticker2 = ""] = tradingPair.match(/^(\w{3,4})\/?(\w{3,4})/);
  const tickers = [ticker1.toUpperCase(), ticker2.toUpperCase()];
  const tickerTracker = trackTickers(tickers);
  const exchangeListeners = exchanges
    .map(tickerTracker) // create data streams for ticker from exchanges
    .filter(n => (n && !(n || {}).error)); // filter null returns and errors
} else {
  console.log("Invalid Command - Add the symbol and exchange you want to track `kiba ETH/BTC [binance | bitfinex]`")
}

