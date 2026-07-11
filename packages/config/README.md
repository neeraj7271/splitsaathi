# Config Package

Owns typed environment loading and validation.

Does not own framework bootstrapping, secrets storage, or runtime provider clients. API and mobile code consume parsed values instead of reading raw environment variables directly where practical.

Public interface:

- `loadEnv(process.env)` returns a validated app environment.
- `AppEnv` is the inferred environment type.
