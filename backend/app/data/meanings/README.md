# Local Meaning Dictionaries

These JSON files power the Possible Meaning panel in the translator UI.

- `en.json` is used for English input.
- `zh.json` is used for Chinese input.
- `ja.json` is used for Japanese input.

Each entry uses this shape:

```json
"word": {
  "chosen_meaning": "most likely or default meaning shown first",
  "other_meanings": [
    "another possible meaning",
    "another possible meaning"
  ]
}
```

## Matching Rules

English uses whole-word matching, so `bank` matches `the bank` but not `banking`.

Chinese and Japanese use substring matching because words are not always separated by spaces. The backend checks longer entries first, so a longer word such as `銀行` can be shown without also counting the shorter `行` inside it.

## Adding Entries

1. Open the language file.
2. Add a new top-level key.
3. Keep valid JSON commas between entries.
4. Restart the backend if it is already running.

Example:

```json
"case": {
  "chosen_meaning": "situation or example",
  "other_meanings": [
    "container",
    "legal matter",
    "grammar form"
  ]
}
```

Keep entries short and presentation-friendly. This dataset is manually written for the project, not imported from an external dictionary.
