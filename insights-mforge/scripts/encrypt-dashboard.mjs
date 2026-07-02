import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const [, , inputFile, outputFile] = process.argv;
const passphrase = process.env.DASHBOARD_PASSPHRASE;
if (!inputFile || !outputFile || !passphrase) {
  console.error("Uso: DASHBOARD_PASSPHRASE='...' node encrypt-dashboard.mjs entrada.json saida.enc.json");
  process.exit(2);
}
if (passphrase.length < 16) throw new Error("DASHBOARD_PASSPHRASE deve ter pelo menos 16 caracteres.");

const plaintext = await fs.readFile(inputFile);
JSON.parse(plaintext.toString("utf8"));
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(passphrase, salt, 310000, 32, "sha256");
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]);
const envelope = {
  version: 1,
  algorithm: "AES-256-GCM",
  kdf: "PBKDF2-SHA256",
  iterations: 310000,
  salt: salt.toString("base64"),
  iv: iv.toString("base64"),
  ciphertext: ciphertext.toString("base64")
};
await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, `${JSON.stringify(envelope)}\n`, "utf8");
