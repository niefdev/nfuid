# NFUID

A compact library for generating and decoding unique, URL-safe IDs using timestamps and random entropy. **NFUID v1.2** introduces improved header obfuscation, stricter validation, and more flexible bit configuration.

**NFUID supports PHP, JavaScript, and Python** with identical logic, structure, and results across all languages.

## Features

- Generates short, unique IDs with timestamp and random entropy
- Customizable base alphabet (default: alphanumeric, no ambiguous characters)
- Configurable timestamp and entropy lengths (default: 43 bits timestamp, 78 bits entropy)
- Decodes IDs to extract timestamp, entropy, and bit structure
- No dependencies or external settings required in any language

## Installation

### Via npm (JavaScript/Node.js)

```bash
npm install nfuid
```

### Via Composer (PHP)

```bash
composer require niefdev/nfuid
```

### Via pip (Python)

```bash
pip install nfuid
```

## Usage

> **Usage is identical in PHP, JavaScript, and Python. Only syntax differs. No dependencies or extra setup required.**

### Initialize

**JavaScript**
```javascript
const NFUID = require('nfuid');
const idGen = new NFUID({
    baseAlphabet: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
    timestampLength: 43, // bits for timestamp (0-63)
    entropyLength: 78    // bits for random entropy (>= timestampLength + 6)
});
```

**PHP**
```php
$nfuid = new NFUID([
    'baseAlphabet' => "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
    'timestampLength' => 43,
    'entropyLength' => 78
]);
```

**Python**
```python
from nfuid import NFUID
nfuid = NFUID(
    base_alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
    timestamp_length=43,
    entropy_length=78
)
```

### Generate ID

```js
const id = idGen.generate(); // JS
```
```php
$id = $nfuid->generate(); // PHP
```
```python
id = nfuid.generate() # Python
```

### Decode ID

```js
const decoded = idGen.decode(id); // JS
```
```php
$decoded = $nfuid->decode($id); // PHP
```
```python
decoded = nfuid.decode(id) # Python
```

Decoded result:
```json
{
  "timestampLength": 43,
  "timestamp": 1736967023123,
  "randomLength": 78,
  "random": "e5f6a7b8...",
  "formattedTimestamp": "2024-06-01 12:34:56.789",
  "binary": "..." // binary representation
}
```

## Technical Details

### Architecture

NFUID v1.2 IDs are structured as follows:

- **Static Flag**: 1 bit, always set to 1 (for easy parsing)
- **Header**: 6 bits, obfuscated with random bits, encodes timestamp length
- **Timestamp**: Configurable bits (0-63), XOR-masked with random bits
- **Random Entropy**: Configurable bits (>= timestampLength + 6), provides uniqueness and obfuscation
- **Base Encoding**: All bits are encoded using the custom alphabet

The library uses big integer math and cryptographically secure random generation in all supported languages.

### Bit Structure

- Total bits: 1 (flag) + 6 (header) + timestampLength + entropyLength
- Format: [1 | header (XOR) | timestamp (XOR) | random]
- Encoded to base alphabet (default: 57 characters, ~5.83 bits/char)

Example: 1 + 6 + 43 + 78 = 128 bits → ~22 characters.

### Key Methods

- `constructor` / `__construct` / `__init__`: Initializes with validated config.
- `generate()`: Combines flag, header, timestamp, and entropy, then encodes to a string.
- `decode(id)`: Extracts timestamp length, timestamp, random bits, and date from an ID.
- Private methods: base conversion, random number generation.

### Security Notes

- Uses cryptographically secure random generation in all languages.
- Not suitable for cryptographic secrets.

## Notes

- **Compatibility**: Works in PHP, JavaScript (Node.js & browser), and Python (3.6+).
- **Limitations**: Not for cryptographic use.
- **Size**: Single class, no dependencies, minimal footprint.

## Contributing

Feedback and improvements are welcome! Submit issues or pull requests to the repository.

## License

[MIT License](LICENSE)

## Author

Created by [@niefdev](https://github.com/niefdev)

