import { sql } from '@vercel/postgres';

export const load = async (event) => {
	const exists = await sql`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public'
				AND table_name = 'langchain_docs_embeddings'
			);
		`;
	return {
		vectorDbExists: exists?.rows[0]?.exists
	};
};
