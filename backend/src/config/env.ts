import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5001),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/hrms'),
  USE_MEMORY_DB: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine((v) => !/replace-me/i.test(v), 'JWT_SECRET is still the example placeholder — generate one with: openssl rand -hex 32'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  PUBLIC_APP_URL: z.string().default('http://localhost:5173'),
  TAX_RATE: z.coerce.number().min(0).max(1).default(0.12),
  BASE_CURRENCY: z.string().default('INR'),
  GROQ_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_PLACES_API_KEY: z.string().optional(),
  AMADEUS_API_KEY: z.string().optional(),
  AMADEUS_API_SECRET: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('Voyara <no-reply@voyara.travel>'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('✖ Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  console.error('  Copy .env.example to .env and fill in the required values.');
  process.exit(1);
}

const blank = (v?: string) => (v && v.trim() ? v.trim() : undefined);
const raw = parsed.data;

export const env = {
  ...raw,
  GROQ_API_KEY: blank(raw.GROQ_API_KEY),
  GEMINI_API_KEY: blank(raw.GEMINI_API_KEY),
  OPENAI_API_KEY: blank(raw.OPENAI_API_KEY),
  GOOGLE_PLACES_API_KEY: blank(raw.GOOGLE_PLACES_API_KEY),
  AMADEUS_API_KEY: blank(raw.AMADEUS_API_KEY),
  AMADEUS_API_SECRET: blank(raw.AMADEUS_API_SECRET),
  TAVILY_API_KEY: blank(raw.TAVILY_API_KEY),
  EXA_API_KEY: blank(raw.EXA_API_KEY),
  SMTP_HOST: blank(raw.SMTP_HOST),
  corsOrigins: raw.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  isProd: raw.NODE_ENV === 'production',
};
