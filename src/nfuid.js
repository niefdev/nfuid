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

    // Validate timestamp length
    if (timestampLength < 0 || timestampLength > 63) {
      throw new Error("Timestamp length must be between 0 and 63 bits");
    }

    if (entropyLength < 6 + timestampLength) {
      throw new Error(
        `Entropy length must be at least ${6 + timestampLength} bits (timestamp + 6 bits)`
      );
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

    // Tambahkan padding '0' di depan agar panjang string tetap minLength
    while (result.length < minLength) {
      result = this.#BASE_ALPHABET[0] + result;
    }

    return result;
  }

  // Decode base string ke BigInt
  // *tidak* ada parameter minLength, dan tidak menghilangkan nol depan di angka
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
    // Create header (6 bits containing timestamp length)
    const headerBits = 6;
    const header = BigInt(this.#timestampBits);

    // Get current timestamp (Unix epoch in seconds)
    const timestampMask = (1n << BigInt(this.#timestampBits)) - 1n;
    const timestamp =
      this.#timestampBits > 0
        ? BigInt(Math.floor(Date.now() / 1000)) & timestampMask
        : 0n;

    // Generate random bits
    const randBits = this.#generateRandomBits(this.#randomBits);

    let finalHeader = header;
    let finalTimestamp = timestamp;

    // Ambil 6 bit terakhir untuk header XOR mask
    const headerXorMask =
      randBits & ((1n << BigInt(headerBits)) - 1n); // ambil 6 bit terakhir
    finalHeader = header ^ headerXorMask;
  
    // Ambil N bit pertama dari randBits (paling kiri) untuk timestamp XOR mask
    if (this.#timestampBits > 0) {
      const timestampXorMask =
        randBits >> BigInt(this.#randomBits - this.#timestampBits);
      finalTimestamp = timestamp ^ timestampXorMask;
    }
    

    // Combine all parts: hidden flag + header + timestamp + random
    // Add a static 1 bit at the most significant position
    let finalValue = 1n;

    // Add header bits (6 bits)
    finalValue = (finalValue << BigInt(headerBits)) | finalHeader;

    // Add timestamp bits if any
    if (this.#timestampBits > 0) {
      finalValue = (finalValue << BigInt(this.#timestampBits)) | finalTimestamp;
    }

    // Add random bits
    finalValue = (finalValue << BigInt(this.#randomBits)) | randBits;

    // Calculate total bits and required length in the chosen base
    const totalBits = BigInt(
      1 + headerBits + this.#timestampBits + this.#randomBits
    ); // 1 for hidden flag
    const bitsPerChar = Math.log2(this.#BASE_ALPHABET.length);
    const minLength = Math.ceil(Number(totalBits) / bitsPerChar);

    // Convert to base
    return this.#toBase(finalValue, minLength);
  }

  decode(id) {
    // Convert base string to BigInt
    const full = this.#fromBase(id);
    const binary = full.toString(2).slice(1);
    
    // Get the total number of bits (minus the leading 1 flag)
    const fullLength = binary.length;
    
    // Remove the static leading 1 bit
    const value = full ^ (1n << BigInt(fullLength));
    
    // Constants
    const headerBits = 6;
    const headerMask = (1n << BigInt(headerBits)) - 1n;
    
    // Extract header (6 bits, MSB after leading 1)
    const headerShift = BigInt(fullLength - headerBits);
    const encodedHeader = (value >> headerShift) & headerMask;
    
    // Extract XOR mask for header (last 6 bits of random)
    const headerXorMask = value & headerMask;
    
    // Decode the actual timestampBits
    const actualTimestampBits = Number(encodedHeader ^ headerXorMask);
    
    // Calculate actual randomBitsLength
    const randomBitsLength = fullLength - headerBits - actualTimestampBits;
    const randomMask = (1n << BigInt(randomBitsLength)) - 1n;
    
    // Extract random bits
    const encodedRandom = value & randomMask;
    
    // Prepare result object
    const result = {
      timestampLength: actualTimestampBits,
      timestamp: 0,
      randomLength: Number(randomBitsLength),
      random: encodedRandom.toString(16),
      formattedTimestamp: null,
      binary: binary
    };
    
    // Only process timestamp if it exists
    if (actualTimestampBits > 0) {
      const timestampShift = BigInt(randomBitsLength);
      const timestampMask = (1n << BigInt(actualTimestampBits)) - 1n;
      const encodedTimestamp = (value >> timestampShift) & timestampMask;
      
      // Get XOR mask from highest bits of random
      const timestampXorMask = encodedRandom >> BigInt(randomBitsLength - actualTimestampBits);
      const actualTimestamp = encodedTimestamp ^ timestampXorMask;
      
      result.timestamp = Number(actualTimestamp);
      result.formattedTimestamp = new Date(Number(actualTimestamp) * 1000);
    }
    
    return result;
  }
}

module.exports=NFUID;