//! adapted from https://github.com/interledgerjs/settlement-xrp (XRP On-Ledger Settlement Engine)
//! Copyright Copyright (c) 2019 Interledger Team (licensed under the Apache License, Version 2.0)
//! Modifications Copyright (c) 2018 - 2019, Foris Limited (licensed under the Apache License, Version 2.0)

import BigNumber from 'bignumber.js'
import debug from 'debug'
import { SettlementEngine, AccountServices } from 'ilp-settlement-core'
import { TendermintClient } from './core/tendermint-client'
import { RpcClient, TransactionKind } from './core/rpc-client'
import { newRpcClient, newTendermintClient, WalletRequest, sleep } from './core/utils'

const log = debug('settlement-cro')

export const TENDERMINT_HOST = 'http://localhost'
export const TENDERMINT_PORT = 16657
export const CLIENT_RPC_HOST = 'http://localhost'
export const CLIENT_RPC_PORT = 16659
export const WALLET_NAME = 'Default'
export const WALLET_PASSPHRASE = ''
export const CRO_DECIMAL_PLACES = 8

export interface CroEngineOpts {
  tendermintHost?: string
  tendermintPort?: string
  clientRpcHost?: string
  clientRpcPort?: string
  walletName?: string
  walletPassphrase?: string
}

export interface CroSettlementEngine extends SettlementEngine {
  handleMessage(accountId: string, message: any): Promise<any>
  handleTransaction(tx: IncomingTransaction): void
  disconnect(): Promise<void>
}

export type ConnectCroSettlementEngine = (services: AccountServices) => Promise<CroSettlementEngine>

