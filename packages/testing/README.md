# SplitSaathi Testing Package

Owns reusable test factories and ledger assertions shared by API, domain, and future mobile integration tests.

Does not own production fixtures, seed data, migrations, or mock provider implementations. Keep this package framework-light so tests can import it without pulling NestJS, TypeORM, or React Native.

Run locally:

```powershell
npm run test -w @splitsaathi/testing -- --runInBand
npm run build -w @splitsaathi/testing
```
