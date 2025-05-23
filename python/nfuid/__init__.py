import os
import re
import time
from datetime import datetime

class NFUID:
    def __init__(self, base_alphabet="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz", 
                 timestamp_length=43, entropy_length=78):
        # Validate the base alphabet: must be ASCII and cannot include whitespace
        if not re.match(r'^[\x21-\x7E]+$', base_alphabet) or ' ' in base_alphabet:
            raise ValueError(
                "Base alphabet must contain only valid ASCII characters without whitespace"
            )

        # Ensure all characters in the alphabet are unique
        if len(set(base_alphabet)) != len(base_alphabet):
            raise ValueError("Base alphabet must not contain duplicate characters")

        # Timestamp length must be within a valid range
        if timestamp_length < 0 or timestamp_length > 63:
            raise ValueError("Timestamp length must be between 0 and 63 bits")

        # Ensure there's enough space for timestamp + header (6 bits)
        if entropy_length < 6 + timestamp_length:
            raise ValueError(
                f"Entropy length must be at least {6 + timestamp_length} bits (timestamp + 6 bits)"
            )

        self._base_alphabet = base_alphabet
        self._base_radix = len(base_alphabet)
        self._timestamp_bits = timestamp_length
        self._random_bits = entropy_length

        # Create a lookup map for character-to-index conversions
        self._base_map = {}
        for i, char in enumerate(self._base_alphabet):
            self._base_map[char] = i

    def _to_base(self, num, min_length=0):
        """Converts a number to a string using the custom base alphabet"""
        if num == 0:
            return self._base_alphabet[0] * max(min_length, 1)

        result = ""
        n = num

        while n > 0:
            rem = n % self._base_radix
            n = n // self._base_radix
            result = self._base_alphabet[rem] + result

        # Pad the result to match the minimum required length
        while len(result) < min_length:
            result = self._base_alphabet[0] + result

        return result

    def _from_base(self, string):
        """Converts a base-encoded string back into a number"""
        result = 0
        for char in string:
            if char not in self._base_map:
                raise ValueError(f"Invalid character in encoded string: {char}")
            value = self._base_map[char]
            result = result * self._base_radix + value
        return result

    def _generate_random_bits(self, bits):
        """Generates a random number of the specified bit length"""
        bytes_needed = (bits + 7) // 8
        random_bytes = os.urandom(bytes_needed)
        
        value = 0
        for byte in random_bytes:
            value = (value << 8) | byte
        
        # Mask to the specified bit length
        mask = (1 << bits) - 1
        return value & mask

    def generate(self):
        """Generate a new NFUID"""
        header_bits = 6
        header = self._timestamp_bits

        # Use current time (in ms), masked to the allowed timestamp bit length
        timestamp_mask = (1 << self._timestamp_bits) - 1
        timestamp = (
            int(time.time() * 1000) & timestamp_mask
            if self._timestamp_bits > 0
            else 0
        )

        rand_bits = self._generate_random_bits(self._random_bits)

        # Use the last 6 bits of the random value to obfuscate the header
        header_xor_mask = rand_bits & ((1 << header_bits) - 1)
        final_header = header ^ header_xor_mask

        final_timestamp = timestamp
        if self._timestamp_bits > 0:
            # Use the highest bits of the random value to obfuscate the timestamp
            timestamp_xor_mask = rand_bits >> (self._random_bits - self._timestamp_bits)
            final_timestamp = timestamp ^ timestamp_xor_mask

        # Combine all parts into a single number:
        # 1 (flag) + 6-bit header + timestamp + random
        final_value = 1  # leading flag bit

        final_value = (final_value << header_bits) | final_header

        if self._timestamp_bits > 0:
            final_value = (final_value << self._timestamp_bits) | final_timestamp

        final_value = (final_value << self._random_bits) | rand_bits

        # Estimate how many characters are needed to represent the value
        total_bits = 1 + header_bits + self._timestamp_bits + self._random_bits
        bits_per_char = __import__('math').log2(self._base_radix)
        min_length = __import__('math').ceil(total_bits / bits_per_char)

        return self._to_base(final_value, min_length)

    def decode(self, nfuid_string):
        """Decode a NFUID string"""
        full = self._from_base(nfuid_string)
        binary = bin(full)[3:]  # Remove '0b' and leading 1-bit flag

        full_length = len(binary)
        value = full ^ (1 << full_length)  # Clear the leading flag

        header_bits = 6
        header_mask = (1 << header_bits) - 1

        header_shift = full_length - header_bits
        encoded_header = (value >> header_shift) & header_mask

        # Extract the original XOR mask used to obfuscate the header
        header_xor_mask = value & header_mask

        # Reconstruct the actual timestamp bit length
        actual_timestamp_bits = encoded_header ^ header_xor_mask

        random_bits_length = full_length - header_bits - actual_timestamp_bits
        random_mask = (1 << random_bits_length) - 1
        encoded_random = value & random_mask

        result = {
            'timestampLength': actual_timestamp_bits,
            'timestamp': 0,
            'randomLength': random_bits_length,
            'random': hex(encoded_random)[2:],  # Remove '0x' prefix
            'formattedTimestamp': None,
            'binary': binary
        }

        if actual_timestamp_bits > 0:
            timestamp_shift = random_bits_length
            timestamp_mask = (1 << actual_timestamp_bits) - 1
            encoded_timestamp = (value >> timestamp_shift) & timestamp_mask

            # Recover the timestamp by reversing the XOR mask
            timestamp_xor_mask = encoded_random >> (random_bits_length - actual_timestamp_bits)
            actual_timestamp = encoded_timestamp ^ timestamp_xor_mask

            result['timestamp'] = actual_timestamp
            
            # Format timestamp with milliseconds
            timestamp_sec = actual_timestamp // 1000
            timestamp_ms = actual_timestamp % 1000
            dt = datetime.fromtimestamp(timestamp_sec)
            
            # Add milliseconds to the formatted date
            formatted_date = f"{dt.strftime('%Y-%m-%d %H:%M:%S')}.{timestamp_ms:03d}"
            result['formattedTimestamp'] = formatted_date

        return result
