//try vercel postgres as vectorstore?

import { json } from '@sveltejs/kit';
import { compile } from 'html-to-text';
import { RecursiveUrlLoader } from 'langchain/document_loaders/web/recursive_url';
import { testDocs } from './testDocs';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { VercelPostgres } from 'langchain/vectorstores/vercel_postgres';
import { POSTGRES_URL, PRIVATE_OPENAI_KEY } from '$env/static/private';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { sql } from '@vercel/postgres';

process.env.POSTGRES_URL = POSTGRES_URL;

async function loadApiDocs() {
	const url = 'https://js.langchain.com/docs/get_started/introduction';

	const compiledConvert = compile({ wordwrap: 130 }); // returns (text: string) => string;

	const loader = new RecursiveUrlLoader(url, {
		extractor: compiledConvert,
		maxDepth: 1, //8
		preventOutside: true,
		// exclude_dirs=(
		//             "https://api.python.langchain.com/en/latest/_sources",
		//             "https://api.python.langchain.com/en/latest/_modules",
		//         ),
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
	// Config is only required if you want to override default values.
	const config = {
		tableName: 'vs_langchain_docs',
		postgresConnectionOptions: {
			connectionString: POSTGRES_URL
			//   connectionString: "postgres://<username>:<password>@<hostname>:<port>/<dbname>",
		}
		// columns: {
		// 	idColumnName: 'id',
		// 	vectorColumnName: 'vector',
		// 	contentColumnName: 'content',
		// 	metadataColumnName: 'metadata'
		// }
	};

	return await VercelPostgres.initialize(
		new OpenAIEmbeddings({
			openAIApiKey: PRIVATE_OPENAI_KEY,
			batchSize: 512 // Default value if omitted is 512. Max is 2048
		}),
		config
	);
}

//ingest docs
export const POST = async ({ request }) => {
	try {
		//if already exists
		const exists = await sql`
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'vs_langchain_docs'
  );
`;
		console.log('POST  exists:', exists?.rows[0]?.exists);

		if (!exists?.rows[0]?.exists) {
			const docs = testDocs; //await loadApiDocs();

			//could clean up docs here with a LLM chain that looks for duplicate text

			const newDocs = await splitDocs(docs);

			const vercelPostgresStore = await initVectorDb();
			const embeddingIds = await vercelPostgresStore.addDocuments([...docs]);

			console.log('POST  embeddingIds:', embeddingIds);
			console.log('POST  splitDocs:', newDocs);
		} else {
			throw new Error('Already ingested!');
		}

		return json({ result, error: false }, { status: 200 });
	} catch (err) {
		console.log('commonHandleError  err:', err);
		return json(
			{
				error: true,
				errorMsg: err?.message ? err.message : 'There was an unexpected error. Please try again.'
			},
			{ status: 500 }
		);
	}
};
