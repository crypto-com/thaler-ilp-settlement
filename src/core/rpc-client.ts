import axios from 'axios'
import LosslessJSON = require('lossless-json')
import BigNumber from 'bignumber.js'
import { WalletRequest } from './utils'

export class RpcClient {
  private requestId = 1;
  constructor(private url: string) {}

  public async createTransferAddress(walletRequest: WalletRequest): Promise<string> {
    return this.request('wallet_createTransferAddress', [walletRequest]);
  }

  public async getViewKey(walletRequest: WalletRequest): Promise<string> {
    return this.request('wallet_getViewKey', [walletRequest]);
  }

  public async sendToAddress(walletRequest: WalletRequest, toAddress: String, amount: BigNumber, viewKeys: String[]): Promise<string> {
    return this.request('wallet_sendToAddress', [
      walletRequest,
      toAddress,
      amount.toString(10),
      viewKeys,
    ]);
  }

  public async transactions(walletRequest: WalletRequest): Promise<Transaction[]> {
    return this.request('wallet_transactions', [walletRequest]);
  }

  public async request(method: string, params: string | any[] = []): Promise<any> {
    const id = (this.requestId += 1)
    const { data } = await axios.post(
      this.url,
      {
        jsonrpc: '2.0',
        id,
        method,
        params: typeof params === 'string' ? [params] : params
      },
      {
        transformResponse: data => {
          return LosslessJSON.parse(data, this.losslessJSONReviver)
        }
      }
    )
    if (data['error']) {
      return Promise.reject(data['error'])
    }
    return data['result']
  }

  private losslessJSONReviver(key: any, value: any) {
    if (value && value.isLosslessNumber) {
      return new BigNumber(value.toString())
    } else {
      return value
    }
  }
}

export interface Transaction {
  outputs: Output[];
  value: string;
  kind: TransactionKind;
  block_height: BigNumber;
  block_time: string;
  transaction_id: string;
}

export interface Output {
  address: string;
  valid_from: BigNumber;
  value: string;
}

export enum TransactionKind {
  Incoming = "Incoming",
  Outgoing = "Outgoing",
}

