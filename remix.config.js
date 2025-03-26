/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  cacheDirectory: "./node_modules/.cache/remix",
  ignoredRouteFiles: ["**/.*", "**/*.test.{ts,tsx}"],
  serverModuleFormat: "cjs",
  serverDependenciesToBundle: [
    "remix-auth",
    "@coji/remix-auth-google",
    "remix-auth-oauth2",
    "@edgefirst-dev/data/parser",
    "arctic",
    "@oslojs/encoding",
    "@oslojs/crypto/sha2",
    "@oslojs/binary",
    "@oslojs/jwt",
    "remix-auth/strategy",
    "@webcontainer/api",
    "@ai-sdk/google",
  ],
};
