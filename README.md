# Secure Notes

Secure Notes is a Joplin plugin that lets you password-protect and encrypt your joplin notes locally. It ensures your sensitive information stays private — only you can unlock and read your data.

> [!IMPORTANT]
> The v3.x series removes the **Editor API** and **format migration** code. The plugin now solely relies on the Content Scripts implementation.
>
> **Breaking change:** Support for the JSON encryption format has been removed. If you have notes encrypted with the old JSON based format, migrate them to CodeFenced based format using **v2.2.6** before upgrading to v3.x.

## Features

- 🔒 **Password-Protected** - Encrypt sensitive notes with a password of your choice
- 👁️ **Secure View** - Preview encrypted notes without decrypting them permanently
- 📁 **Local Storage** - Encrypted notes are stored locally in Joplin's database
- 🛡️ **Strong Encryption** - Uses industry-standard AES encryption with Webcrypto API.
- 🔄 **Multiple Modes** - Supports AES-CBC, AES-CTR, and AES-GCM modes with 128-bit or 256-bit key sizes.

## **Disclaimer**

**NO RECOVERY** – If you forget your password, your encrypted notes are permanently lost. There’s no way to recover or reset it. Please keep backups of anything important.

**NO WARRANTIES** – This plugin is provided "as is" without any guarantees. While it uses industry-standard AES encryption, no system is 100% secure. The author is not liable for data loss or security issues.

**_Use at your own risk. By using this plugin, you accept these terms._**

## Installation

### **From Market-Place (Recommended)**

- Open Joplin and navigate to **Tools → Options → Plugins → Search**
- Search for **Secure Notes**
- Click **Install** and restart Joplin

### **From Source-Build**

- Build the plugin package file (.jpl):

  ```bash
  git clone https://github.com/cipherswami/joplin-plugin-secure-notes.git
  cd joplin-plugin-secure-notes
  npm install
  npm run dist
  ```

- Then in Joplin, Go to **Tools → Options → Plugins → Install from file**
- Select the generated `.jpl` file from the `publish/` directory

## Usage

### Encrypt Note

1. Select the note you want to encrypt.
2. Click the key icon in the toolbar, or go to `Tools > Secure Notes > Encrypt Note`.
3. Enter a password when prompted.
4. The note will be encrypted.

### View Note

1. Select an encrypted note.
2. The plugin will automatically prompt for a password.
3. Enter your password to view the note in read-only mode.
4. The note is decrypted in RAM and displayed temporarily in SecureView.

### Decrypt Note

1. Select an encrypted note.
2. Click the key icon in the toolbar, or go to `Tools > Secure Notes > Decrypt Note`.
3. Enter the correct password.
4. The note will be permanently decrypted.

## Settings

Access plugin settings via `Tools > Options > Secure Notes`

#### AES Key Size

- **128-bit** - Faster, suitable for most use cases
- **256-bit** - Maximum security (Recommended)

#### AES Cipher Mode

- **CBC** - Cipher Block Chaining mode
- **CTR** - Counter mode
- **GCM** - Galois/Counter Mode (Recommended)

> [!NOTE]
> Changing encryption settings only affects newly encrypted notes. Previously encrypted notes will use the settings that were active when they were encrypted.

## FAQ

**Q: What happens if I uninstall the plugin?**  
A: Encrypted notes will remain encrypted. Reinstall the plugin to decrypt them.

**Q: Are encrypted notes searchable?**  
A: No, encrypted content cannot be searched until the note is decrypted.

**Q: Are resources in my notes encrypted?**  
A: This plugin only encrypts your note contents. Resources like images, attachments are **not** encrypted because they’re just hyperlinks not the actual files themselves.

**Q: Can I encrypt all my notes or notebook at once?**  
A: Currently, the plugin encrypts notes individually. Batch encryption may be added in future versions.

## Change Log

See the full project history in [CHANGELOG](./CHANGELOG.md).

## Support

- **Questions & Discussions**: Join the conversation on the [Joplin Forum](https://discourse.joplinapp.org/t/secure-notes/47501)
- **Bug Reports**: Report issues on [GitHub Issues](https://github.com/cipherswami/joplin-plugin-secure-notes/issues).

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for more details.

Contributions are welcome! Visit the [GitHub repository](https://github.com/cipherswami/joplin-plugin-secure-notes) to submit pull requests or suggest new features.
