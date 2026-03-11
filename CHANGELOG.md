# Changelog

All notable changes to this project will be documented in this file.

## v2.2.6 [2026-03-11]

This is a **format migration** release. The previous **JSON-based** format has been replaced with a **CodeFence-based** format in favour of performance enhancements planned for **Joplin 3.6** and to address bugs caused by note tags in the **JSON** format. This update will force users to migrate to the new format.

The update also resolves usability issues, including automatic focus on the password input field and the addition of password confirmation during encryption. Due to current editor limitations, the plugin is now restricted to the **Markdown viewer layout**, and **Rich Text Editor (RTE)** support is currently unavailable, possibly until **Joplin 3.6**.

As this is a migration release, most issues present in **v1.2.4** have been resolved. However, for compatibility reasons the previous implementation is still retained alongside the new format until **Joplin 3.6** is released.

### Added

- Password prompt now validates empty passwords and includes confirmation.

### Changed

- Note storage format migrated from **JSON** to **CodeFence**.
- Plugin now uses **ContentScript** instead of the **Editor API**, since the Editor API has limited triggering capabilities.

### Fixed

- JSON-based detection relied on tags, which failed in some cases; replaced by format migration (#18).
- Password prompt now automatically receives focus (#16).
- Password prompt now includes confirmation field (#15).

## v1.2.4 [2025-10-21]

Initial release of **Secure Notes**, a plugin to password protect and encrypt Joplin notes. Uses industry-standard AES encryption with multiple modes (**GCM, CTR, CBC**) and key sizes (**128, 256**).

### Added

- Commands to encrypt and decrypt notes from the toolbar and menu.
- Secure view mode to read encrypted notes using in-RAM decryption.
