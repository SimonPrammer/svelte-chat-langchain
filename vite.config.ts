import { loadEnv, defineConfig } from 'vite';
import dotenvExpand from 'dotenv-expand';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(({ mode }) => {
	//NECESSARY TO USE ENV VARIABLES WITHOUT EXPLICITLY DECLARING THEM IN DEVELOPMENT!
	if (mode === 'development') {
		const env = loadEnv(mode, process.cwd(), '');
		dotenvExpand.expand({ parsed: env });
	}

	return {
		plugins: [sveltekit()]
	};
});