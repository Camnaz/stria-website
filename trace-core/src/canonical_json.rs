//! Canonical JSON serialization for consistent hashing
//!
//! Implements deterministic JSON serialization with sorted keys,
//! matching the TypeScript implementation exactly.

use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

/// Sort a JSON value recursively for canonical representation.
/// Keys in objects are sorted alphabetically.
/// Arrays maintain their order but elements are recursively sorted.
pub fn sort_for_canonical_json(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut sorted = BTreeMap::new();
            for (k, v) in map {
                sorted.insert(k.clone(), sort_for_canonical_json(v));
            }
            Value::Object(sorted.into_iter().collect())
        }
        Value::Array(arr) => Value::Array(arr.iter().map(sort_for_canonical_json).collect()),
        _ => value.clone(),
    }
}

/// Serialize any serde-serializable value to canonical JSON string.
pub fn to_canonical_json<T: Serialize>(value: &T) -> Result<String, crate::types::TraceCoreError> {
    let json_value = serde_json::to_value(value)?;
    let sorted = sort_for_canonical_json(&json_value);
    Ok(sorted.to_string())
}

/// Serialize a raw JSON Value to canonical JSON string.
pub fn value_to_canonical_json(value: &Value) -> String {
    let sorted = sort_for_canonical_json(value);
    sorted.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_canonical_json_sorting() {
        let input = json!({
            "z": 1,
            "a": 2,
            "m": {
                "y": 3,
                "b": 4
            }
        });

        let canonical = value_to_canonical_json(&input);
        // Keys should be sorted: a, m, z
        // m should have b, y
        assert!(canonical.starts_with(r#"{"a":2,"m":{"b":4,"y":3}"#));
        assert!(canonical.ends_with(r#","z":1}"#));
    }

    #[test]
    fn test_canonical_json_array_preserves_order() {
        let input = json!([3, 1, 2]);
        let canonical = value_to_canonical_json(&input);
        assert_eq!(canonical, "[3,1,2]");
    }

    #[test]
    fn test_nested_sorting() {
        let input = json!({
            "outer": {
                "z": [{"b": 2, "a": 1}],
                "a": 1
            }
        });

        let canonical = value_to_canonical_json(&input);
        // outer should have a, then z
        // z array element should have sorted keys a, b
        assert!(canonical.contains(r#""a":1"#));
        assert!(canonical.contains(r#""z":[{"a":1,"b":2}]"#));
    }
}
