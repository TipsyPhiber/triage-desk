use regex_lite::Regex;
use serde::Serialize;
use std::collections::BTreeSet;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
struct Ioc {
    kind: String,
    value: String,
}

fn defang(input: &str) -> String {
    let mut s = input.to_string();
    let pairs: &[(&str, &str)] = &[
        ("hxxps://", "https://"),
        ("hXXps://", "https://"),
        ("hxxp://", "http://"),
        ("hXXp://", "http://"),
        ("[://]", "://"),
        ("[.]", "."),
        ("(.)", "."),
        ("{.}", "."),
        ("[dot]", "."),
        ("(dot)", "."),
        ("{dot}", "."),
        ("[at]", "@"),
        ("(at)", "@"),
        ("{at}", "@"),
    ];
    for (from, to) in pairs {
        s = s.replace(from, to);
    }
    s
}

fn valid_ipv4(s: &str) -> bool {
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    parts
        .iter()
        .all(|o| o.parse::<u32>().map(|n| n <= 255).unwrap_or(false))
}

#[wasm_bindgen]
pub fn extract_iocs(text: &str) -> Result<JsValue, JsValue> {
    let cleaned = defang(text);
    let mut found: BTreeSet<(String, String)> = BTreeSet::new();

    let sha256 = Regex::new(r"\b[a-fA-F0-9]{64}\b").unwrap();
    for m in sha256.find_iter(&cleaned) {
        found.insert(("SHA256".into(), m.as_str().to_lowercase()));
    }

    let sha1 = Regex::new(r"\b[a-fA-F0-9]{40}\b").unwrap();
    for m in sha1.find_iter(&cleaned) {
        found.insert(("SHA1".into(), m.as_str().to_lowercase()));
    }

    let md5 = Regex::new(r"\b[a-fA-F0-9]{32}\b").unwrap();
    for m in md5.find_iter(&cleaned) {
        found.insert(("MD5".into(), m.as_str().to_lowercase()));
    }

    let url = Regex::new(r#"\bhttps?://[^\s)<>"']+"#).unwrap();
    for m in url.find_iter(&cleaned) {
        let trimmed = m
            .as_str()
            .trim_end_matches(|c: char| ".,;:!?]".contains(c))
            .to_string();
        found.insert(("URL".into(), trimmed));
    }

    let email = Regex::new(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,24}\b").unwrap();
    for m in email.find_iter(&cleaned) {
        found.insert(("Email".into(), m.as_str().to_lowercase()));
    }

    let ipv4 = Regex::new(r"\b(?:\d{1,3}\.){3}\d{1,3}\b").unwrap();
    for m in ipv4.find_iter(&cleaned) {
        if valid_ipv4(m.as_str()) {
            found.insert(("IPv4".into(), m.as_str().to_string()));
        }
    }

    let cve = Regex::new(r"(?i)\bCVE-\d{4}-\d{4,7}\b").unwrap();
    for m in cve.find_iter(&cleaned) {
        found.insert(("CVE".into(), m.as_str().to_uppercase()));
    }

    let domain =
        Regex::new(r"\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,24}\b")
            .unwrap();

    let known_emails: Vec<String> = found
        .iter()
        .filter(|(k, _)| k == "Email")
        .map(|(_, v)| v.clone())
        .collect();
    let known_urls: Vec<String> = found
        .iter()
        .filter(|(k, _)| k == "URL")
        .map(|(_, v)| v.clone())
        .collect();

    for m in domain.find_iter(&cleaned) {
        let d = m.as_str().to_lowercase();
        if valid_ipv4(&d) {
            continue;
        }
        let in_email = known_emails
            .iter()
            .any(|e| e.ends_with(&format!("@{}", d)) || e.contains(&format!("@{}", d)));
        let in_url = known_urls.iter().any(|u| u.to_lowercase().contains(&d));
        if !in_email && !in_url {
            found.insert(("Domain".into(), d));
        }
    }

    serde_wasm_bindgen::to_value(&found.into_iter().map(|(k, v)| Ioc { kind: k, value: v }).collect::<Vec<_>>())
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
