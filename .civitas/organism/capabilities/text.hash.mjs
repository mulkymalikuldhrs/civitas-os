// capability text.hash — dilahirkan otomatis oleh organisme (L4)
import crypto from "node:crypto";
const input = process.argv[2] ?? "";
process.stdout.write(crypto.createHash("sha256").update(input).digest("hex"));
