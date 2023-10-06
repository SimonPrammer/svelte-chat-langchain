//try vercel postgres as vectorstore?

import { json } from '@sveltejs/kit';
import { compile } from 'html-to-text';
import { RecursiveUrlLoader } from 'langchain/document_loaders/web/recursive_url';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import type { Document } from 'langchain/document';
import { VercelPostgres } from 'langchain/vectorstores/vercel_postgres';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { sql } from '@vercel/postgres';

async function loadApiDocs() {
	const url = 'https://js.langchain.com/docs/get_started/introduction';

	const compiledConvert = compile({ wordwrap: 130 });

	const loader = new RecursiveUrlLoader(url, {
		extractor: compiledConvert,
		maxDepth: 8,
		preventOutside: true,
		excludeDirs: ['https://js.langchain.com/docs/api/']
	});

	return await loader.load();
}

async function splitDocs(docs: Document[]) {
	const splitter = new RecursiveCharacterTextSplitter({
		chunkSize: 4000,
		chunkOverlap: 200
	});

	return await splitter.splitDocuments([...docs]);
}

async function initVectorDb() {
	const config = {
		tableName: 'langchain_docs_embeddings'
		// postgresConnectionOptions: {
		// 	// connectionString: POSTGRES_URL
		// 	// connectionString: "postgres://<username>:<password>@<hostname>:<port>/<dbname>",
		// }
	};

	return await VercelPostgres.initialize(
		new OpenAIEmbeddings({
			batchSize: 512 // Default value if omitted is 512. Max is 2048
		}),
		config
	);
}

//ingest docs
export const POST = async ({ request }) => {
	try {
		if (!process.env.POSTGRES_URL) throw new Error('No POSTGRES_URL env variable set!');
		if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY env variable set!');

		let result = null;

		//check if vector db already exists
		const exists = await sql`
			SELECT EXISTS (
				SELECT FROM information_schema.tables 
				WHERE table_schema = 'public'
				AND table_name = 'langchain_docs_embeddings'
			);
		`;

		if (!exists?.rows[0]?.exists) {
			const docs = await loadApiDocs();
			const split_docs = await splitDocs(docs);
			const vercelPostgresStore = await initVectorDb();
			result = await vercelPostgresStore.addDocuments([...split_docs]);
		} else {
			throw new Error('Table already exists! Please delete the table first and try again');
		}

		return json({ result, error: false }, { status: 200 });
	} catch (err) {
		return json(
			{
				error: true,
				errorMsg: err?.message ? err.message : 'There was an unexpected error. Please try again.'
			},
			{ status: 500 }
		);
	}
};
