export function parseJsonRequestBody(body: string): unknown {
  return body.trim() ? JSON.parse(body) : {}
}
