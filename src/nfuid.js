class NFUID {
  #BASE_ALPHABET;
  #BASE_MAP;
  #timestampBits;
  #randomBits;
  #baseRadix;

  constructor({
    baseAlphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
    timestampLength = 43,
    entropyLength = 78,
  } = {}) {
    // Validate the base alphabet: must be ASCII and cannot include whitespace
    if (!/^[\x21-\x7E]+$/.test(baseAlphabet) || baseAlphabet.includes(" ")) {
      throw new Error(
        "Base alphabet must contain only valid ASCII characters without whitespace"
      );
    }

    // Ensure all characters in the alphabet are unique
    if (new Set(baseAlphabet.split("")).size !== baseAlphabet.length) {
      throw new Error("Base alphabet must not contain duplicate characters");
    }

    // Timestamp length must be within a valid range
    if (timestampLength < 0 || timestampLength > 63) {
      throw new Error("Timestamp length must be between 0 and 63 bits");
    }

    // Ensure there's enough space for timestamp + header (6 bits)
    if (entropyLength < 6 + timestampLength) {
      throw new Error(
        `Entropy length must be at least ${6 + timestampLength} bits (timestamp + 6 bits)`
      );
    }

    this.#BASE_ALPHABET = baseAlphabet;
    this.#baseRadix = BigInt(baseAlphabet.length);
    this.#timestampBits = timestampLength;
    this.#randomBits = entropyLength;

    // Create a lookup map for character-to-index conversions
    this.#BASE_MAP = {};
    for (let i = 0; i < this.#BASE_ALPHABET.length; i++) {
      this.#BASE_MAP[this.#BASE_ALPHABET[i]] = BigInt(i);
    }
  }

  // Converts a BigInt to a string using the custom base alphabet
  #toBase(num, minLength = 0) {
    if (num === 0n) {
      return this.#BASE_ALPHABET[0].repeat(minLength || 1);
    }

    let result = "";
    let n = num;

    while (n > 0n) {
      const rem = n % this.#baseRadix;
      n = n / this.#baseRadix;
      result = this.#BASE_ALPHABET[Number(rem)] + result;
    }

    // Pad the result to match the minimum required length
    while (result.length < minLength) {
      result = this.#BASE_ALPHABET[0] + result;
    }

    return result;
  }

  // Converts a base-encoded string back into a BigInt
  #fromBase(str) {
    let result = 0n;
    for (const char of str) {
      const value = this.#BASE_MAP[char];
      if (value === undefined) {
        throw new Error(`Invalid character in encoded string: ${char}`);
      }
      result = result * this.#baseRadix + value;
    }
    return result;
  }

  // Generates a random BigInt of the specified bit length
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
    const headerBits = 6;
    const header = BigInt(this.#timestampBits);

    // Use current time (in ms), masked to the allowed timestamp bit length
    const timestampMask = (1n << BigInt(this.#timestampBits)) - 1n;
    const timestamp =
      this.#timestampBits > 0
        ? BigInt(Date.now()) & timestampMask
        : 0n;

    const randBits = this.#generateRandomBits(this.#randomBits);

    let finalHeader = header;
    let finalTimestamp = timestamp;

    // Use the last 6 bits of the random value to obfuscate the header
    const headerXorMask = randBits & ((1n << BigInt(headerBits)) - 1n);
    finalHeader = header ^ headerXorMask;
  
    if (this.#timestampBits > 0) {
      // Use the highest bits of the random value to obfuscate the timestamp
      const timestampXorMask =
        randBits >> BigInt(this.#randomBits - this.#timestampBits);
      finalTimestamp = timestamp ^ timestampXorMask;
    }

    // Combine all parts into a single BigInt:
    // 1 (flag) + 6-bit header + timestamp + random
    let finalValue = 1n; // leading flag bit

    finalValue = (finalValue << BigInt(headerBits)) | finalHeader;

    if (this.#timestampBits > 0) {
      finalValue = (finalValue << BigInt(this.#timestampBits)) | finalTimestamp;
    }

    finalValue = (finalValue << BigInt(this.#randomBits)) | randBits;

    // Estimate how many characters are needed to represent the value
    const totalBits = BigInt(
      1 + headerBits + this.#timestampBits + this.#randomBits
    );
    const bitsPerChar = Math.log2(this.#BASE_ALPHABET.length);
    const minLength = Math.ceil(Number(totalBits) / bitsPerChar);

    return this.#toBase(finalValue, minLength);
  }

  decode(id) {
    const full = this.#fromBase(id);
    const binary = full.toString(2).slice(1); // Remove leading 1-bit flag

    const fullLength = binary.length;
    const value = full ^ (1n << BigInt(fullLength)); // Clear the leading flag

    const headerBits = 6;
    const headerMask = (1n << BigInt(headerBits)) - 1n;

    const headerShift = BigInt(fullLength - headerBits);
    const encodedHeader = (value >> headerShift) & headerMask;

    // Extract the original XOR mask used to obfuscate the header
    const headerXorMask = value & headerMask;

    // Reconstruct the actual timestamp bit length
    const actualTimestampBits = Number(encodedHeader ^ headerXorMask);

    const randomBitsLength = fullLength - headerBits - actualTimestampBits;
    const randomMask = (1n << BigInt(randomBitsLength)) - 1n;
    const encodedRandom = value & randomMask;

    const result = {
      timestampLength: actualTimestampBits,
      timestamp: 0,
      randomLength: Number(randomBitsLength),
      random: encodedRandom.toString(16),
      formattedTimestamp: null,
      binary: binary
    };

    if (actualTimestampBits > 0) {
      const timestampShift = BigInt(randomBitsLength);
      const timestampMask = (1n << BigInt(actualTimestampBits)) - 1n;
      const encodedTimestamp = (value >> timestampShift) & timestampMask;

      // Recover the timestamp by reversing the XOR mask
      const timestampXorMask = encodedRandom >> BigInt(randomBitsLength - actualTimestampBits);
      const actualTimestamp = encodedTimestamp ^ timestampXorMask;

      result.timestamp = Number(actualTimestamp);
      result.formattedTimestamp = new Date(Number(actualTimestamp));
    }

    return result;
  }
}

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = NFUID;
} else {
  window.NFUID = NFUID;
}