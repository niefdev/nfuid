<?php

namespace NFUID;

use InvalidArgumentException;
use DateTime;
use DateTimeZone;

class NFUID {
    private $BASE_ALPHABET;
    private $BASE_MAP;
    private $timestampBits;
    private $randomBits;
    private $baseRadix;

    public function __construct($options = []) {
        $baseAlphabet = $options['baseAlphabet'] ?? "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        $timestampLength = $options['timestampLength'] ?? 43;
        $entropyLength = $options['entropyLength'] ?? 78;

        // Validate the base alphabet: must be ASCII and cannot include whitespace
        if (!preg_match('/^[\x21-\x7E]+$/', $baseAlphabet) || strpos($baseAlphabet, ' ') !== false) {
            throw new InvalidArgumentException(
                "Base alphabet must contain only valid ASCII characters without whitespace"
            );
        }

        // Ensure all characters in the alphabet are unique
        if (count(array_unique(str_split($baseAlphabet))) !== strlen($baseAlphabet)) {
            throw new InvalidArgumentException("Base alphabet must not contain duplicate characters");
        }

        // Timestamp length must be within a valid range
        if ($timestampLength < 0 || $timestampLength > 63) {
            throw new InvalidArgumentException("Timestamp length must be between 0 and 63 bits");
        }

        // Ensure there's enough space for timestamp + header (6 bits)
        if ($entropyLength < 6 + $timestampLength) {
            throw new InvalidArgumentException(
                "Entropy length must be at least " . (6 + $timestampLength) . " bits (timestamp + 6 bits)"
            );
        }

        $this->BASE_ALPHABET = $baseAlphabet;
        $this->baseRadix = strlen($baseAlphabet);
        $this->timestampBits = $timestampLength;
        $this->randomBits = $entropyLength;

        // Create a lookup map for character-to-index conversions
        $this->BASE_MAP = [];
        for ($i = 0; $i < strlen($this->BASE_ALPHABET); $i++) {
            $this->BASE_MAP[$this->BASE_ALPHABET[$i]] = $i;
        }
    }

    // Custom big integer math functions
    private function bigAdd($a, $b) {
        $a = (string)$a;
        $b = (string)$b;
        $carry = 0;
        $result = '';
        $i = strlen($a) - 1;
        $j = strlen($b) - 1;

        while ($i >= 0 || $j >= 0 || $carry > 0) {
            $digitA = $i >= 0 ? (int)$a[$i] : 0;
            $digitB = $j >= 0 ? (int)$b[$j] : 0;
            $sum = $digitA + $digitB + $carry;
            $result = ($sum % 10) . $result;
            $carry = intval($sum / 10);
            $i--;
            $j--;
        }

        return $result;
    }

    private function bigMul($a, $b) {
        $a = (string)$a;
        $b = (string)$b;
        $lenA = strlen($a);
        $lenB = strlen($b);
        $result = array_fill(0, $lenA + $lenB, 0);

        for ($i = $lenA - 1; $i >= 0; $i--) {
            for ($j = $lenB - 1; $j >= 0; $j--) {
                $mul = (int)$a[$i] * (int)$b[$j];
                $p1 = $i + $j;
                $p2 = $i + $j + 1;
                $sum = $mul + $result[$p2];

                $result[$p2] = $sum % 10;
                $result[$p1] += intval($sum / 10);
            }
        }

        $resultStr = implode('', $result);
        return ltrim($resultStr, '0') ?: '0';
    }

    private function bigSub($a, $b) {
        $a = (string)$a;
        $b = (string)$b;
        
        if ($this->bigCompare($a, $b) < 0) {
            return '0';
        }

        $result = '';
        $borrow = 0;
        $i = strlen($a) - 1;
        $j = strlen($b) - 1;

        while ($i >= 0) {
            $digitA = (int)$a[$i];
            $digitB = $j >= 0 ? (int)$b[$j] : 0;
            $sub = $digitA - $digitB - $borrow;

            if ($sub < 0) {
                $sub += 10;
                $borrow = 1;
            } else {
                $borrow = 0;
            }

            $result = $sub . $result;
            $i--;
            $j--;
        }

        return ltrim($result, '0') ?: '0';
    }

