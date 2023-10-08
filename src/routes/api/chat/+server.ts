// path: /api/chat/+server.ts
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { RunnableSequence } from 'langchain/schema/runnable';
import { BytesOutputParser, StringOutputParser } from 'langchain/schema/output_parser';
import { VercelPostgres } from 'langchain/vectorstores/vercel_postgres';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { ChatPromptTemplate, PromptTemplate } from 'langchain/prompts';
import type { Config } from '@sveltejs/kit';
import type { Document } from 'langchain/document.js';
import type { Message } from 'ai';

export const config: Config = {
	runtime: 'edge'
};

const RESPONSE_TEMPLATE = `
You are an expert programmer and problem-solver, tasked to answer any question about Langchain.
 Using the provided context, answer the user's question to the best of your ability using the resources provided.
Generate a comprehensive and informative answer (but no more than 80 words) for a given question based solely on the
 provided search results (URL and content). You must only use information from the provided search results. 
 Use an unbiased and journalistic tone. Combine search results together into a coherent answer. Do not repeat text.
Cite search results using [\${{number}}] notation. Only cite the most relevant results that answer the question accurately.
 Place these citations at the end of the sentence or paragraph that reference them - do not put them all at the end. 
 If different results refer to different entities within the same name, write separate answers for each entity.
If there is nothing in the context relevant to the question at hand, just say "Hmm, I'm not sure." Don't try to make up an answer.
Anything between the following \`context\`  html blocks is retrieved from a knowledge bank, not part of the conversation with the user.
<context>
    {context}
<context/>

REMEMBER: If there is no relevant information within the context, just say "Hmm, I'm not sure." Don't try to make up an answer. Anything between the preceding 'context' html blocks is retrieved from a knowledge bank, not part of the conversation with the user.`;

const REPHRASE_TEMPLATE = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone Question:`;

const getRetriever = async () => {
	const vectorstore = await VercelPostgres.initialize(new OpenAIEmbeddings({}), {
		tableName: 'langchain_docs_embeddings'
	});
	return vectorstore.asRetriever({ k: 6 });
};

//server endpoint
export const POST = async ({ request }) => {
	if (!process.env.POSTGRES_URL) throw new Error('No POSTGRES_URL env variable set!');
	if (!process.env.OPENAI_API_KEY) throw new Error('No OPENAI_API_KEY env variable set!');

	const { messages } = await request.json();
	if (!messages) throw new Error('No messages!');

	//Message = Vercel AI SDK Type
	type ChainInput = {
		question: Message;
		chat_history: Message[];
	};

	const chain = RunnableSequence.from([
		{
			//retriever sequence for context
			context: RunnableSequence.from([
				(input: ChainInput) =>
					//if messages > 1 -> condense history chain
					messages.length > 1
						? RunnableSequence.from([
								{
									question: (input: ChainInput) => input.question.content,
									chat_history: (input: ChainInput) =>
										input.chat_history
											.map((message) => `${message.role}: ${message.content}`)
											.join('\n')
								},
								PromptTemplate.fromTemplate(REPHRASE_TEMPLATE),
								new ChatOpenAI({
									modelName: 'gpt-3.5-turbo-16k',
									temperature: 0
								}),
								new StringOutputParser()
						  ])
						: //else just return question
						  input.question.content,
				getRetriever,
				(docs: Document[]) =>
					docs.map((doc, i) => `<doc id='${i}'>${doc.pageContent}</doc>`).join('\n')
			]).withConfig({ runName: "FindDocs" }),
			question: (input: ChainInput) => input.question.content,
			chat_history: (input: ChainInput) =>
				input.chat_history.map((message) => `${message.role}: ${message.content}`).join('\n')
		},
		ChatPromptTemplate.fromMessages([
			['system', RESPONSE_TEMPLATE],
			['human', `Chat History:{chat_history} {question}`]
		]),
		new ChatOpenAI({
			modelName: 'gpt-3.5-turbo-16k',
			temperature: 0
		}),
		// new BytesOutputParser()
		new StringOutputParser()
	]);

	const stream = await chain.streamLog({
		question: messages.pop(),
		chat_history: messages
	});



	// Only return a selection of output to the frontend
    const textEncoder = new TextEncoder();
    const clientStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
        // console.log('forawait  chunk:', chunk);
        // console.log('encoded  chunk:',  textEncoder.encode(
		// 	"event: data\ndata: " + JSON.stringify(chunk) + "\n\n",
		//   ));
		
      
          controller.enqueue(
            textEncoder.encode(
              "event: data\ndata: " + JSON.stringify(chunk) + "\n\n",
            ),
          );
        }
        controller.enqueue(textEncoder.encode("event: end\n\n"));
        controller.close();
      },
    });

    return new Response(clientStream, {
      headers: { "Content-Type": "text/event-stream" },
    });

};
