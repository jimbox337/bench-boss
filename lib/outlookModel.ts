// Override server-side when changing the model available to this Groq account.
export const OUTLOOK_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