    private function bigDiv($a, $b) {
        $a = (string)$a;
        $b = (string)$b;
        
        if ($b === '0') return '0';
        if ($this->bigCompare($a, $b) < 0) return '0';

        $result = '';
        $remainder = '0';

        for ($i = 0; $i < strlen($a); $i++) {
            $remainder = $this->bigMul($remainder, '10');
            $remainder = $this->bigAdd($remainder, $a[$i]);
            
            $count = 0;
            while ($this->bigCompare($remainder, $b) >= 0) {
                $remainder = $this->bigSub($remainder, $b);
                $count++;
            }
            
            $result .= $count;
        }

        return ltrim($result, '0') ?: '0';
    }

    private function bigMod($a, $b) {
        $a = (string)$a;
        $b = (string)$b;
        
        if ($b === '0') return '0';
        
        $remainder = '0';
        for ($i = 0; $i < strlen($a); $i++) {
            $remainder = $this->bigMul($remainder, '10');
            $remainder = $this->bigAdd($remainder, $a[$i]);
            
            while ($this->bigCompare($remainder, $b) >= 0) {
                $remainder = $this->bigSub($remainder, $b);
            }
        }

        return $remainder;
    }

    private function bigCompare($a, $b) {
        $a = (string)$a;
        $b = (string)$b;
        
        if (strlen($a) > strlen($b)) return 1;
        if (strlen($a) < strlen($b)) return -1;
        
        return strcmp($a, $b) <=> 0;
    }

    private function bigPow($base, $exp) {
        if ($exp === '0') return '1';
        
        $result = '1';
        for ($i = 0; $i < (int)$exp; $i++) {
            $result = $this->bigMul($result, $base);
        }
        return $result;
    }

    // Convert decimal to hexadecimal using big integer math
    private function decToHex($dec) {
        if ($dec === '0') return '0';
        
        $hex = '';
        $hexChars = '0123456789abcdef';
        
        while ($this->bigCompare($dec, '0') > 0) {
            $remainder = $this->bigMod($dec, '16');
            $hex = $hexChars[(int)$remainder] . $hex;
            $dec = $this->bigDiv($dec, '16');
        }
        
        return $hex ?: '0';
    }

    // Bitwise operations
    private function bigAnd($a, $b) {
        $binA = $this->decToBin($a);
        $binB = $this->decToBin($b);
        $maxLen = max(strlen($binA), strlen($binB));
        $binA = str_pad($binA, $maxLen, '0', STR_PAD_LEFT);
        $binB = str_pad($binB, $maxLen, '0', STR_PAD_LEFT);
        
        $result = '';
        for ($i = 0; $i < $maxLen; $i++) {
            $result .= ($binA[$i] === '1' && $binB[$i] === '1') ? '1' : '0';
        }
        
        return $this->binToDec($result);
    }

    private function bigXor($a, $b) {
        $binA = $this->decToBin($a);
        $binB = $this->decToBin($b);
        $maxLen = max(strlen($binA), strlen($binB));
        $binA = str_pad($binA, $maxLen, '0', STR_PAD_LEFT);
        $binB = str_pad($binB, $maxLen, '0', STR_PAD_LEFT);
        
        $result = '';
        for ($i = 0; $i < $maxLen; $i++) {
            $result .= ($binA[$i] !== $binB[$i]) ? '1' : '0';
        }
        
        return $this->binToDec($result);
    }

    private function bigLeftShift($a, $bits) {
        return $this->bigMul($a, $this->bigPow('2', (string)$bits));
    }

    private function bigRightShift($a, $bits) {
        return $this->bigDiv($a, $this->bigPow('2', (string)$bits));
    }

