# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

The plugin now exclusively uses the ContentScript implementation and no longer includes the Editor API or format migration compatibility layer.

### Removed

- Editor API implementation.
- Format migration compatibility layer for the legacy JSON format.

## [2.2.6] - 2026-03-11

This is a **format migration** release. The previous **JSON-based** format has been replaced with a **CodeFence-based** format in favour of performance enhancements planned for **Joplin 3.6** and to address bugs caused by note tags in the **JSON** format. This update will force users to migrate to the new format.

The update also resolves usability issues, including automatic focus on the password input field and the addition of password confirmation during encryption. Due to current editor limitations, the plugin is now restricted to the **Markdown viewer layout**, and **Rich Text Editor (RTE)** support is currently unavailable, possibly until **Joplin 3.6**.

As this is a migration release, most issues present in **v1.2.4** have been resolved. However, for compatibility reasons the previous implementation is still retained alongside the new format until **Joplin 3.6** is released.

### Added

- Password confirmation during encryption.
- Empty password validation.
- Automatic focus on the password input field.

### Changed

- Migrated encrypted note storage from the JSON format to a CodeFence-based format.
- Switched from the Editor API to a ContentScript implementation.
- Plugin now requires the Markdown Viewer layout; Rich Text Editor (RTE) is not currently supported.
- Previous JSON implementation retained for backward compatibility until Joplin 3.6.

### Fixed

- Replaced tag-based JSON detection, which could fail in some cases (#18).
- Password dialog now automatically focuses the password field (#16).
- Password dialog now includes password confirmation (#15).

## [1.2.4] - 2025-10-21

Initial release of **Secure Notes**, a plugin to password protect and encrypt Joplin notes. Uses industry-standard AES encryption with multiple modes (**GCM, CTR, CBC**) and key sizes (**128, 256**).

### Added

- AES encryption with GCM, CTR, and CBC modes.
- Support for 128-bit and 256-bit keys.
- Commands to encrypt and decrypt notes from the toolbar and menu.
- Secure View mode for viewing decrypted notes in memory without modifying the original note.
