import { Database } from "jsr:@db/sqlite";

export interface Submission {
	id: number;
	form_id: string;
	token: string;
	fields: Record<string, string>;
	submitted_at: string;
	ip: string | null;
}

let db: Database | null = null;

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    form_id     TEXT NOT NULL,
    token       TEXT NOT NULL UNIQUE,
    fields      TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    ip          TEXT
  );
`;

/**
 * Initialize the SQLite database. Must be called once at startup.
 * Creates the data directory if needed and runs schema migrations.
 */
export function initDb(dataDir: string): void {
	const dbPath = `${dataDir}/form-sink.db`;

	// Ensure the data directory exists
	try {
		Deno.statSync(dataDir);
	} catch {
		Deno.mkdirSync(dataDir, { recursive: true });
	}

	db = new Database(dbPath);
	db.exec(SCHEMA_SQL);
}

/** Close the database connection. */
export function closeDb(): void {
	if (db) {
		db.close();
		db = null;
	}
}

function getDb(): Database {
	if (!db) {
		throw new Error("Database not initialized. Call initDb() first.");
	}
	return db;
}

/**
 * Insert a new form submission into the database.
 *
 * @param formId - The form identifier (from `_form_id` field)
 * @param token - Unique UUID token for this submission
 * @param fields - Record of field names to values (stored as JSON)
 * @param ip - Optional submitter IP address
 */
export function insertSubmission(
	formId: string,
	token: string,
	fields: Record<string, string>,
	ip?: string | null,
): void {
	const stmt = getDb().prepare(
		`INSERT INTO submissions (form_id, token, fields, submitted_at, ip)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
	);
	stmt.run(
		formId,
		token,
		JSON.stringify(fields),
		new Date().toISOString(),
		ip ?? null,
	);
}

/**
 * Look up a submission by its unique token.
 *
 * @param token - The UUID token
 * @returns The submission record, or null if not found
 */
export function getSubmission(submissionToken: string): Submission | null {
	const stmt = getDb().prepare(
		`SELECT id, form_id, token, fields, submitted_at, ip
     FROM submissions
     WHERE token = ?1`,
	);
	const rows =
		stmt.all<[number, string, string, string, string, string | null]>(
			submissionToken,
		);

	const result = rows.map(([id, form_id, token, fields, submitted_at, ip]) => ({
		id,
		form_id,
		token,
		fields: JSON.parse(fields) as Record<string, string>,
		submitted_at,
		ip,
	}));

	return result.length > 0 ? result[0] : null;
}
