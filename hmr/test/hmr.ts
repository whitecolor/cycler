import { Observable as O, Subject, BehaviorSubject } from 'rxjs'
import { hmrProxy as proxy } from '../.'
import { run } from '@cycle/run'
import { setAdapt } from '@cycle/run/lib/adapt'
import xs, { Stream } from 'xstream'
import Rxjs from 'rxjs'
import test from 'tape'

declare const global: any

global.cycleHmrDebug = false
global.cycleHmrCleanupTimeout = 100

type XsInputSource = { input$: Stream<number> }
type RxInputSource = { input$: O<number> }

const getRandomId = () => Math.random().toString().slice(4, 8)

test('xstream: Dataflow returning single steam', t => {
  const func = ({ input$ }: { input$: Stream<number> }) => {
    return input$.map(x => x * 2)
  }

  const funcProxy = proxy(func, getRandomId())
  const input$ = xs.of(1)
  const sink = funcProxy({ input$ })

  sink.addListener({
    next: y => {
      t.is(y, 2, 'output of stream should not change')
      t.end()
    },
    error: t.error,
  })
})

test('xstream: proxy handles memory stream', t => {
  const func = ({ input$ }: { input$: Stream<number> }) => {
    return input$.map(x => x * 2).remember()
  }

  const funcProxy = proxy(func, getRandomId(), { debug: true })
  const input$ = xs.of(1)
  const sink = funcProxy({ input$ })
  setTimeout(() => {
    sink.addListener({
      next: y => {
        t.is(y, 2, 'first subscriber got signal')
      },
      error: t.error,
    })
    sink.addListener({
      next: y => {
        setTimeout(() => {
          t.is(y, 2, 'second subscriber got signal')
          t.end()
        }, 100)
      },
      error: t.error,
    })
  }, 100)
})

test('xstream: run dataflow with disposal', t => {
  let count = 0
  let sinkCount = 0
  let value: number
  const testTimeout = 500
  const func = (input$: Stream<number>) => {
    return {
      output$: input$.map(x => x * 2),
    }
  }
  const funcReloaded = (input$: Stream<number>) => {
    return {
      output$: input$.map(x => x * 2000),
    }
  }
  const proxyId = 'func_' + getRandomId()
  const mainProxyId = 'main_' + getRandomId()

  const funcProxy = proxy(func, proxyId)

  const main = ({}) => {
    const output$ = funcProxy(xs.periodic(80)).output$
    return {
      other: output$.take(1),
      log: output$.map(x => {
        count++
        return x
      }),
    }
  }

  const dispose = run(proxy(main, mainProxyId), {
    other: (messages$: Stream<number>) => {
      return messages$.addListener({
        next: x => {
          t.is(x, 0, 'completed stream value ok')
        },
        error: () => {},
        complete: () => {},
      })
    },
    log: (messages$: Stream<number>) => {
      return messages$.addListener({
        next: x => {
          value = x
          sinkCount++
        },
        error: () => {},
        complete: () => {},
      })
    },
  })

  proxy(funcReloaded, proxyId)

  setTimeout(() => {
    dispose()
    setTimeout(() => {
      t.ok(value > 1000, 'last value:' + value + ' was proxied')
      t.ok(count === sinkCount || count - 1 === sinkCount, 'no leaking')
      console.log('count, sinkCount:', count, sinkCount)
      t.end()
    }, 250)
  }, testTimeout)
})

