import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";

// Create database connection using environment variables
const connectionString = process.env.DATABASE_URL || '';

// Add application-specific schema to isolate this app's data
const applicationSchema = 'sepulveda_showroom';

// Create connection with schema search path to isolate data
const sql = postgres(connectionString, {
  onnotice: () => {}, // Suppress notices
  transform: {
    // Transform table names to include schema prefix
    column: {
      to: postgres.toCamel,
      from: postgres.fromCamel,
    },
  },
});

// Create drizzle instance with our schema
export const db = drizzle(sql, { schema });

// Function to ensure our application schema exists
export async function ensureSchema() {
  try {
    await sql`CREATE SCHEMA IF NOT EXISTS ${sql(applicationSchema)}`;
    await sql`SET search_path TO ${sql(applicationSchema)}, public`;
    console.log(`Database schema '${applicationSchema}' initialized`);
  } catch (error) {
    console.error('Error creating application schema:', error);
    throw error;
  }
}