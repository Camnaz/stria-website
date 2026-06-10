use std::env;
use std::path::PathBuf;

fn main() {
    // Tell cargo to look for shared libraries in the specified directory
    if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
        let target_dir = PathBuf::from(&manifest_dir).join("target").join("release");
        if target_dir.exists() {
            println!("cargo:rustc-link-search=native={}", target_dir.display());
        }
    }

    // Platform-specific build config
    if cfg!(target_os = "macos") {
        println!("cargo:rustc-link-arg=-undefined");
        println!("cargo:rustc-link-arg=dynamic_lookup");
    }
}