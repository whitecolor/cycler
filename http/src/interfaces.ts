import {TaskRequest} from '@cycler/task'
export interface Attachment {
  name: string
  path: string
  filename?: string
}

export interface HTTPRequest extends TaskRequest {
  url: string
  method?: string
  query?: Object
  send?: Object
  headers?: {[index: string]: string}
  accept?: string
  type?: string
  user?: string
  password?: string
  field?: {[index: string]: string}
  progress?: boolean
  attach?: Attachment[]
  withCredentials?: boolean
  redirects?: number
}

export type HTTPRequestInput = HTTPRequest | string

export interface HTTPResponse {
  text?: string
  body?: Object
  header?: Object
  type?: string
  status?: number
}