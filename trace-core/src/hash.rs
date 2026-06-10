//! SHA-256 hashing for Trace evidence records
//!
//! Provides consistent hashing matching the TypeScript implementation:
//! - Input: canonical JSON string
//! - Output: `sha256:<hex>` format

use crate::canonical_json::{sort_for_canonical_json, to_canonical_json, value_to_canonical_json};
use crate::types::TraceCoreError;
use ring::digest::{digest, SHA256};
use serde_json::Value;

const SHA256_PREFIX: &str = "sha256:";

/// Compute SHA-256 hash of a string input.
pub fn sha256_str(input: &str) -> String {
    let hash = digest(&SHA256, input.as_bytes());
    format!("{}{}", SHA256_PREFIX, hex::encode(hash.as_ref()))
}

/// Compute SHA-256 hash of a JSON value (canonicalized first).
pub fn sha256_value(value: &Value) -> String {
    let canonical = value_to_canonical_json(value);
    sha256_str(&canonical)
}

/// Compute SHA-256 hash of any serde-serializable value.
pub fn sha256_serializable<T: serde::Serialize>(value: &T) -> Result<String, TraceCoreError> {
    let canonical = to_canonical_json(value)?;
    Ok(sha256_str(&canonical))
}

/// Hash function matching TypeScript signature: `sha256(value: unknown): string`
/// Accepts either a string (used directly) or any JSON-serializable value.
pub fn sha256_any(value: &Value) -> String {
    match value {
        Value::String(s) => sha256_str(s),
        _ => sha256_value(value),
    }
}

/// Hash an evidence record, excluding the record_hash and signature_stub fields.
/// Matches the TypeScript `hashEvidenceRecord` function.
pub fn hash_evidence_record(record: &Value) -> Result<String, TraceCoreError> {
    // Clone and remove the fields that shouldn't be hashed
    let mut record_clone = record.clone();
    if let Value::Object(ref mut map) = record_clone {
        if let Some(Value::Object(ref mut custody)) = map.get_mut("chain_of_custody") {
            custody.remove("record_hash");
            custody.remove("signature_stub");
        }
    }
    let canonical = value_to_canonical_json(&record_clone);
    Ok(sha256_str(&canonical))
}

/// Generate a signature stub for a record hash.
/// Matches TypeScript: `signature_stub:v0:<recordHash>`
pub fn sign_record_stub(record_hash: &str) -> String {
    format!("signature_stub:v0:{}", record_hash)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_sha256_string() {
        let hash = sha256_str("hello world");
        assert!(hash.starts_with("sha256:"));
        assert_eq!(hash.len(), 7 + 64); // "sha256:" + 64 hex chars
    }

    #[test]
    fn test_sha256_deterministic() {
        let hash1 = sha256_str("test input");
        let hash2 = sha256_str("test input");
        assert_eq!(hash1, hash2);
    }

    #[test]
    fn test_sha256_value_canonical() {
        let v1 = json!({"z": 1, "a": 2});
        let v2 = json!({"a": 2, "z": 1});
        assert_eq!(sha256_value(&v1), sha256_value(&v2));
    }

    #[test]
    fn test_sha256_string_passthrough() {
        let v = Value::String("direct string".to_string());
        let hash = sha256_any(&v);
        assert_eq!(hash, sha256_str("direct string"));
    }

    #[test]
    fn test_hash_evidence_record_excludes_fields() {
        let record = json!({
            "record_id": "ev_123",
            "chain_of_custody": {
                "record_hash": "sha256:oldhash",
                "signature_stub": "signature_stub:v0:oldhash",
                "processing_node_id": "node-1"
            }
        });

        let hash = hash_evidence_record(&record).unwrap();
        // Should not contain the old hash values
        assert!(!hash.contains("oldhash"));
    }

    #[test]
    fn test_sign_record_stub() {
        let stub = sign_record_stub("sha256:abcd1234");
        assert_eq!(stub, "signature_stub:v0:sha256:abcd1234");
    }
}