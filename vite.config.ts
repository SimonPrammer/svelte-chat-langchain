

// export default defineConfig({
// 	plugins: [sveltekit()],
// 	test: {
// 		include: ['src/**/*.{test,spec}.{js,ts}']
// 	}
// });


import { loadEnv, defineConfig } from 'vite';
import dotenvExpand from 'dotenv-expand';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig(({ mode }) => {
	//FIX FOR ENV VARIABLES IN DEVELOPMENT!
	if (mode === 'development') {
		const env = loadEnv(mode, process.cwd(), '');
		dotenvExpand.expand({ parsed: env });
	}

	return {
		plugins: [sveltekit()]
	};
});