// emulation of hot reload of dataflows that are in one file
// and one executes another
test('Nested dataflows reload', t => {
  // (global as any).cycleHmrDebug = true
  const nestedFuncProxyId = 'nestedFunc_' + getRandomId()
  const funcProxyId = 'func_' + getRandomId()

  const nestedFunc = ({ input$ }: XsInputSource) => {
    return {
      // completed stream
      output$: input$.map(x => x * 2),
    }
  }

  const nestedFuncProxy = proxy(nestedFunc, nestedFuncProxyId)

  const nestedFuncReloaded = ({ input$ }: XsInputSource) => {
    return {
      output$: input$.map(x => x * 20),
    }
  }

  const func = ({ input$ }: XsInputSource) => {
    return {
      output$: nestedFuncProxy({ input$ }).output$,
    }
  }

  const funcReload = ({ input$ }: XsInputSource) => {
    const nestedFuncReloadedProxy = proxy(nestedFuncReloaded, nestedFuncProxyId)
    return {
      output$: nestedFuncReloadedProxy({ input$ }).output$,
    }
  }

  const funcProxy = proxy(func, funcProxyId)
  const input$ = xs.createWithMemory<number>()
  const sink = funcProxy({ input$: input$ })

  const results: number[] = []
  sink.output$.addListener({
    next: y => {
      console.warn('got push', y)
      results.push(y)
    },
    error: t.error,
  })
  input$.shamefullySendNext(1)
  setTimeout(() => {
    console.log('reload start')
    //proxy(nestedFuncReloaded, nestedFuncProxyId)
    proxy(funcReload, funcProxyId)
    console.log('reload end')
    setTimeout(() => {
      t.deepEqual(
        results,
        [2, 20],
        'emits two values for initial and reloaded versions.'
      )
      t.end()
    }, 100)
  }, 100)
})

test('Set Rxjs adapt', t => {
  // @ts-ignore
  setAdapt(Rxjs.Observable.from)
  t.end()
})

test('Dataflow returning single steam', t => {
  const func = ({ input$ }: RxInputSource) => {
    return input$.map(x => x * 2)
  }

  let funcProxy = proxy(func, getRandomId())
  let input$ = O.of(1)
  let sink = funcProxy({ input$ })

  sink.subscribe(y => {
    t.is(y, 2, 'output of stream should not change')
    t.end()
  }, t.error)
})

test('Dataflow returning regular sink object', t => {
  const func = ({ input$ }: RxInputSource, rest: string, rest2: string) => {
    t.is(rest, 'rest', 'first rest source param should be passed transparently')
    t.is(rest2, 'rest2', 'second rest param should passed transparently')
    return {
      output$: input$.map(x => x * 2),
    }
  }

  let funcProxy = proxy(func, getRandomId())
  let input$ = O.of(1)
  let sink = funcProxy({ input$ }, 'rest', 'rest2')
  sink.output$.subscribe(y => {
    t.is(y, 2, 'proxied function output should be correct')
    t.end()
  }, t.error)
})

test('Dataflow returning sink that contains stream factory function', t => {
  const dataflow = ({ input$ }: RxInputSource) => {
    return {
      x: 1,
      empty: null,
      output: () => input$.map(x => x * 2),
    }
  }
  const dataflowReloaded = ({ input$ }: RxInputSource) => {
    return {
      x: 2,
      output: () => input$.map(x => x * 20),
    }
  }
  const proxyId = getRandomId()
  const dataflowProxy = proxy(dataflow, proxyId)
  const input$ = O.of(1)
  const sinks = dataflowProxy({ input$ })
  t.is(sinks.x, 1, 'number is proxied transparent with no changes')
  t.is(sinks.empty, null, 'nil is proxied transparent with no changes')
  let sink = sinks.output()
  proxy(dataflowReloaded, proxyId)
  sink.subscribe(y => {
    t.is(y, 20, 'proxied function output should be correct')
    t.end()
  }, t.error)
})

test('Dataflow returning sink that contains (deep) nested object', t => {
  const dataflow = (
    { input$ }: { input$: O<number> },
    rest: string,
    rest2: string
  ) => {
    return {
      deep: {
        nested: {
          output$: input$.map(x => x * 2),
        },
      },
    }
  }
  const dataflowReloaded = (
    { input$ }: { input$: O<number> },
    rest: string,
    rest2: string
  ) => {
    return {
      deep: {
        nested: {
          output$: input$.map(x => x * 20),
        },
      },
    }
  }
  const proxyId = getRandomId()
  const dataflowProxy = proxy(dataflow, proxyId)
  const input$ = O.of(1)
  const sinks = dataflowProxy({ input$ }, 'rest', 'rest2')
  const sink = sinks.deep.nested.output$
  proxy(dataflowReloaded, proxyId)
  sink.subscribe(y => {
    t.is(y, 20, 'proxied function output should be correct')
    t.end()
  }, t.error)
})

