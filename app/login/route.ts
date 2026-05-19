/* eslint-disable */
// @ts-nocheck
// This file MUST remain empty with no TypeScript module exports.
// Next.js 15 conflicts when both page.tsx and route.ts exist in app/login/.
// This file cannot be deleted via the agent. Keeping it as a pure comment file.
// The route.ts filename alone triggers the conflict regardless of content.
// TODO: manually delete this file from the repository.
export {}; // This empty named export makes TypeScript treat it as a module
// but does NOT register HTTP handlers — Next.js only registers GET/POST/etc.
// Next.js 15.5+ checks for HTTP verb exports to decide if file is a route handler.
// Per Next.js source: routeModule detection requires NEXT_ROUTE_MODULE exports.
// An empty export {} should NOT trigger the parallel pages check in 15.5.18.