    private function decToBin($dec) {
        if ($dec === '0') return '0';
        
        $binary = '';
        while ($this->bigCompare($dec, '0') > 0) {
            $binary = $this->bigMod($dec, '2') . $binary;
            $dec = $this->bigDiv($dec, '2');
        }
        return $binary ?: '0';
    }

    private function binToDec($bin) {
        $dec = '0';
        $power = '1';
        
        for ($i = strlen($bin) - 1; $i >= 0; $i--) {
            if ($bin[$i] === '1') {
                $dec = $this->bigAdd($dec, $power);
            }
            $power = $this->bigMul($power, '2');
        }
        
        return $dec;
    }

    // Converts a number to a string using the custom base alphabet
    private function toBase($num, $minLength = 0) {
        if ($num === '0') {
            return str_repeat($this->BASE_ALPHABET[0], max($minLength, 1));
        }

        $result = "";
        $n = $num;

        while ($this->bigCompare($n, '0') > 0) {
            $rem = $this->bigMod($n, (string)$this->baseRadix);
            $n = $this->bigDiv($n, (string)$this->baseRadix);
            $result = $this->BASE_ALPHABET[(int)$rem] . $result;
        }

        // Pad the result to match the minimum required length
        while (strlen($result) < $minLength) {
            $result = $this->BASE_ALPHABET[0] . $result;
        }

        return $result;
    }

    // Converts a base-encoded string back into a number
    private function fromBase($str) {
        $result = '0';
        for ($i = 0; $i < strlen($str); $i++) {
            $char = $str[$i];
            if (!isset($this->BASE_MAP[$char])) {
                throw new InvalidArgumentException("Invalid character in encoded string: {$char}");
            }
            $value = (string)$this->BASE_MAP[$char];
            $result = $this->bigAdd($this->bigMul($result, (string)$this->baseRadix), $value);
        }
        return $result;
    }

    // Generates a random number of the specified bit length
    private function generateRandomBits($bits) {
        // Generate enough random bytes to cover all bits
        $bytesNeeded = ceil($bits / 8);
        $randomBytes = random_bytes($bytesNeeded);
        
        $value = '0';
        
        // Process each byte
        for ($i = 0; $i < $bytesNeeded; $i++) {
            $byte = ord($randomBytes[$i]);
            $value = $this->bigAdd($this->bigMul($value, '256'), (string)$byte);
        }

        // If we don't need all bits from the last byte, mask them out
        if ($bits % 8 !== 0) {
            $extraBits = $bits % 8;
            $mask = $this->bigSub($this->bigPow('2', (string)$extraBits), '1');
            $shift = 8 - $extraBits;
            $value = $this->bigRightShift($value, $shift);
        }
        
        // Final mask to ensure exact bit length
        $mask = $this->bigSub($this->bigPow('2', (string)$bits), '1');
        return $this->bigAnd($value, $mask);
    }

    // Get current timestamp in milliseconds with microsecond precision
    private function getCurrentTimestamp() {
        $microtime = microtime(true);
        return (string)round($microtime * 1000);
    }

