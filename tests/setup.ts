// Skip env validation in tests — individual suites mock what they need.
process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL ??= "file::memory:";
process.env.OPENAI_API_KEY ??= "test-key";
