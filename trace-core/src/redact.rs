//! Argument redaction for sensitive fields
//!
//! Redacts sensitive keys and values from tool arguments before storing in evidence records.

use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};

/// Keys that should always be redacted
static SENSITIVE_KEYS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    [
        "account_number",
        "routing_number",
        "ssn",
        "tax_id",
        "token",
        "api_key",
        "authorization",
        "password",
        "secret",
        "private_key",
        "access_token",
        "refresh_token",
        "client_secret",
    ]
    .into_iter()
    .collect()
});

/// Redact sensitive fields from a JSON object (accepts HashMap)
pub fn redacted_preview_hashmap(args: &HashMap<String, Value>) -> Value {
    let map: Map<String, Value> = args
        .iter()
        .map(|(key, value)| {
            let redacted = if SENSITIVE_KEYS.contains(key.to_lowercase().as_str()) {
                Value::String("[REDACTED]".to_string())
            } else if let Value::String(s) = value {
                if looks_sensitive(s) {
                    Value::String("[REDACTED]".to_string())
                } else {
                    value.clone()
                }
            } else if let Value::Object(obj) = value {
                Value::Object(redacted_preview(obj))
            } else {
                value.clone()
            };
            (key.clone(), redacted)
        })
        .collect();
    Value::Object(map)
}

/// Redact sensitive fields from a JSON object (accepts serde_json::Map)
pub fn redacted_preview(args: &Map<String, Value>) -> Map<String, Value> {
    args.iter()
        .map(|(key, value)| {
            let redacted = if SENSITIVE_KEYS.contains(key.to_lowercase().as_str()) {
                Value::String("[REDACTED]".to_string())
            } else if let Value::String(s) = value {
                if looks_sensitive(s) {
                    Value::String("[REDACTED]".to_string())
                } else {
                    value.clone()
                }
            } else if let Value::Object(obj) = value {
                Value::Object(redacted_preview(obj))
            } else {
                value.clone()
            };
            (key.clone(), redacted)
        })
        .collect()
}

/// Check if a string value looks sensitive (bearer tokens, API keys, etc.)
fn looks_sensitive(value: &str) -> bool {
    BEARER_TOKEN_REGEX.is_match(value) || API_KEY_REGEX.is_match(value)
}

// Pre-compiled regexes for sensitive value detection
static BEARER_TOKEN_REGEX: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)bearer\s+[a-z0-9._-]+").unwrap());
static API_KEY_REGEX: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)sk-[a-z0-9_-]{12,}").unwrap());

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_redact_sensitive_key() {
        let mut args = HashMap::new();
        args.insert("account_number".to_string(), json!("123456789"));
        args.insert("name".to_string(), json!("John"));

        let redacted = redacted_preview_hashmap(&args);
        assert_eq!(redacted.get("account_number"), Some(&json!("[REDACTED]")));
        assert_eq!(redacted.get("name"), Some(&json!("John")));
    }

    #[test]
    fn test_redact_nested_object() {
        let mut inner = HashMap::new();
        inner.insert("token".to_string(), json!("secret123"));

        let mut args = HashMap::new();
        args.insert(
            "config".to_string(),
            Value::Object(inner.into_iter().collect()),
        );

        let redacted = redacted_preview_hashmap(&args);
        let config = redacted.get("config").and_then(|v| v.as_object()).unwrap();
        assert_eq!(config.get("token"), Some(&json!("[REDACTED]")));
    }

    #[test]
    fn test_redact_bearer_token_in_string() {
        let mut args = HashMap::new();
        args.insert("header".to_string(), json!("Bearer abc123xyz"));

        let redacted = redacted_preview_hashmap(&args);
        assert_eq!(redacted.get("header"), Some(&json!("[REDACTED]")));
    }

    #[test]
    fn test_redact_sk_key_in_string() {
        let mut args = HashMap::new();
        args.insert("api_key".to_string(), json!("sk-abc...qrst"));

        let redacted = redacted_preview_hashmap(&args);
        assert_eq!(redacted.get("api_key"), Some(&json!("[REDACTED]")));
    }

    #[test]
    fn test_no_false_positive() {
        let mut args = HashMap::new();
        args.insert(
            "description".to_string(),
            json!("This is a normal description with no secrets"),
        );
        args.insert("count".to_string(), json!(42));

        let redacted = redacted_preview_hashmap(&args);
        assert_eq!(
            redacted.get("description"),
            Some(&json!("This is a normal description with no secrets"))
        );
        assert_eq!(redacted.get("count"), Some(&json!(42)));
    }
}
