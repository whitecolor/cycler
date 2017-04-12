import { ProxyOptions } from '../.'

export interface TransformOptions extends ProxyOptions {
  testExportName?: string,
  importFrom?: string,
  sourceIdentifier: string
}

export type Transformer =
  (source: string, options: TransformOptions) => string
