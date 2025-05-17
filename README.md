# NFUID

A simple JavaScript library for generating and decoding unique, URL-safe IDs using timestamps and random entropy. Born from a modest attempt to balance scalability and simplicity, NFUID is a small tool designed to be reliable and easy to use in both browser and Node.js environments.

## Features

- Generates compact IDs with timestamp, seed, and random components
- Customizable base alphabet (default: alphanumeric, no ambiguous characters)
- Configurable timestamp and entropy lengths
- Decodes IDs to extract timestamp, seed, and date
- Browser-compatible with no dependencies

## Installation

### Via npm

```bash
npm install nfuid
```

```javascript
const { NFUID } = require('nfuid');
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
    timestampLength: 32,
    entropyLength: 96
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
// { timestamp: 1736967023, seed: "a1b2c3d4", random: "e5f6a7b8", date: Date }
```

### Browser Example

See `examples/browser.html` for a working demo.

## Technical Details

### Architecture

NFUID creates IDs by combining:

- **Timestamp**: Unix time (seconds), masked to timestampLength bits, XORed with a seed for obfuscation.
- **Seed**: Random bits (up to 64 bits) for added uniqueness.
- **Random Entropy**: Additional random bits (entropyLength) for collision resistance.
- **Base Encoding**: Converts the combined value to a string using a custom alphabet.

The library uses BigInt for large numbers and crypto.getRandomValues for secure random bits.

### Bit Structure

- Total bits: timestampLength (XOR) + min(timestampLength, 64) (seed) + entropyLength
- Format: [XOR(timestamp, seed) | seed | random]
- Encoded to base alphabet (default: 57 characters, ~5.83 bits/char)

Example: 160 bits (32 timestamp + 32 seed + 96 entropy) yields ~28 characters.

### Key Methods

- `constructor({ baseAlphabet, timestampLength, entropyLength })`: Initializes with validated config.
- `generate()`: Combines timestamp, seed, and entropy, then encodes to a string.
- `decode(id)`: Extracts timestamp, seed, random bits, and date from an ID.
- Private methods: #toBase, #fromBase (base conversion), #generateRandomBits (random number generation).

### Security Notes

- Uses crypto.getRandomValues for secure randomness.
- Not suitable for cryptographic purposes (e.g., secrets).

## Notes

- **Compatibility**: Works in modern browsers (Chrome 74+, Firefox 90+, Safari 14.1+) and Node.js, using BigInt and crypto.getRandomValues.
- **Limitations**: Not for cryptographic use; timestamp resolution is in seconds.
- **Size**: Single class, no dependencies, minified version ~1KB.

## Contributing

This is a simple project, but feedback or improvements are welcome! Submit issues or pull requests to the repository.

## License

[MIT License](LICENSE)

## Author

Created by [@niefdev](https://github.com/niefdev)
