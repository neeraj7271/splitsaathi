# Contracts Package

Owns shared enums, DTO shapes, and validation schemas used across API and mobile.

Does not own persistence entities, NestJS controllers, React Native state, or domain algorithms. Keep this package lightweight and backward-compatible because it is the boundary between clients and server.

Public interface:

- Shared enums for group modes, roles, settlement states, and split types.
- Money DTO helpers and INR formatting.
- Zod schemas for request validation where a contract is shared across layers.
