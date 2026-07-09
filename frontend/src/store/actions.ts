import { createAction } from "@reduxjs/toolkit";

/**
 * Lives outside any slice so the API-thunk factory can dispatch it without
 * importing the auth slice (which would import the factory right back).
 */
export const sessionExpired = createAction("auth/sessionExpired");
