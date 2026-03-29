import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env['DATABASE_URL']
if (!connectionString) throw new Error('DATABASE_URL is required')

const client = postgres(connectionString, { max: 10 })
export const db = drizzle(client, { schema })
export type DB = typeof db