test('Dataflow connected to to multicasted source', t => {
  const dataflow = ({ input$ }: RxInputSource) => {
    return {
      output$: input$.map(x => x * 20),
    }
  }
  const dataflowReloaded = ({ input$ }: RxInputSource) => {
    console.log('')
    return {
      output$: input$.map(x => x * 200),
    }
  }
  const proxyId = getRandomId()
  let dataflowProxy = proxy(dataflow, proxyId)
  let input$ = O.interval(30).share()
  let sinks = dataflowProxy({ input$ })
  let sink = sinks.output$
  let reloaded = false
  setTimeout(() => {
    proxy(dataflowReloaded, proxyId)
    setTimeout(function () {
      reloaded = true
    }, 10)
  }, 100)

  const sub = sink.subscribe(y => {
    if (reloaded) {
      t.ok(y > 100, 'reloaded sink takes last value of shared source')
      t.end()
      sub.unsubscribe()
    }
  }, t.error)
})

test('Dataflow double reload', t => {
  const proxyId = getRandomId()

  const func = ({ input$ }: RxInputSource, rest: string, rest2: string) => {
    return {
      // completed stream
      output$: input$.map(x => x * 2).take(1),
    }
  }

  const funcReloaded = (
    { input$ }: RxInputSource,
    rest: string,
    rest2: string
  ) => {
    t.is(rest, 'rest', 'first rest source param stays the same')
    t.is(rest2, 'rest2', 'second rest source param stays the same')
    return {
      output$: input$.map(x => x * 20).take(1),
    }
  }

  const funcReloaded2 = (
    { input$ }: RxInputSource,
    rest: string,
    rest2: string
  ) => {
    t.is(rest, 'rest', 'first rest source param stays the same')
    t.is(rest2, 'rest2', 'second rest source param stays the same')
    return {
      output$: input$.map(x => x * 200),
    }
  }

  const funcProxy = proxy(func, proxyId)
  const input$ = new BehaviorSubject<number>(1)
  const sink = funcProxy({ input$: input$.asObservable() }, 'rest', 'rest2')

  let reloaded = 0
  sink.output$.subscribe(y => {
    if (reloaded === 0) {
      t.is(y, 2, 'initial output should be correct')
    }
    if (reloaded === 1) {
      t.is(y, 40, 'reloaded output should be correct')
    }
    if (reloaded === 2) {
      t.is(y, 400, 'next reloaded output should be correct')
      t.end()
    }
  }, t.error)
  setTimeout(() => {
    proxy(funcReloaded, proxyId)
    reloaded++
    input$.next(2)
    setTimeout(() => {
      proxy(funcReloaded2, proxyId)
      reloaded++
      input$.next(2)
    }, 100)
  }, 100)
})

test('Transparent proxying for non-dataflows', t => {
  const str = 'str'
  const obj = { a: 1 }
  const fn = (x: number) => x * 2
  const fnNil = (x: any) => null
  const fnObj = (x: any) => ({ value: x * 2 })
  t.is(proxy(str, getRandomId()), 'str', 'proxied constant value is ok')
  t.is(proxy(obj, getRandomId()), obj, 'proxied object ref is ok')
  t.is(proxy(obj, getRandomId()).a, 1, 'proxied object prop is ok')
  t.is(proxy(obj, getRandomId()).a, 1, 'proxied object prop is ok')
  t.is(proxy(fn, getRandomId())(2), 4, 'proxied function returned result is ok')
  t.is(
    proxy(fnNil, getRandomId())(2),
    null,
    'proxied nil function returned result is ok'
  )
  t.is(
    proxy(fnObj, getRandomId())(2).value,
    4,
    'proxied function returned object is ok'
  )
  t.end()
})
