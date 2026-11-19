// Transactions under the group role (ARCH §4). M1 has one reader: /api/health.

/**
 * @template T
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }> }} db
 * @param {(q: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withPlatform(db, fn) {
  // M1: one statement per call; a pool may give each statement another connection, so the read runs
  // as the login role, which is a member of sai_app. Multi-statement transactions come with M2.
  return fn((text, params) => db.query(text, params));
}
