<!--
//! adapted from https://github.com/interledger-rs/interledger-rs (Interledger.rs)
//! Copyright (c) 2018-2019 Evan Schwartz and contributors (licensed under the Apache License Version 2.0)
//! Copyright (c) 2017-2018 Evan Schwartz (licensed under the Apache License Version 2.0)
//! Modifications Copyright (c) 2018 - 2019 (licensed under the Apache License, Version 2.0)
-->
# Interledger with Ethereum and CRO On-Ledger Settlement

> A demo that sends payments between 3 Interledger.rs nodes and settles using Ethereum transactions and CRO transactions.

## Overview

This example shows how to configure Interledger.rs nodes and use an Ethereum network (testnet or mainnet) and the CRO devnet as settlement ledgers for payments sent between the nodes. If you are new to Ethereum, you can learn about it [here](https://www.ethereum.org/beginners/). To learn about settlement in Interledger, refer to [Peering, Clearing and Settling](https://github.com/interledger/rfcs/blob/master/0032-peering-clearing-settlement/0032-peering-clearing-settlement.md).

## Prerequisites

- [Rust](#rust)
- [An Ethereum network](#an-ethereum-network) to connect to
- [CRO Settlement Engine](#settlement*)
- [Redis](#redis)

### Rust

Because Interledger.rs is written in the Rust language, you need the Rust environment. Refer to the [Getting started](https://www.rust-lang.org/learn/get-started) page or just `curl https://sh.rustup.rs -sSf | sh` and follow the instructions.

### An Ethereum network

First, you need an Ethereum network. You can either use a local testnet, a remote testnet, or the mainnet.

For this example, we'll use [ganache-cli](https://github.com/trufflesuite/ganache-cli) which deploys a local Ethereum testnet at `localhost:8545`. To install `ganache-cli`, run `npm install -g ganache-cli`. If you do not already have Node.js installed on your computer, you can follow [the instructions below](#install-nodejs) to install it.

Advanced: You can run this against the Rinkeby Testnet by running a node that connects to Rinkeby (e.g. `geth --rinkeby --syncmode "light"`) or use a third-party node provider such as [Infura](https://infura.io/). You must also [create a wallet](https://www.myetherwallet.com/) and then obtain funds via the [Rinkeby Faucet](https://faucet.rinkeby.io/).

#### Install Node.js

(In case you don't have Node.js) There are a few ways to install Node.js. If you work on multiple JavaScript or TypeScript projects which require different `node` versions, using `nvm` may be suitable.

- [`nvm`](https://github.com/nvm-sh/nvm) (node version manager)
  - macOS: If you use [Homebrew](https://brew.sh/), run `brew install nvm` and you'll see some additional instructions. Follow it and `nvm install node` and `nvm use node`.
  - others: Refer to [`nvm`](https://github.com/nvm-sh/nvm) site.
- Install independently
  - macOS: If you use [Homebrew](https://brew.sh/), run `brew install node`
  - Ubuntu: `sudo apt-get install nodejs npm`

Then you should be able to use `npm`. To install `ganache-cli`, run `npm install -g ganache-cli`.

### CRO Settlement Engine

Interledger.rs and settlement engines written in other languages are fully interoperable. Here, we'll use the [CRO Ledger Settlement Engine](https://github.com/crypto-com/settlement-cro), which is written in TypeScript. We'll need `node` and `npm` to install and run the settlement engine. If you don't have it already, refer to [Install Node.js](#install-nodejs).

Install the settlement engine as follows:

```bash
npm install
npm run build
```

(This builds the `ilp-settlement-cro` in `dist`.)

### Redis

The Interledger.rs nodes and settlement engines currently use [Redis](https://redis.io/) to store their data (SQL database support coming soon!). Nodes and settlement engines can use different Redis instances.

- Compile and install from the source code
  - [Download the source code here](https://redis.io/download)
- Install using package managers
  - Ubuntu: run `sudo apt-get install redis-server`
  - macOS: If you use Homebrew, run `brew install redis`

Make sure your Redis is empty. You could run `redis-cli flushall` to clear all the data.

## Instructions

### 1. Build interledger.rs

First of all, let's build interledger.rs. (This may take a couple of minutes)

```bash
cargo build --all-features --bin ilp-node --bin interledger-settlement-engines
```

### 2. Launch Redis

```bash
# Create the logs directory if it doesn't already exist
mkdir -p logs

# Start Redis
redis-server --port 6379 &> logs/redis-a-node.log &
redis-server --port 6380 &> logs/redis-a-se-eth.log &
redis-server --port 6381 &> logs/redis-b-node.log &
redis-server --port 6382 &> logs/redis-b-se-eth.log &
redis-server --port 6383 &> logs/redis-b-se-xrp.log &
redis-server --port 6384 &> logs/redis-c-node.log &
redis-server --port 6385 &> logs/redis-c-se-xrp.log &
```

To remove all the data in Redis, you might additionally perform:

```bash
for port in `seq 6379 6385`; do
    redis-cli -p $port flushall
done
```

When you want to watch logs, use the `tail` command. You can use the command like: `tail -f logs/redis-alice.log`

### 3. Launch Ganache

This will launch an Ethereum testnet with 10 prefunded accounts. The mnemonic is used because we want to know the keys we'll use for Alice and Bob (otherwise they are randomized).

```bash
ganache-cli -m "abstract vacuum mammal awkward pudding scene penalty purchase dinner depart evoke puzzle" -i 1 &> logs/ganache.log &
```

### 4. Launch Settlement Engines

In this example, we'll connect 3 Interledger nodes and each node needs its own settlement engine for each settlement ledger; We'll launch 4 settlement engines in total.

1. A settlement engine for Alice to Bob on Ethereum
   - To settle the balance of Bob's account on Alice's node (Port 3000)
1. A settlement engine for Bob to Alice on Ethereum
   - To settle the balance of Alice's account on Bob's node (Port 3001)
1. A settlement engine for Bob to Charlie on CRO
   - To settle the balance of Charlie's account on Bob's node (Port 3002)
1. A settlement engine for Charlie to Bob on CRO
   - To settle the balance of Bob's account on Charlie's node (Port 3003)

You have to setup Tendermint + chain-abci + chain-tx-enclave and setup client-rpc server in your local environment. Create two accounts with following setups:

Default Wallet (Bob)
- Name: Default
- Passphrase: 123456
- Balance: > 1 CRO

Bob Wallet
- Name: Charlie
- Passphrase: 123456
- Balance: 0 CRO

Alternatively, you may use different wallet setup in environment variable.

```bash
# Turn on debug logging for all of the interledger.rs components
export RUST_LOG=interledger=debug

# Start Alice's settlement engine (ETH)
RUST_LOG=interledger=trace \
cargo run --features "ethereum" -- ethereum-ledger \
--private_key 380eb0f3d505f087e438eca80bc4df9a7faa24f868e69fc0440261a0fc0567dc \
--confirmations 0 \
--poll_frequency 1000 \
--ethereum_url http://127.0.0.1:8545 \
--connector_url http://127.0.0.1:7771 \
--redis_url redis://127.0.0.1:6380/ \
--asset_scale 8 \
--settlement_api_bind_address 127.0.0.1:3000 \
&> logs/node-alice-settlement-engine-eth.log &

# Start Bob's settlement engine (ETH, CRO)
RUST_LOG=interledger=trace \
cargo run --features "ethereum" -- ethereum-ledger \
--private_key cc96601bc52293b53c4736a12af9130abf347669b3813f9ec4cafdf6991b087e \
--confirmations 0 \
--poll_frequency 1000 \
--ethereum_url http://127.0.0.1:8545 \
--connector_url http://127.0.0.1:8771 \
--redis_url redis://127.0.0.1:6382/ \
--asset_scale 6 \
--settlement_api_bind_address 127.0.0.1:3001 \
&> logs/node-bob-settlement-engine-eth.log &

DEBUG="settlement*" \
CRO_WALLET_NAME="Default" \
CRO_WALLET_PASSPHRASE="123456" \
CONNECTOR_URL="http://localhost:8771" \
REDIS_URI=127.0.0.1:6383 \
ENGINE_PORT=3002 \
npm start | tee logs/node-bob-settlement-engine-cro.log

# Start Charlie's settlement engine (CRO)
DEBUG="settlement*" \
CRO_WALLET_NAME="Charlie" \
CRO_WALLET_PASSPHRASE="123456" \
CONNECTOR_URL="http://localhost:9771" \
REDIS_URI=127.0.0.1:6385 \
ENGINE_PORT=3003 \
npm start | tee logs/node-charlie-settlement-engine-cro.logg
```

### 5. Launch 3 Nodes

```bash
# Start Alice's node
RUST_LOG=interledger=trace \
ILP_ADDRESS=example.alice \
ILP_SECRET_SEED=8852500887504328225458511465394229327394647958135038836332350604 \
ILP_ADMIN_AUTH_TOKEN=hi_alice \
ILP_REDIS_URL=redis://127.0.0.1:6379/ \
ILP_HTTP_BIND_ADDRESS=127.0.0.1:7770 \
ILP_SETTLEMENT_API_BIND_ADDRESS=127.0.0.1:7771 \
cargo run --all-features --bin ilp-node &> logs/node-alice.log &

# Start Bob's node
RUST_LOG=interledger=trace \
ILP_ADDRESS=example.bob \
ILP_SECRET_SEED=1604966725982139900555208458637022875563691455429373719368053354 \
ILP_ADMIN_AUTH_TOKEN=hi_bob \
ILP_REDIS_URL=redis://127.0.0.1:6381/ \
ILP_HTTP_BIND_ADDRESS=127.0.0.1:8770 \
ILP_SETTLEMENT_API_BIND_ADDRESS=127.0.0.1:8771 \
cargo run --all-features --bin ilp-node &> logs/node-bob.log &

# Start Charlie's node
RUST_LOG=interledger=trace \
ILP_SECRET_SEED=1232362131122139900555208458637022875563691455429373719368053354 \
ILP_ADMIN_AUTH_TOKEN=hi_charlie \
ILP_REDIS_URL=redis://127.0.0.1:6384/ \
ILP_HTTP_BIND_ADDRESS=127.0.0.1:9770 \
ILP_SETTLEMENT_API_BIND_ADDRESS=127.0.0.1:9771 \
cargo run --all-features --bin ilp-node &> logs/node-charlie.log &
```

### 6. Configure the Nodes

```bash
# Adding settlement accounts should be done at the same time because it checks each other

printf "Adding Alice's account...\n"
curl \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer hi_alice" \
    -d '{
    "username" : "alice",
    "ilp_address": "example.alice",
    "asset_code": "ETH",
    "asset_scale": 8,
    "max_packet_amount": 100,
    "ilp_over_http_incoming_token": "alice_password",
    "ilp_over_http_url": "http://localhost:7770/ilp",
    "settle_to" : 0}' \
    http://localhost:7770/accounts > logs/account-alice-alice.log 2>/dev/null

printf "Adding Charlie's Account...\n"
curl \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer hi_charlie" \
    -d '{
    "ilp_address": "example.bob.charlie",
    "username" : "charlie",
    "asset_code": "CRO",
    "asset_scale": 8,
    "max_packet_amount": 100,
    "ilp_over_http_incoming_token": "charlie_password",
    "ilp_over_http_url": "http://localhost:9770/ilp",
    "settle_to" : 0}' \
    http://localhost:9770/accounts > logs/account-charlie-charlie.log 2>/dev/null

printf "Adding Bob's account on Alice's node (ETH Peer relation)...\n"
curl \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer hi_alice" \
    -d '{
    "ilp_address": "example.bob",
    "username" : "bob",
    "asset_code": "ETH",
    "asset_scale": 8,
    "max_packet_amount": 100,
    "settlement_engine_url": "http://localhost:3000",
    "ilp_over_http_incoming_token": "bob_password",
    "ilp_over_http_outgoing_token": "alice:alice_password",
    "ilp_over_http_url": "http://localhost:8770/ilp",
    "settle_threshold": 500,
    "min_balance": -1000,
    "settle_to" : 0,
    "routing_relation": "Peer"}' \
    http://localhost:7770/accounts > logs/account-alice-bob.log 2>/dev/null &

printf "Adding Alice's account on Bob's node (ETH Peer relation)...\n"
curl \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer hi_bob" \
    -d '{
    "ilp_address": "example.alice",
    "username": "alice",
    "asset_code": "ETH",
    "asset_scale": 8,
    "max_packet_amount": 100,
    "settlement_engine_url": "http://localhost:3001",
    "ilp_over_http_incoming_token": "alice_password",
    "ilp_over_http_outgoing_token": "bob:bob_password",
    "ilp_over_http_url": "http://localhost:7770/ilp",
    "settle_threshold": 500,
    "min_balance": -1000,
    "settle_to" : 0,
    "routing_relation": "Peer"}' \
    http://localhost:8770/accounts > logs/account-bob-alice.log 2>/dev/null

printf "Adding Charlie's account on Bob's node (CRO Child relation)...\n"
curl \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer hi_bob" \
    -d '{
    "ilp_address": "example.bob.charlie",
    "username" : "charlie",
    "asset_code": "CRO",
    "asset_scale": 8,
    "max_packet_amount": 100,
    "settlement_engine_url": "http://localhost:3002",
    "ilp_over_http_incoming_token": "charlie_password",
    "ilp_over_http_outgoing_token": "bob:bob_other_password",
    "ilp_over_http_url": "http://localhost:9770/ilp",
    "settle_threshold": 500,
    "min_balance": -1000,
    "settle_to" : 0,
    "routing_relation": "Child"}' \
    http://localhost:8770/accounts > logs/account-bob-charlie.log 2>/dev/null &

printf "Adding Bob's account on Charlie's node (CRO Parent relation)...\n"
curl \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer hi_charlie" \
    -d '{
    "ilp_address": "example.bob",
    "username" : "bob",
    "asset_code": "CRO",
    "asset_scale": 8,
    "max_packet_amount": 100,
    "settlement_engine_url": "http://localhost:3003",
    "ilp_over_http_incoming_token": "bob_other_password",
    "ilp_over_http_outgoing_token": "charlie:charlie_password",
    "ilp_over_http_url": "http://localhost:8770/ilp",
    "settle_threshold": 500,
    "min_balance": -1000,
    "settle_to" : 0,
    "routing_relation": "Parent"}' \
    http://localhost:9770/accounts > logs/account-charlie-bob.log 2>/dev/null

sleep 2
```

Now three nodes and its settlement engines are set and accounts for each node are also set up.

Notice how we use Alice's settlement engine endpoint while registering Bob. This means that whenever Alice interacts with Bob's account, she'll use that Settlement Engine. This could be also said for the other accounts on the other nodes.

The `settle_threshold` and `settle_to` parameters control when settlements are triggered. The node will send a settlement when an account's balance reaches the `settle_threshold`, and it will settle for `balance - settle_to`.

### 7. Set the exchange rate between ETH and CRO on Bob's connector

```bash
printf "\nSetting the exchange rate...\n"
curl http://localhost:8770/rates -X PUT \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer hi_bob" \
    -d "{ \"ETH\" : 1, \"CRO\": 1 }" \
    &>/dev/null
```

### 8. Sending a Payment

The following script sends a payment from Alice to Charlie through Bob.

```bash
curl \
    -H "Authorization: Bearer alice:alice_password" \
    -H "Content-Type: application/json" \
    -d "{\"receiver\":\"http://localhost:9770/accounts/charlie/spsp\",\"source_amount\":500}" \
    http://localhost:7770/accounts/alice/payments
```

To try settling multiple times, send more than 500 basic unit of CRO: 
```bash
curl \
    -H "Authorization: Bearer alice:alice_password" \
    -H "Content-Type: application/json" \
    -d "{\"receiver\":\"http://localhost:9770/accounts/charlie/spsp\",\"source_amount\":1500}" \
    http://localhost:7770/accounts/alice/payments
```

### 8. Check Balances

You may see unsettled balances before the settlement engines exactly work. Wait a few seconds and try later.

```bash #
printf "\nAlice's balance on Alice's node: "
curl \
-H "Authorization: Bearer hi_alice" \
http://localhost:7770/accounts/alice/balance

printf "\nBob's balance on Alice's node: "
curl \
-H "Authorization: Bearer hi_alice" \
http://localhost:7770/accounts/bob/balance

printf "\nAlice's balance on Bob's node: "
curl \
-H "Authorization: Bearer hi_bob" \
http://localhost:8770/accounts/alice/balance

printf "\nCharlie's balance on Bob's node: "
curl \
-H "Authorization: Bearer hi_bob" \
http://localhost:8770/accounts/charlie/balance

printf "\nBob's balance on Charlie's node: "
curl \
-H "Authorization: Bearer hi_charlie" \
http://localhost:9770/accounts/bob/balance

printf "\nCharlie's balance on Charlie's node: "
curl \
-H "Authorization: Bearer hi_charlie" \
http://localhost:9770/accounts/charlie/balance
```

### 9. Kill All the Services

Finally, you can stop all the services as follows:

```bash #
for port in `seq 6379 6385`; do
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null ; then
        redis-cli -p ${port} shutdown
    fi
done

if [ -f dump.rdb ] ; then
    rm -f dump.rdb
fi

for port in 8545 7770 8770 9770 3000 3001 3002 3003; do
    if lsof -tPi :${port} >/dev/null ; then
        kill `lsof -tPi :${port}`
    fi
done
```

## Advanced

### Check the Settlement Block Generation

To check whether the settlement block is generated, we use `geth`. `geth` is the abbreviation of `go-ethereum` which is an Ethereum client written in the go language. If you don't already have `geth`, refer to the following.

- Compile and install from the source code
  - Refer to [Building Ethereum](https://github.com/ethereum/go-ethereum/wiki/Building-Ethereum) page.
- Install using package managers
  - Ubuntu: Follow the instructions [here](https://github.com/ethereum/go-ethereum/wiki/Installation-Instructions-for-Ubuntu).
  - macOS: If you use Homebrew, run `brew tap ethereum/ethereum` and `brew install ethereum`. Details are found [here](https://github.com/ethereum/go-ethereum/wiki/Installation-Instructions-for-Mac).
  - others: Refer to [Building Ethereum](https://github.com/ethereum/go-ethereum/wiki/Building-Ethereum) page.

Then dump transaction logs as follows. You will see generated block information. Be aware that ganache takes 10 to 20 seconds to generate a block. So you will have to wait for it before you check with `geth`.

```bash #
printf "Last block: "
geth --exec "eth.getTransaction(eth.getBlock(eth.blockNumber-1).transactions[0])" attach http://localhost:8545 2>/dev/null
printf "\nCurrent block: "
geth --exec "eth.getTransaction(eth.getBlock(eth.blockNumber).transactions[0])" attach http://localhost:8545 2>/dev/null
```

If you inspect `ganache-cli`'s output, you will notice that the block number has increased as a result of the settlement executions as well.

### Check the Incoming Settlement on CRO

You'll find incoming settlement logs in your settlement engine logs. Try:

```bash #
cat logs/node-charlie-settlement-engine-cro.log | grep "Received incoming CRO payment"
```

## Troubleshooting

```
# When installing ganache-cli
gyp ERR! find Python Python is not set from command line or npm configuration
gyp ERR! find Python Python is not set from environment variable PYTHON
gyp ERR! find Python checking if "python" can be used
gyp ERR! find Python - executable path is "/Users/xxxx/anaconda3/bin/python"
gyp ERR! find Python - version is "3.6.2"
gyp ERR! find Python - version is 3.6.2 - should be >=2.6.0 <3.0.0
gyp ERR! find Python - THIS VERSION OF PYTHON IS NOT SUPPORTED
gyp ERR! find Python checking if "python2" can be used
gyp ERR! find Python - "python2" is not in PATH or produced an error
```

If you see an error like the above, you have to install Python 2.7.

```
# When installing Node.js with apt-get
E: Unable to locate package nodejs
E: Unable to locate package npm
```

Try `sudo apt-get update`.

```
# When you try run-md.sh
Fatal: Failed to start the JavaScript console: api modules: Post http://localhost:8545: context deadline exceeded
```

It seems that you failed to install `ganache-cli`. Try to install it.

```
# When running with Docker
Error starting userland proxy: listen tcp 0.0.0.0:6379: bind: address already in use.
```

You might have run another example. Stop them first and try again. How to stop the services is written in each example page.

## Conclusion

This example showed an SPSP payment sent between three Interledger.rs nodes that settled using on-ledger Ethereum and CRO transactions.

More examples that enhance your integration with ILP are coming soon!
