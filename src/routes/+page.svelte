<script>
	import { useChat } from 'ai/svelte';
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

<button
	class="btn variant-soft-primary"
	on:click={async () => {
		await ingest();
	}}>ingest</button
>

<div>
	<ul>
		{#each $messages as message}
			<li>{message.role}: {message.content}</li>
		{/each}
	</ul>
	<form on:submit={handleSubmit}>
		<input bind:value={$input} />
		<button type="submit">Send</button>
	</form>
</div>
