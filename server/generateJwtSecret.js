// generateJwtSecret.js
import crypto from "crypto";

const secret = crypto.randomBytes(64).toString("hex"); // 64 bytes = 128 chars in hex
console.log("Your new JWT_SECRET:", secret);