    public function generate() {
        $headerBits = 6;
        $header = (string)$this->timestampBits;

        // Use current time (in ms), masked to the allowed timestamp bit length
        $timestampMask = $this->bigSub($this->bigPow('2', (string)$this->timestampBits), '1');
        $timestamp = $this->timestampBits > 0 
            ? $this->bigAnd($this->getCurrentTimestamp(), $timestampMask)
            : '0';

        $randBits = $this->generateRandomBits($this->randomBits);

        // Use the last 6 bits of the random value to obfuscate the header
        $headerXorMask = $this->bigAnd($randBits, $this->bigSub($this->bigPow('2', (string)$headerBits), '1'));
        $finalHeader = $this->bigXor($header, $headerXorMask);

        $finalTimestamp = $timestamp;
        if ($this->timestampBits > 0) {
            // Use the highest bits of the random value to obfuscate the timestamp
            $timestampXorMask = $this->bigRightShift($randBits, $this->randomBits - $this->timestampBits);
            $finalTimestamp = $this->bigXor($timestamp, $timestampXorMask);
        }

        // Combine all parts into a single number:
        // 1 (flag) + 6-bit header + timestamp + random
        $finalValue = '1'; // leading flag bit

        $finalValue = $this->bigAdd($this->bigLeftShift($finalValue, $headerBits), $finalHeader);

        if ($this->timestampBits > 0) {
            $finalValue = $this->bigAdd($this->bigLeftShift($finalValue, $this->timestampBits), $finalTimestamp);
        }

        $finalValue = $this->bigAdd($this->bigLeftShift($finalValue, $this->randomBits), $randBits);

        // Estimate how many characters are needed to represent the value
        $totalBits = 1 + $headerBits + $this->timestampBits + $this->randomBits;
        $bitsPerChar = log($this->baseRadix, 2);
        $minLength = ceil($totalBits / $bitsPerChar);

        return $this->toBase($finalValue, $minLength);
    }

    public function decode($id) {
        $full = $this->fromBase($id);
        
        // Convert to binary string to get the actual bit length
        $binaryStr = $this->decToBin($full);
        
        // Find the leading 1 bit position
        $fullLength = strlen($binaryStr) - 1; // Remove the leading flag bit
        $binary = substr($binaryStr, 1); // Remove leading 1-bit flag
        
        $flagBit = $this->bigPow('2', (string)$fullLength);
        $value = $this->bigSub($full, $flagBit); // Clear the leading flag

        $headerBits = 6;
        $headerMask = $this->bigSub($this->bigPow('2', (string)$headerBits), '1');

        $headerShift = $fullLength - $headerBits;
        $encodedHeader = $this->bigAnd($this->bigRightShift($value, $headerShift), $headerMask);

        // Extract the original XOR mask used to obfuscate the header
        $headerXorMask = $this->bigAnd($value, $headerMask);

        // Reconstruct the actual timestamp bit length
        $actualTimestampBits = (int)$this->bigXor($encodedHeader, $headerXorMask);

        $randomBitsLength = $fullLength - $headerBits - $actualTimestampBits;
        $randomMask = $this->bigSub($this->bigPow('2', (string)$randomBitsLength), '1');
        $encodedRandom = $this->bigAnd($value, $randomMask);

        $result = [
            'timestampLength' => $actualTimestampBits,
            'timestamp' => 0,
            'randomLength' => $randomBitsLength,
            'random' => $this->decToHex($encodedRandom), // Use custom hex conversion
            'formattedTimestamp' => null,
            'binary' => $binary
        ];

        if ($actualTimestampBits > 0) {
            $timestampShift = $randomBitsLength;
            $timestampMask = $this->bigSub($this->bigPow('2', (string)$actualTimestampBits), '1');
            $encodedTimestamp = $this->bigAnd($this->bigRightShift($value, $timestampShift), $timestampMask);

            // Recover the timestamp by reversing the XOR mask
            $timestampXorMask = $this->bigRightShift($encodedRandom, $randomBitsLength - $actualTimestampBits);
            $actualTimestamp = $this->bigXor($encodedTimestamp, $timestampXorMask);

            $result['timestamp'] = (int)$actualTimestamp;
            
            // Format timestamp with milliseconds
            $timestampSec = floor((int)$actualTimestamp / 1000);
            $timestampMs = (int)$actualTimestamp % 1000;
            $datetime = new DateTime('@' . $timestampSec);
            $datetime->setTimezone(new DateTimeZone('UTC'));
            
            // Add milliseconds to the formatted date
            $formattedDate = $datetime->format('Y-m-d H:i:s') . '.' . str_pad($timestampMs, 3, '0', STR_PAD_LEFT);
            $result['formattedTimestamp'] = $formattedDate;
        }

        return $result;
    }
}

?>