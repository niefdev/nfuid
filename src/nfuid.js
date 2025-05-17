class NFUID {
  #BASE_ALPHABET;
  #BASE_MAP;
  #timestampBits;
  #randomBits;
  #baseRadix;

  constructor({
    baseAlphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
    timestampLength = 32,
    entropyLength = 96,
  } = {}) {
    // Validate inputs
    if (!/^[\x21-\x7E]+$/.test(baseAlphabet) || baseAlphabet.includes(" ")) {
      throw new Error(
        "Base alphabet must contain only valid ASCII characters without whitespace"
      );
    }

    if (new Set(baseAlphabet.split("")).size !== baseAlphabet.length) {
      throw new Error("Base alphabet must not contain duplicate characters");
    }

    this.#BASE_ALPHABET = baseAlphabet;
    this.#baseRadix = BigInt(baseAlphabet.length);
    this.#timestampBits = timestampLength;
    this.#randomBits = entropyLength;

    // Initialize base mapping
    this.#BASE_MAP = {};
    for (let i = 0; i < this.#BASE_ALPHABET.length; i++) {
      this.#BASE_MAP[this.#BASE_ALPHABET[i]] = BigInt(i);
    }
  }

  #toBase(num, minLength = 0) {
    if (num === 0n) return this.#BASE_ALPHABET[0];

    let result = "";
    while (num > 0n) {
      const rem = num % this.#baseRadix;
      num = num / this.#baseRadix;
      result = this.#BASE_ALPHABET[Number(rem)] + result;
    }

    while (result.length < minLength) {
      result = this.#BASE_ALPHABET[0] + result;
    }

    return result;
  }

  #fromBase(str) {
    let result = 0n;
    for (const char of str) {
      const value = this.#BASE_MAP[char];
      if (value === undefined)
        throw new Error(`Invalid character in encoded string: ${char}`);
      result = result * this.#baseRadix + value;
    }
    return result;
  }

  #generateRandomBits(bits) {
    const bytes = Math.ceil(bits / 8);
    const buffer = new Uint8Array(bytes);
    crypto.getRandomValues(buffer);
    let value = 0n;
    for (const byte of buffer) {
      value = (value << 8n) | BigInt(byte);
    }
    return value & ((1n << BigInt(bits)) - 1n);
  }

  generate() {
    const timestampMask = (1n << BigInt(this.#timestampBits)) - 1n;
    const timestamp = BigInt(Math.floor(Date.now() / 1000)) & timestampMask;

    const seedBits = this.#timestampBits // Limit seed to reasonable size
    const seed = this.#generateRandomBits(seedBits);
    const xor = timestamp ^ seed;

    const randBits = this.#generateRandomBits(this.#randomBits);

    // Total bits: timestampBits (for xor) + seedBits + randomBits
    const totalBits = this.#timestampBits + seedBits + this.#randomBits;

    // Combine all parts
    const finalValue =
      (xor << BigInt(seedBits + this.#randomBits)) |
      (seed << BigInt(this.#randomBits)) |
      randBits;

    // Calculate required length in the chosen base
    const bitsPerChar = Math.log2(this.#BASE_ALPHABET.length);
    const minLength = Math.ceil(totalBits / bitsPerChar);

    return this.#toBase(finalValue, minLength);
  }

  decode(id) {
    const full = this.#fromBase(id);

    const seedBits = this.#timestampBits
    const timestampMask = (1n << BigInt(this.#timestampBits)) - 1n;
    const seedMask = (1n << BigInt(seedBits)) - 1n;
    const randomMask = (1n << BigInt(this.#randomBits)) - 1n;

    const xor = (full >> BigInt(seedBits + this.#randomBits)) & timestampMask;
    const seed = (full >> BigInt(this.#randomBits)) & seedMask;
    const rand = full & randomMask;

    const timestamp = xor ^ seed;

    return {
      timestamp: Number(timestamp),
      seed: seed.toString(16).padStart(Math.ceil(seedBits / 4), "0"),
      random: rand.toString(16).padStart(Math.ceil(this.#randomBits / 4), "0"),
      date: new Date(Number(timestamp) * 1000),
    };
  }
}

module.exports = NFUID;