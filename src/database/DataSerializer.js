/**
 * Vorn Database — Data Serializer
 * Handles serialization/deserialization with multipart support for large data
 */

const MESSAGE_CHAR_LIMIT = 1900;

class DataSerializer {
    /**
     * Serialize a key-value pair into message-ready chunks
     * Handles splitting large data into multiple parts
     * @param {string} key 
     * @param {any} value 
     * @returns {string[]} Array of message content strings
     */
    static serializeRecord(key, value) {
        const timestamp = Date.now();
        // Try single record first
        const singleRecord = { k: key, v: value, t: timestamp };
        const singleStr = JSON.stringify(singleRecord);

        if (singleStr.length <= MESSAGE_CHAR_LIMIT) {
            return [singleStr];
        }

        // If too big, use multipart strategy
        // We serialize the value specifically to split it safely
        const serializedValue = JSON.stringify(value);
        const chunks = [];
        
        // Calculate safe payload size (approximate)
        // {"k":"key","i":99,"n":99,"d":"..."} ~ 50 chars overhead
        const chunkSize = MESSAGE_CHAR_LIMIT - 100;
        const totalParts = Math.ceil(serializedValue.length / chunkSize);

        for (let i = 0; i < totalParts; i++) {
            const start = i * chunkSize;
            const end = start + chunkSize;
            const part = serializedValue.substring(start, end);

            const recordPart = {
                k: key,
                i: i,          // index
                n: totalParts, // total parts
                d: part,       // data chunk
                t: timestamp   // timestamp (same for all)
            };
            chunks.push(JSON.stringify(recordPart));
        }

        return chunks;
    }

    /**
     * Parse a raw message content
     * @param {string} content 
     * @returns {Object|null} partial or full record
     */
    static parseRaw(content) {
        try {
            return JSON.parse(content);
        } catch {
            return null;
        }
    }

    /**
     * Reassemble parts into a full record
     * @param {Array} parts - Array of objects {k, i, n, d, t} or {k, v, t}
     * @returns {Object|null} { key, value, timestamp }
     */
    static reassemble(parts) {
        if (!parts || parts.length === 0) return null;

        // Check if single record
        if (parts.length === 1 && parts[0].v !== undefined) {
            return {
                key: parts[0].k,
                value: parts[0].v,
                timestamp: parts[0].t
            };
        }

        // Sort by index
        parts.sort((a, b) => (a.i || 0) - (b.i || 0));

        // Validation
        const first = parts[0];
        if (!first || first.n === undefined) return null; // Not a multipart record

        // Verify we have all parts
        if (parts.length !== first.n) {
            // Incomplete data
            return null;
        }

        // Join data chunks
        const fullJson = parts.map(p => p.d).join('');
        
        try {
            const value = JSON.parse(fullJson);
            return {
                key: first.k,
                value: value,
                timestamp: first.t
            };
        } catch (e) {
            console.error(`[DataSerializer] Failed to reassemble ${first.k}: ${e.message}`);
            return null;
        }
    }
}

module.exports = DataSerializer;
