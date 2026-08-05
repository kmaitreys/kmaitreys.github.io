+++
date = '2026-08-05T16:25:21+05:30'
draft = false
title = 'Reading and Writing outputs from athena++'
+++

While working with `athena++`, I realised that reading the outputs was quite a slow process.
[`athers`](https://github.com/PlanetesLAB/athers) was born out of my desire to write a performant
reader (and perhaps writer?) for athena data. With performance in mind, I naturally decided to
write it in Rust.

Straightaway, we are hit with the realization of how non-trivial the parsing of an `athinput` file is.
Following was my solution:
```rust
pub enum AthinputValue {
    Int(i64),
    Float(f64),
    Complex(Complex64),
    Text(String),
}
```


