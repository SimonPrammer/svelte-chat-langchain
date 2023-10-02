import { sql } from '@vercel/postgres';

export const load = async (event) => {
	const isEnvSet = !!process.env.POSTGRES_URL && !!process.env.OPENAI_API_KEY;

	if (isEnvSet) {
		const exists = await sql`
		SELECT EXISTS (
			SELECT FROM information_schema.tables 
			WHERE table_schema = 'public'
			AND table_name = 'langchain_docs_embeddings'
		);
	`;
		return {
			isEnvSet,
			vectorDbExists: exists?.rows[0]?.exists
		};
	} else {
		return {
			isEnvSet
		};
	}
};
