const localforage = require('localforage')
const getItems = require('localforage-getitems')
const setItems = require('localforage-setitems')
const removeItems = require('localforage-removeitems')

const extendLocalForage = (obj: any) => obj.extendPrototype(localforage)

extendLocalForage(getItems)
extendLocalForage(setItems)
extendLocalForage(removeItems)

import {
  ForageRequest,
  ForageDriverOptions,
  CreateForageOptions,
  ForageDriverOption,
  ExecuteRequest
} from './interfaces'

const getDriverName = (
  driver: ForageDriverOption | ForageDriverOption[] | undefined
): string => {
  const getName = (driver: ForageDriverOption | undefined) => {
    if (typeof driver === 'string' || !driver) {
      return driver || ''
    } else {
      return driver && driver._driver
    }
  }
  return (Array.isArray(driver) ? driver : [driver]).map(getName).join('_')
}

const getStoreInstanceKey = (options: CreateForageOptions) => {
  return [
    'store',
    getDriverName(options.driver),
    options.name || '',
    options.storeName || ''
  ]
    .filter(_ => _)
    .join('_')
}

const initializedStoreInstances: { [index: string]: any } = {}

let geStoreOptionsForRequest = (
  options: ForageDriverOptions,
  request: ForageRequest
): CreateForageOptions => {
  let storeOptions: CreateForageOptions = {}
  if (options.driver) {
    storeOptions.driver = options.driver
  }
  if (options.size) {
    storeOptions.size = options.size
  }
  if (options.version) {
    storeOptions.version = options.version
  }
  if (options.description) {
    storeOptions.description = options.description
  }
  let name = request.name || options.name
  if (name) {
    storeOptions.name = name
  }
  let storeName = request.storeName || options.storeName
  if (storeName) {
    storeOptions.storeName = storeName
  }
  return storeOptions
}

export const getStoreInstance = (options: CreateForageOptions): any => {
  var key = getStoreInstanceKey(options)
  if (!initializedStoreInstances[key]) {
    initializedStoreInstances[key] = (<any>localforage).createInstance(options)
  }
  return initializedStoreInstances[key]
}

let methods = [
  'getItem',
  'setItem',
  'removeItem',
  'keys',
  'length',
  'clear',
  'iterate',
  'getItems',
  'setItems',
  'removeItems'
]

export const makeGetResponse = (options: ForageDriverOptions) => {
  return (request: ForageRequest) => {
    const storeOptions = geStoreOptionsForRequest(options, request)
    const storeInstance: any = getStoreInstance(storeOptions)
    const execute = (request as ExecuteRequest).execute
    if (execute) {
      return execute(storeInstance)
    }
    const method = methods.reduce(
      (found, method) =>
        found || (request.hasOwnProperty(method) ? method : ''),
      ''
    )
    if (!method) {
      throw new Error(`No valid method found in request`)
    }
    let param = (<any>request)[method]
    let params = [param]
    if (method === 'setItem') {
      params = [param.key, param.value]
    }
    if (!storeInstance[method]) {
      throw new Error(`Method ${method} is absent on localforage instance.`)
    }
    return storeInstance[method].apply(storeInstance, params)
  }
}
