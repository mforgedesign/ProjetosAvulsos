import fs from "node:fs/promises";
import crypto from "node:crypto";

const [, , inputFile, outputFile] = process.argv;
const passphrase = process.env.DASHBOARD_PASSPHRASE;
if (!inputFile || !passphrase) {
  console.error("Uso: DASHBOARD_PASSPHRASE='...' node decrypt-dashboard.mjs entrada.enc.json [saida.json]");
  process.exit(2);
}

const envelope = JSON.parse(await fs.readFile(inputFile, "utf8"));
const salt = Buffer.from(envelope.salt, "base64");
const iv = Buffer.from(envelope.iv, "base64");
const blob = Buffer.from(envelope.ciphertext, "base64");
const encrypted = blob.subarray(0, blob.length - 16);
const tag = blob.subarray(blob.length - 16);
const key = crypto.pbkdf2Sync(passphrase, salt, envelope.iterations || 310000, 32, "sha256");
const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
decipher.setAuthTag(tag);
const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
JSON.parse(plaintext.toString("utf8"));
if (outputFile) await fs.writeFile(outputFile, plaintext);
else process.stdout.write(plaintext);
