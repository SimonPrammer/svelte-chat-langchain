<script lang="ts">
	import '@picocss/pico';
	import { writable } from 'svelte/store';
	import type { Message } from 'ai';

	import { fetchEventSource } from "@microsoft/fetch-event-source";
	import { applyPatch } from "fast-json-patch";

	//page data
	export let data;
	// $: console.log('data:', data);

	//local state
	let input = writable('');
	let messages = writable<Message[]>([]);
	let conversationId = crypto.randomUUID();
	let streamedResponse: Record<string, any> = {};
	let accumulatedMessage = "";
	let sources: any[] | undefined = undefined;
	let runId: string;

	

	async function ingest() {
		const res = await fetch('/api/ingest', {
			method: 'POST',
			body: JSON.stringify({ test: 'test' }),
			headers: {
				'Content-Type': 'application/json'
			}
		});
		console.log('ingest  res:', res);
	}

	//on submit

	async function onSubmit() {
		$messages.push({
			id: crypto.randomUUID(),
			role: 'user',
			content: $input
		});

		try {
      const sourceStepName = "FindDocs";
      await fetchEventSource("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: $messages,
          conversation_id: conversationId,
        }),
		
        onmessage(msg) {
          if (msg.event === "end") {

			messages.set([...$messages, { id: crypto.randomUUID(), role: 'assistant', content: accumulatedMessage }]);
            // setChatHistory((prevChatHistory) => [
            //   ...prevChatHistory,
            //   { human: messageValue, ai: accumulatedMessage },
            // ]);
            // setIsLoading(false);
            return;
          }
          if (msg.event === "data" && msg.data) {
            const chunk = JSON.parse(msg.data);
            console.log('onmessage  chunk:', chunk);
            streamedResponse = applyPatch(
              streamedResponse,
              chunk.ops,
            ).newDocument;
            if (
              Array.isArray(
                streamedResponse?.logs?.[sourceStepName]?.final_output?.output,
              )
            ) {
              sources = streamedResponse.logs[
				  sourceStepName
				].final_output.output.map((doc: Record<string, any>) => ({
					url: doc.metadata.source,
					title: doc.metadata.title,
				}));
				console.log('onmessage  sources:', sources);
            }
            if (streamedResponse.id !== undefined) {
              runId = streamedResponse.id;
            }
            if (Array.isArray(streamedResponse?.streamed_output)) {
              accumulatedMessage = streamedResponse.streamed_output.join("");
            }
            // const parsedResult = marked.parse(accumulatedMessage);

            // setMessages((prevMessages) => {
            //   let newMessages = [...prevMessages];
            //   if (messageIndex === null || newMessages[messageIndex] === undefined) {
            //     messageIndex = newMessages.length;
            //     newMessages.push({
            //       id: Math.random().toString(),
            //       content: parsedResult.trim(),
            //       runId: runId,
            //       sources: sources,
            //       role: "assistant",
            //     });
            //   } else if (newMessages[messageIndex] !== undefined) {
            //     newMessages[messageIndex].content = parsedResult.trim();
            //     newMessages[messageIndex].runId = runId;
            //     newMessages[messageIndex].sources = sources;
            //   }
            //   return newMessages;
            // });
          }
        },
      });
    } catch (e) {
    console.log('onSubmit  e:', e);
    //   setMessages((prevMessages) => prevMessages.slice(0, -1));
    //   setIsLoading(false);
    //   setInput(messageValue);
    //   throw e;
    }
	}
</script>

<!-- only show the populate button if vector db does not exist yet -->
{#if data.isEnvSet && !data.vectorDbExists}
	<header class="ingest-container">
		<button
			on:click={async () => {
				await ingest();
			}}>Populate Vector Store</button
		>
	</header>
{/if}

<div class="messages-container">
	<ul>
		{#each $messages as message}
			<li>{message.role}: {message.content}</li>
		{/each}
	</ul>
</div>

<footer>
	{#if !data.isEnvSet}
		<p>
			Make sure to set all necessary environment variables before chatting! See the README file for
			more information!
		</p>
	{/if}
	<form on:submit={onSubmit}>
		<input
			disabled={!data.isEnvSet}
			bind:value={$input}
			placeholder="Ask something about Langchain..."
		/>
		<button disabled={!data.isEnvSet} type="submit">Send</button>
	</form>
</footer>

<style>
	button {
		max-width: 120px;
	}

	.messages-container {
		margin-bottom: 100px;
	}

	form {
		display: flex;
		flex-direction: row;
		justify-content: space-between;
		gap: 0.5rem;
	}
	footer {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		padding: 0.5rem;
	}
	header {
		position: fixed;
		top: 0;
		right: 0;
		padding: 0.5rem;
	}
</style>
