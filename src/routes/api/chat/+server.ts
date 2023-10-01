// path: /api/chat/+server.ts
import { StreamingTextResponse, type Message } from 'ai';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { RunnableSequence } from 'langchain/schema/runnable';
import { BytesOutputParser, StringOutputParser } from 'langchain/schema/output_parser';
import { VercelPostgres } from 'langchain/vectorstores/vercel_postgres';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { ChatPromptTemplate, PromptTemplate } from 'langchain/prompts';
import type { Config } from '@sveltejs/kit';
import type { Document } from 'langchain/document.js';

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

//server endpoint for chatGpt Stream Chat
export const POST = async ({ request }) => {
	const { messages } = await request.json();
	if (!messages) throw new Error('No messages!');

	//Using Vercel AI SDK Message type but could also convert messages to Langchain Message type
	type ChainInput = {
		question: Message;
		chat_history: Message[];
	};

	const chain = RunnableSequence.from([
		{
			//retriever sequence. if messages > means there is a history > condense history chain
			context: RunnableSequence.from([
				(input: ChainInput) =>
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
						: input.question.content,
				getRetriever,
				(docs: Document[]) =>
					docs.map((doc, i) => `<doc id='${i}'>${doc.pageContent}</doc>`).join('\n')
			]),
			question: (input: ChainInput) => input.question.content,
			chat_history: (input: ChainInput) =>
				input.chat_history.map((message) => `${message.role}: ${message.content}`).join('\n')
		},
		ChatPromptTemplate.fromMessages([
			['system', RESPONSE_TEMPLATE],
			// new MessagesPlaceholder('chat_history'),
			['human', `{question}`]
		]),
		new ChatOpenAI({
			modelName: 'gpt-3.5-turbo-16k',
			temperature: 0
		}),
		new BytesOutputParser()
	]);

	const stream = await chain.stream({
		question: messages.pop(),
		chat_history: messages
	});

	return new StreamingTextResponse(stream);
};