export const createEngine = (opts: CroEngineOpts = {}): ConnectCroSettlementEngine => async ({
  sendMessage,
  creditSettlement,
  trySettlement,
}) => {
  const tendermintHost = opts.tendermintHost || TENDERMINT_HOST
  const tendermintPort = Number(opts.tendermintPort) || TENDERMINT_PORT
  const clientRpcHost = opts.clientRpcHost || CLIENT_RPC_HOST
  const clientRpcPort = Number(opts.clientRpcPort) || CLIENT_RPC_PORT
  const walletRequest: WalletRequest = {
    name: opts.walletName || WALLET_NAME,
    passphrase: opts.walletPassphrase || WALLET_PASSPHRASE
  }

  const tendermintClient: TendermintClient = newTendermintClient(tendermintHost, tendermintPort)
  const rpcClient: RpcClient = newRpcClient(clientRpcHost, clientRpcPort)

  const incomingPaymentAddresses = new Map<string, string>() // transferAddress -> accountId
  const pendingTimers = new Set<NodeJS.Timeout>() // Set of timeout IDs to cleanup when exiting

  const self: CroSettlementEngine = {
    async handleMessage(accountId, message): Promise<PaymentDetails> {
      if (message.type && message.type === 'paymentDetails') {
        const transferAddress = await rpcClient.createTransferAddress(walletRequest)
        const viewKey = await rpcClient.getViewKey(walletRequest)

        incomingPaymentAddresses.set(transferAddress, accountId)

        // Clean-up tags after 5 mins to prevent memory leak
        pendingTimers.add(
          setTimeout(() => incomingPaymentAddresses.delete(transferAddress), 5 * 60000)
        )

        log(
          `Created Transfer Address for receiving payment: transferAddress=${transferAddress} accountId=${accountId}`
        )
        return {
          transferAddress,
          viewKey
        }
      } else {
        throw new Error(`Unknown message type ${message.type}`)
      }
    },

    async settle(accountId, queuedAmount) {
      // Limit precision to basic unit (remainder will be refunded)
      const croAmount = queuedAmount.decimalPlaces(CRO_DECIMAL_PLACES, BigNumber.ROUND_DOWN)
      log(`Received settlement request: account=${accountId} queuedAmount=${queuedAmount}`)
      const amount = croToBasicUnit(croAmount)
      log(
        `Starting settlement: account=${accountId} cro=${croAmount.toString(
          10
        )} cro_unit=${amount.toString(10)})`
      )

      const paymentDetails = await sendMessage(accountId, {
        type: 'paymentDetails'
      })
        .then(response =>
          isPaymentDetails(response)
            ? response
            : log(`Failed to settle: Received invalid payment details: account=${accountId}`)
        )
        .catch(err =>
          log(`Failed to settle: Error fetching payment details: account=${accountId}`, err)
        )
      if (!paymentDetails) {
        return new BigNumber(0)
      }

      const transactionId = await rpcClient
        .sendToAddress(walletRequest, paymentDetails.transferAddress, amount, [
          paymentDetails.viewKey
        ])
        .catch(err => {
          log(
            `Failed to submit settlement transaction: Retry in 5s: account=${accountId} cro=${croAmount.toString(
              10
            )} cro_unit=${amount.toString(10)} transferAddress=${paymentDetails.transferAddress}`,
            err
          )

          pendingTimers.add(setTimeout(() => trySettlement(accountId), 5000));
        })
      if (!transactionId) {
        return new BigNumber(0)
      }

      log(
        `Successfully submitted settlement transaction: account=${accountId} cro=${croAmount.toString(
          10
        )} cro_unit=${amount.toString(10)} transferAddress=${paymentDetails.transferAddress} transactionId=${transactionId}`
      )
      // TODO: Should check if the transaction succeeded
      // Broadcast succeeded does not guarantee on-chain finality
      // Possible option: Query Tendermint for the transaction id
      return croAmount
    },

    handleTransaction(tx: IncomingTransaction) {
      const amount = tx.amount
      if (!amount.isGreaterThan(0)) {
        return
      }
      const croAmount = basicUnitToCro(amount)

      const accountId = incomingPaymentAddresses.get(tx.address)
      if (!accountId) {
        log(
          `Discarding unrelated incoming transaction: address=${
            tx.address
          } cro=${croAmount.toString(10)} cro_unit=${amount.toString(10)} transactionId=${
            tx.transactionId
          }`
        )
        return
      }

      const transactionId = tx.transactionId
      log(
        `Received incoming CRO payment: cro=${croAmount.toString(10)} cro_unit=${amount.toString(
          10
        )} account=${accountId} transactionId=${transactionId}`
      )
      creditSettlement(accountId, croAmount, transactionId)
    },

    async disconnect() {
      pendingTimers.forEach(timer => clearTimeout(timer))
    }
  }

  const monitorWallet = async () => {
    let lastTransactionCount = (await rpcClient.transactions(walletRequest)).length
    const checkWalletTransactions = async () => {
      let transactions = await rpcClient.transactions(walletRequest)
      if (transactions.length === lastTransactionCount) {
        return
      }
      log(
        `Found ${transactions.length - lastTransactionCount} new transactions: wallet=${
          walletRequest.name
        }`
      )

      for (let transaction of transactions.reverse().slice(lastTransactionCount)) {
        if (transaction.kind !== TransactionKind.Incoming) {
          continue
        }
        log(`Found a new incoming transaction: wallet=${walletRequest.name}`)

        for (let output of transaction.outputs) {
          self.handleTransaction({
            transactionId: transaction.transaction_id,
            address: output.address,
            amount: new BigNumber(output.value)
          })
        }
      }

      lastTransactionCount = transactions.length
    }

    log(`Start monitoring wallet: wallet=${walletRequest.name}`)
    while (true) {
      try {
        await checkWalletTransactions()
      } catch (err) {
        log(`Error when checking transactions: wallet=${walletRequest.name}`)
      }
      await sleep(1000)
    }
  }

  monitorWallet().catch(err => {
    log(`Error when monitoring wallet ${walletRequest.name}`, err)
    process.exit(1)
  })

  return self
}

interface PaymentDetails {
  transferAddress: string
  viewKey: string
}

export const isPaymentDetails = (o: any): o is PaymentDetails =>
  typeof o === 'object' && typeof o.transferAddress === 'string' && typeof o.viewKey === 'string'

interface IncomingTransaction {
  transactionId: string
  address: string
  amount: BigNumber
}

const croToBasicUnit = (amount: BigNumber): BigNumber => {
  return amount.multipliedBy(new BigNumber(10).exponentiatedBy(CRO_DECIMAL_PLACES))
}

const basicUnitToCro = (amount: BigNumber): BigNumber => {
  return amount.dividedBy(new BigNumber(10).exponentiatedBy(CRO_DECIMAL_PLACES))
}
