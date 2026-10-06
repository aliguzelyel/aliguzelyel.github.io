import { createInterface } from 'node:readline/promises';

/**
 * Prompt helper that works both interactively (TTY) and with piped stdin
 * (useful for testing: `printf 'a\nb\n' | node scripts/new-project.mjs`).
 */
export async function createPrompt() {
  if (process.stdin.isTTY) {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return {
      ask: async (question, fallback = '') => {
        const answer = (
          await rl.question(`${question}${fallback ? ` (${fallback})` : ''}: `)
        ).trim();
        return answer || fallback;
      },
      close: () => rl.close(),
    };
  }

  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  const lines = data.split(/\r?\n/);
  let index = 0;

  return {
    ask: async (question, fallback = '') => {
      const line = (lines[index++] ?? '').trim();
      console.log(
        `${question}${fallback ? ` (${fallback})` : ''}: ${line || '(default)'}`,
      );
      return line || fallback;
    },
    close: () => {},
  };
}
