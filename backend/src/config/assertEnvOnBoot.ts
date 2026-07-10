// A side-effect module, imported for its ordering guarantee.
//
// `import` statements are hoisted: putting `assertEnv()` as a statement in
// index.ts would still run it AFTER `./app` had been imported — and importing
// ./app constructs PrismaClient, which loads backend/.env into process.env
// (verified: it sets JWT_SECRET, a variable Prisma has no interest in). A
// missing secret would then be silently filled in from a file that does not
// exist on the deploy target, and the check would pass for the wrong reason.
//
// Importing this module before ./app forces validation to run first.

import { assertEnv } from "./env";

assertEnv();
