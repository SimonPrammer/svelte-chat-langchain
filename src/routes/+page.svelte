<script>
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
