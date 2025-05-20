# NFUID

A compact JavaScript library for generating and decoding unique, URL-safe IDs using timestamps and random entropy. NFUID v1.2 introduces a new bit structure with a static leading flag, header obfuscation, and improved decoding logic. It works in both browser and Node.js environments.

## Features

- Generates short, unique IDs with timestamp and random entropy
- Customizable base alphabet (default: alphanumeric, no ambiguous characters)
- Configurable timestamp and entropy lengths
- Decodes IDs to extract timestamp, entropy, and bit structure
- Browser-compatible, no dependencies

## Installation

### Via npm

```bash
npm install nfuid
```

```javascript
const NFUID = require('nfuid');
```

### Manual Inclusion

Copy `src/nfuid.js` into your project or include `dist/nfuid.min.js` in your HTML:

```html
<script src="dist/nfuid.min.js"></script>
```

## Usage

### Initialize

```javascript
const idGen = new NFUID({
    baseAlphabet: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
    timestampLength: 32, // bits for timestamp (0-63)
    entropyLength: 96    // bits for random entropy (>= timestampLength + 6)
});
```

### Generate ID

```javascript
const id = idGen.generate();
console.log("ID:", id);
```

### Decode ID

```javascript
const decoded = idGen.decode(id);
console.log("Decoded:", decoded);
// {
//   timestampLength: 32,
//   timestamp: 1736967023,
//   randomLength: 96,
//   random: "e5f6a7b8...",
//   formattedTimestamp: Date,
//   binary: "..." // binary representation
// }
```

### Browser Example

See `examples/browser.html` for a working demo.

## Technical Details

### Architecture

NFUID v1.2 IDs are structured as follows:

- **Static Flag**: 1 bit, always set to 1 (for easy parsing)
- **Header**: 6 bits, obfuscated with random bits, encodes timestamp length
- **Timestamp**: Configurable bits (0-63), XOR-masked with random bits
- **Random Entropy**: Configurable bits (>= timestampLength + 6), provides uniqueness and obfuscation
- **Base Encoding**: All bits are encoded using the custom alphabet

The library uses BigInt for large numbers and crypto.getRandomValues for secure random bits.

### Bit Structure

- Total bits: 1 (flag) + 6 (header) + timestampLength + entropyLength
- Format: [1 | header (XOR) | timestamp (XOR) | random]
- Encoded to base alphabet (default: 57 characters, ~5.83 bits/char)

Example: 1 + 6 + 32 + 96 = 135 bits → ~24 characters.

### Key Methods

- `constructor({ baseAlphabet, timestampLength, entropyLength })`: Initializes with validated config.
- `generate()`: Combines flag, header, timestamp, and entropy, then encodes to a string.
- `decode(id)`: Extracts timestamp length, timestamp, random bits, and date from an ID.
- Private methods: `#toBase`, `#fromBase` (base conversion), `#generateRandomBits` (random number generation).

### Security Notes

- Uses crypto.getRandomValues for secure randomness.
- Not suitable for cryptographic secrets.

## Notes

- **Compatibility**: Works in modern browsers (Chrome 74+, Firefox 90+, Safari 14.1+) and Node.js, using BigInt and crypto.getRandomValues.
- **Limitations**: Not for cryptographic use; timestamp resolution is in seconds.
- **Size**: Single class, no dependencies, minified version ~1KB.

## Contributing

Feedback and improvements are welcome! Submit issues or pull requests to the repository.

## License

[MIT License](LICENSE)

## Author

Created by [@niefdev](https://github.com/niefdev)

