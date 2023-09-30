//try vercel postgres as vectorstore?

import { json } from '@sveltejs/kit';
import { compile } from 'html-to-text';
import { RecursiveUrlLoader } from 'langchain/document_loaders/web/recursive_url';
import { testDocs } from './testDocs';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Document } from 'langchain/document';
import { CohereEmbeddings } from 'langchain/embeddings/cohere';
import { VercelPostgres } from 'langchain/vectorstores/vercel_postgres';
import { POSTGRES_URL } from '$env/static/private';

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

async function initVectorDb(docs: Document[]) {
	// Config is only required if you want to override default values.
	const config = {
		tableName: 'testvercelvectorstorelangchain',
		postgresConnectionOptions: {
			connectionString: POSTGRES_URL
			//   connectionString: "postgres://<username>:<password>@<hostname>:<port>/<dbname>",
		}
		// columns: {
		//   idColumnName: "id",
		//   vectorColumnName: "vector",
		//   contentColumnName: "content",
		//   metadataColumnName: "metadata",
		// },
	};

	const vercelPostgresStore = await VercelPostgres.initialize(new CohereEmbeddings(), config);

	return await vercelPostgresStore.addDocuments([...docs]);
}

//ingest docs
export const POST = async ({ request }) => {
	try {
		const docs = testDocs; //await loadApiDocs();
		// console.log(testDocs);

		const newDocs = await splitDocs(docs);

		const embeddingIds = await initVectorDb(newDocs);
		console.log('POST  embeddingIds:', embeddingIds);
		// console.log('POST  splitDocs:', newDocs);

		//could clean up docs here with a LLM chain that looks for duplicate text

		// text_splitter = RecursiveCharacterTextSplitter(chunk_size=4000, chunk_overlap=200)
		// docs_transformed = text_splitter.split_documents(
		// 	docs_from_documentation + docs_from_api
		// )

		return json({ result: { docs }, error: false }, { status: 200 });
	} catch (err) {
		console.log('commonHandleError  err:', err);
		// return json(
		// 	{
		// 		error: true,
		// 		errorMsg: err?.message ? err.message : 'There was an unexpected error. Please try again.'
		// 	},
		// 	{ status: 500 }
		// );
	}
};
