<script>
	import '@picocss/pico'
	import { useChat } from 'ai/svelte';

	//page data
	export let data;

	const { input, handleSubmit, messages } = useChat();

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
</script>

<!-- only show the populate button if vector db does not exist yet -->
{#if !data.vectorDbExists}
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
	<form on:submit={handleSubmit}>
		<input bind:value={$input} placeholder="Ask something about Langchain..." />
		<button type="submit">Send</button>
	</form>
</footer>

<style>
	button {
		max-width: 120px;
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
