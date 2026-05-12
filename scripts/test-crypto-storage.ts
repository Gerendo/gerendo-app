import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Generate and set a 32-byte master key BEFORE importing the crypto-storage module.
const validKeyB64 = randomBytes(32).toString("base64");
process.env.GERENDO_MASTER_KEY = validKeyB64;

const { encrypt, decrypt, __resetKeyCacheForTests } = await import(
  "../src/lib/crypto-storage"
);

type TestFn = () => void | Promise<void>;

async function runTest(name: string, fn: TestFn): Promise<void> {
  try {
    await fn();
    console.log(`OK ${name}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`FAILED: ${name} - ${msg}`);
  }
}

function assertThrows(fn: () => unknown, messageSubstring?: string): Error {
  let thrown: unknown = null;
  try {
    fn();
  } catch (e) {
    thrown = e;
  }
  if (thrown === null) {
    throw new Error(`expected function to throw, but it did not`);
  }
  const err = thrown instanceof Error ? thrown : new Error(String(thrown));
  if (messageSubstring && !err.message.toLowerCase().includes(messageSubstring.toLowerCase())) {
    throw new Error(
      `expected error message to include "${messageSubstring}", got: "${err.message}"`,
    );
  }
  return err;
}

let currentTest = "<none>";

async function main(): Promise<void> {
  // roundtrip-basic
  currentTest = "roundtrip-basic";
  await runTest(currentTest, () => {
    const aad = "embeddings:keyword_text:ws1:gmail:abc";
    const blob = encrypt("hello world", aad);
    const out = decrypt(blob, aad);
    assert.equal(out, "hello world");
  });

  // roundtrip-empty
  currentTest = "roundtrip-empty";
  await runTest(currentTest, () => {
    const aad = "aad-empty";
    const blob = encrypt("", aad);
    const out = decrypt(blob, aad);
    assert.equal(out, "");
  });

  // roundtrip-unicode
  currentTest = "roundtrip-unicode";
  await runTest(currentTest, () => {
    const plaintext = "Ștefan și ⚡ \n\t";
    const aad = "aad-unicode";
    const blob = encrypt(plaintext, aad);
    const out = decrypt(blob, aad);
    // Byte-for-byte equality via Buffer compare on UTF-8 bytes.
    assert.equal(
      Buffer.from(out, "utf8").equals(Buffer.from(plaintext, "utf8")),
      true,
      "decrypted bytes do not match plaintext bytes",
    );
    assert.equal(out, plaintext);
  });

  // roundtrip-long
  currentTest = "roundtrip-long";
  await runTest(currentTest, () => {
    // 50KB string. Use printable ASCII random characters for simplicity.
    const len = 50 * 1024;
    const buf = randomBytes(len);
    // Map each byte to a printable ASCII char (33..126), preserving length.
    let s = "";
    for (let i = 0; i < len; i++) {
      s += String.fromCharCode(33 + (buf[i] % (126 - 33 + 1)));
    }
    assert.equal(s.length, len);
    const aad = "aad-long";
    const blob = encrypt(s, aad);
    const out = decrypt(blob, aad);
    assert.equal(out, s);
  });

  // wrong-aad-fails
  currentTest = "wrong-aad-fails";
  await runTest(currentTest, () => {
    const blob = encrypt("payload", "A");
    assertThrows(() => decrypt(blob, "B"));
  });

  // tampered-ciphertext-fails
  currentTest = "tampered-ciphertext-fails";
  await runTest(currentTest, () => {
    const aad = "aad-tamper-ct";
    const blob = encrypt("some plaintext here that is long enough", aad);
    // Sanity: blob must have at least 1+12+1+16 bytes for offset 14 to be inside ciphertext.
    assert.ok(blob.length > 1 + 12 + 1 + 16, "blob unexpectedly short");
    const tampered = Buffer.from(blob);
    tampered[1 + 12 + 1] = tampered[1 + 12 + 1] ^ 0x01;
    assertThrows(() => decrypt(tampered, aad));
  });

  // tampered-tag-fails
  currentTest = "tampered-tag-fails";
  await runTest(currentTest, () => {
    const aad = "aad-tamper-tag";
    const blob = encrypt("payload", aad);
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] = tampered[tampered.length - 1] ^ 0x01;
    assertThrows(() => decrypt(tampered, aad));
  });

  // wrong-version-fails
  currentTest = "wrong-version-fails";
  await runTest(currentTest, () => {
    const aad = "aad-version";
    const blob = encrypt("payload", aad);
    const tampered = Buffer.from(blob);
    tampered[0] = 0x02;
    assertThrows(() => decrypt(tampered, aad), "version");
  });

  // truncated-blob-fails
  currentTest = "truncated-blob-fails";
  await runTest(currentTest, () => {
    const tiny = Buffer.alloc(5);
    assertThrows(() => decrypt(tiny, "anything"), "too short");
  });

  // nonce-uniqueness
  currentTest = "nonce-uniqueness";
  await runTest(currentTest, () => {
    const aad = "aad-nonce";
    const plaintext = "the same plaintext every time";
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const blob = encrypt(plaintext, aad);
      const hex = blob.toString("hex");
      if (seen.has(hex)) {
        throw new Error(`duplicate ciphertext at iteration ${i}`);
      }
      seen.add(hex);
    }
    assert.equal(seen.size, 100);
  });

  // missing-key-fails
  currentTest = "missing-key-fails";
  await runTest(currentTest, () => {
    __resetKeyCacheForTests();
    const saved = process.env.GERENDO_MASTER_KEY;
    delete process.env.GERENDO_MASTER_KEY;
    try {
      assertThrows(() => encrypt("x", "y"), "GERENDO_MASTER_KEY");
    } finally {
      // Restore for any subsequent code.
      if (saved !== undefined) {
        process.env.GERENDO_MASTER_KEY = saved;
      } else {
        process.env.GERENDO_MASTER_KEY = validKeyB64;
      }
      __resetKeyCacheForTests();
    }
  });

  // wrong-key-length-fails
  currentTest = "wrong-key-length-fails";
  await runTest(currentTest, () => {
    __resetKeyCacheForTests();
    const saved = process.env.GERENDO_MASTER_KEY;
    process.env.GERENDO_MASTER_KEY = randomBytes(16).toString("base64");
    try {
      assertThrows(() => encrypt("x", "y"), "32 bytes");
    } finally {
      process.env.GERENDO_MASTER_KEY = saved ?? validKeyB64;
      __resetKeyCacheForTests();
    }
  });

  console.log("ALL TESTS PASSED");
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  // If runTest threw, msg already starts with "FAILED:". Otherwise wrap it.
  if (msg.startsWith("FAILED:")) {
    console.error(msg);
  } else {
    console.error(`FAILED: ${currentTest} - ${msg}`);
  }
  process.exit(1);
});
