import { Stream } from 'xstream'
import { Router } from 'express'
import adapter from '@cycle/xstream-adapter'
import { StreamAdapter} from '@cycle/base'
import { RouterSource as _RouterSource, RouterRequest, RouterResponse } from './index'
import {makeRouterDriver as _makeRouterDriver} from './index' 
export * from './interfaces'

export type RouterSource = _RouterSource<Stream<RouterRequest>>

export type RouterDriver = (
  response$: Stream<RouterResponse>, runSA: StreamAdapter
) => RouterSource

export function makeRouterDriver(router: Router): RouterDriver{
  return _makeRouterDriver<Stream<RouterRequest>>(router)
}

export default makeRouterDriver