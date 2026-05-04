const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

let supportedLanguages: string[] = [];

export interface AppLocalization {
  settingsSectionLabel: string;
  aesKeySizeLabel: string;
  aesCipherModeLabel: string;
  recommendedOptionSuffix: string;
  encryptNoteCommand: string;
  decryptNoteCommand: string;
  toggleNoteLockCommand: string;
  passwordPlaceholder: string;
  confirmPasswordPlaceholder: string;
  okButton: string;
  cancelButton: string;
  closeButton: string;
  enterPasswordToEncrypt: string;
  enterPasswordToDecrypt: string;
  enterPasswordToViewNote: string;
  passwordCannotBeEmpty: string;
  passwordsDoNotMatch: string;
  invalidFormat: string;
  invalidOldFormat: string;
  incorrectPasswordTryAgain: string;
  decryptionFailed: string;
  noteIsAlreadyEncrypted: string;
  noteIsNotEncrypted: string;
  noteEncryptedSuccessfully: string;
  noteDecryptedSuccessfully: string;
  encryptedNoteInfo: string;
  secureViewEncryptedNoteInfo: string;
  secureViewUnlockButton: string;
  secureViewReadOnlyInfo: string;
  legacyFormatTitle: string;
  legacyFormatInfo: string;
}

const defaultStrings: AppLocalization = {
  settingsSectionLabel: "Secure Notes",
  aesKeySizeLabel: "AES Key Size",
  aesCipherModeLabel: "AES Cipher Mode",
  recommendedOptionSuffix: "Recommended",
  encryptNoteCommand: "Encrypt Note",
  decryptNoteCommand: "Decrypt Note",
  toggleNoteLockCommand: "Toggle Note Lock",
  passwordPlaceholder: "password",
  confirmPasswordPlaceholder: "confirm password",
  okButton: "Ok",
  cancelButton: "Cancel",
  closeButton: "Close",
  enterPasswordToEncrypt: "Enter password to Encrypt",
  enterPasswordToDecrypt: "Enter password to Decrypt",
  enterPasswordToViewNote: "Enter Password to View Note",
  passwordCannotBeEmpty: "Password cannot be empty",
  passwordsDoNotMatch: "Passwords do not match",
  invalidFormat: "Invalid format",
  invalidOldFormat: "Invalid old format",
  incorrectPasswordTryAgain: "Incorrect password, try again",
  decryptionFailed: "Decryption failed",
  noteIsAlreadyEncrypted: "Note is already encrypted",
  noteIsNotEncrypted: "Note is not encrypted",
  noteEncryptedSuccessfully: "Note encrypted successfully",
  noteDecryptedSuccessfully: "Note decrypted successfully",
  encryptedNoteInfo:
    "This is an encrypted note, use Secure Notes plugin and switch to Markdown editor's viewer layout.",
  secureViewEncryptedNoteInfo: "This is an encrypted note",
  secureViewUnlockButton: "Unlock",
  secureViewReadOnlyInfo:
    "🔒 This note is read-only. To edit it, decrypt the note, make changes, then re-encrypt.",
  legacyFormatTitle: "Legacy format",
  legacyFormatInfo:
    "This note was encrypted with an older version of Secure Notes.<br/>Decrypt it and re-encrypt to upgrade to the new format.",
};

const strings: AppLocalization = { ...defaultStrings };

const localizations: Record<string, Partial<AppLocalization>> = {
  ru: {
    settingsSectionLabel: "Secure Notes",
    aesKeySizeLabel: "Размер ключа AES",
    aesCipherModeLabel: "Режим шифрования AES",
    recommendedOptionSuffix: "рекомендуется",
    encryptNoteCommand: "Зашифровать заметку",
    decryptNoteCommand: "Расшифровать заметку",
    toggleNoteLockCommand: "Переключить защиту заметки",
    passwordPlaceholder: "пароль",
    confirmPasswordPlaceholder: "подтвердите пароль",
    okButton: "ОК",
    cancelButton: "Отмена",
    closeButton: "Закрыть",
    enterPasswordToEncrypt: "Введите пароль для шифрования",
    enterPasswordToDecrypt: "Введите пароль для расшифровки",
    enterPasswordToViewNote: "Введите пароль для просмотра заметки",
    passwordCannotBeEmpty: "Пароль не может быть пустым",
    passwordsDoNotMatch: "Пароли не совпадают",
    invalidFormat: "Некорректный формат",
    invalidOldFormat: "Некорректный старый формат",
    incorrectPasswordTryAgain: "Неверный пароль, попробуйте еще раз",
    decryptionFailed: "Не удалось расшифровать заметку",
    noteIsAlreadyEncrypted: "Заметка уже зашифрована",
    noteIsNotEncrypted: "Заметка не зашифрована",
    noteEncryptedSuccessfully: "Заметка успешно зашифрована",
    noteDecryptedSuccessfully: "Заметка успешно расшифрована",
    encryptedNoteInfo:
      "Это зашифрованная заметка. Используйте плагин Secure Notes и переключитесь в режим просмотра Markdown-редактора.",
    secureViewEncryptedNoteInfo: "Это зашифрованная заметка",
    secureViewUnlockButton: "Открыть",
    secureViewReadOnlyInfo:
      "🔒 Эта заметка доступна только для чтения. Чтобы изменить ее, расшифруйте заметку, внесите изменения и зашифруйте снова.",
    legacyFormatTitle: "Старый формат",
    legacyFormatInfo:
      "Эта заметка была зашифрована старой версией Secure Notes.<br/>Расшифруйте ее и зашифруйте снова, чтобы перейти на новый формат.",
  },
};

const getNavigatorLanguages = (): readonly string[] => {
  if (typeof navigator === "undefined") {
    return [];
  }

  if (navigator.languages?.length > 0) {
    return navigator.languages;
  }

  return navigator.language ? [navigator.language] : [];
};

const normalizeLocale = (locale: string): string => locale.replace("_", "-");

const getLanguageCode = (locale: string): string | undefined => {
  const localeSeparatorIndex = locale.indexOf("-");

  return localeSeparatorIndex === -1
    ? undefined
    : locale.substring(0, localeSeparatorIndex);
};

const getSupportedLanguages = (locales: readonly string[]): string[] => {
  const languages: string[] = [];

  for (const locale of locales) {
    const normalizedLocale = normalizeLocale(locale);
    languages.push(normalizedLocale);

    const languageCode = getLanguageCode(normalizedLocale);

    if (languageCode) {
      languages.push(languageCode);
    }
  }

  return languages;
};

const findLocalization = (
  languages: readonly string[],
): Partial<AppLocalization> => {
  for (const language of languages) {
    const localization = localizations[language];

    if (localization) {
      return localization;
    }
  }

  return {};
};

const applyLocalization = (localization: Partial<AppLocalization>) => {
  Object.assign(strings, defaultStrings, localization);
};

export const setLocale = (supportedLocales: readonly string[] | string) => {
  const locales =
    typeof supportedLocales === "string" ? [supportedLocales] : supportedLocales;
  const languages = getSupportedLanguages(locales);

  supportedLanguages = languages;
  applyLocalization(findLocalization(languages));
};

setLocale(getNavigatorLanguages());

export const getLocales = () => {
  return [...supportedLanguages];
};

export const formatLocalizedString = (
  template: string,
  values: Record<string, string | number>,
): string => {
  return template.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
};

export default strings;
