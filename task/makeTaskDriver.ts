import xs, { Stream, MemoryStream } from 'xstream';
import { adapt } from '@cycle/run/lib/adapt';
import makeTaskSource from './makeTaskSource'
import attachRequest from './attachRequest'

const isFunction = (f: any) => typeof f === 'function'
const empty = () => { }
const emptySubscribe = (stream: Stream<any>) =>
  stream.subscribe({ next: empty, error: empty, complete: empty })

import {
  DriverOptions,
  TaskDriver,
  TaskSource,
  TaskRequest,
  GetResponse,
  GetProgressiveResponse,
  ResponseObserver
} from './interfaces'

export function makeTaskDriver<Request, Response, Error>
  (getResponse: GetResponse<Request, Response, Error>):
  (request$: Stream<Request>) => TaskSource<Request, Response>

export function makeTaskDriver
  <Request, Response, Error>(
  params: {
    getResponse: GetResponse<Request, Response, Error>
    lazy?: boolean
  }):
  (request$: Stream<Request>) => TaskSource<Request, Response>

export function makeTaskDriver
  <Request, Response, Error>(
  params: {
    getProgressiveResponse: GetProgressiveResponse<Request, Response, Error>
    lazy?: boolean
  }):
  (request$: Stream<Request>) => TaskSource<Request, Response>

export function makeTaskDriver
  <RequestInput, Request, Response, Error>(
  params: {
    getResponse: GetResponse<Request, Response, Error>
    normalizeRequest(request: RequestInput): RequestInput,
    isolateMap?(request: RequestInput): RequestInput,
    lazy?: boolean
  }):
  (request$: Stream<RequestInput>) =>
    TaskSource<RequestInput, Response>

export function makeTaskDriver
  <RequestInput, Request, Response, Error>(
  params: {
    getProgressiveResponse: GetProgressiveResponse<Request, Response, Error>
    normalizeRequest(request: RequestInput): Request,
    isolateMap?(request: RequestInput): Request,
    lazy?: boolean
  }):
  (request$: Stream<RequestInput>) =>
    TaskSource<Request, Response>

export function makeTaskDriver<Request, Response, Error>
  (getResponse: GetResponse<Request, Response, Error>): TaskDriver<Request, Response>

export function makeTaskDriver
  <Request, Response, Error>(
  params: {
    getResponse: GetResponse<Request, Response, Error>
    lazy?: boolean
  }): TaskDriver<Request, Response>

export function makeTaskDriver
  <Request, Response, Error>(
  params: {
    getProgressiveResponse: GetProgressiveResponse<Request, Response, Error>
    lazy?: boolean
  }): TaskDriver<Request, Response>

export function makeTaskDriver
  <RequestInput, Request, Response, Error>(
  params: {
    getResponse: GetResponse<Request, Response, Error>
    normalizeRequest(request: RequestInput): Request,
    isolateMap?(request: RequestInput): Request,
    lazy?: boolean
  }): TaskDriver<Request, Response>

export function makeTaskDriver
  <RequestInput, Request, Response, Error>(
  params: {
    getProgressiveResponse: GetProgressiveResponse<Request, Response, Error>
    normalizeRequest(request: RequestInput): Request,
    isolateMap?(request: RequestInput): Request,
    lazy?: boolean
  }): TaskDriver<Request, Response>

export function makeTaskDriver
  <RequestInput, Request, Response, Error>
  (options: DriverOptions<RequestInput & TaskRequest, Request & TaskRequest, Response, Error>):
  ((request$: any) => any) {
  let {
    getResponse,
    getProgressiveResponse,
    normalizeRequest = (_: any) => _,
    isolateMap,
    lazy = false
  } = options

  if (normalizeRequest && !isolateMap) {
    isolateMap = normalizeRequest
  }
  if (isFunction(options)) {
    getResponse = options as GetResponse<Request, Response, Error>
  }

  const createResponse$ = (request: RequestInput & TaskRequest) => {
    const normalizedRequest = normalizeRequest(request)
    const isLazyRequest = typeof normalizedRequest.lazy === 'boolean'
      ? normalizedRequest.lazy : lazy
    const promise = Promise.resolve()
    const promisify = (cb: any) => promise.then(cb)

    let response$ = xs.create<Response>({
      start: function (this: any, observer) {
        const disposeCallback = (_: any) => this.dispose = _
        if (getProgressiveResponse) {
          getProgressiveResponse(
            normalizedRequest, observer, disposeCallback
          )
        } else if (getResponse) {
          const callback = (err: Error | null, result: Response) => {
            if (err) {
              observer.error(err)
            } else {
              observer.next(result)
              observer.complete()
            }
          }
          let res = getResponse(normalizedRequest, callback, disposeCallback)
          if (res && isFunction(res.then)) {
            res.then((result: Response) => callback(null, result), callback)
          }
        }

      },
      stop: function (this: any) {
        isFunction(this.dispose) && this.dispose()
      }
    })
    if (!isLazyRequest) {
      response$ = response$.remember()
      emptySubscribe(response$)
    }
    attachRequest(response$, normalizedRequest)
    return response$
  }

  return (request$) => {
    const response$$ = request$.map(createResponse$)
    emptySubscribe(response$$)
    return makeTaskSource(response$$, { isolateMap })
  }
}

export default makeTaskDriver
