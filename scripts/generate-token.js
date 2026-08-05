#!/usr/bin/env node
// One-time generator for a MusicKit developer token.
//
// This is a dev-time tool, not part of the hosted static site. Run it
// locally whenever you need a new token (they last up to ~6 months).
//
// Usage:
//   npm install jsonwebtoken
//   node scripts/generate-token.js \
//     --key ./AuthKey_XXXXXXXXXX.p8 \
//     --keyId XXXXXXXXXX \
//     --teamId XXXXXXXXXX \
//     --origin https://altosun154.github.io
//
// --origin is optional but recommended for web clients: it locks the
// token so Apple only accepts it when the request's Origin header
// matches, i.e. it stops working if pasted into some other site. Pass
// it multiple times for more than one origin (e.g. a custom domain
// plus the github.io URL).
//
// Then paste the printed token into config.js as MUSICKIT_DEVELOPER_TOKEN.

const fs = require("fs");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function argAll(name) {
  const out = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}`) out.push(process.argv[i + 1]);
  });
  return out;
}

const keyPath = arg("key");
const keyId = arg("keyId");
const teamId = arg("teamId");
const expiresIn = parseInt(arg("expires", "15777000"), 10); // ~6 months, Apple's max lifetime
const origins = argAll("origin");

if (!keyPath || !keyId || !teamId) {
  console.error(
    "Usage: node scripts/generate-token.js --key <path-to-AuthKey.p8> --keyId <KEY_ID> --teamId <TEAM_ID> [--expires <seconds>] [--origin <url>]"
  );
  process.exit(1);
}

let jwt;
try {
  jwt = require("jsonwebtoken");
} catch {
  console.error("Missing dependency. Run `npm install jsonwebtoken` in this folder first.");
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath);

const payload = origins.length ? { origin: origins } : {};

const token = jwt.sign(payload, privateKey, {
  algorithm: "ES256",
  expiresIn,
  issuer: teamId,
  header: { alg: "ES256", kid: keyId },
});

console.log(token);
