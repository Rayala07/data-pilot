// Prisma client singleton for the app DB. This is the ONLY module that may
// import @prisma/client — nothing here ever touches a user-supplied database.

import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
