import sys
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.translator import detect_language, get_ambiguous_terms


class MeaningDictionaryTests(unittest.TestCase):
    def test_english_whole_word_matches_multiple_terms(self):
        terms = get_ambiguous_terms(
            "Please file the bank note before the meeting.",
            "english",
        )

        self.assertEqual(
            [term.term for term in terms],
            ["bank", "file", "meeting", "note"],
        )

    def test_english_does_not_match_inside_longer_word(self):
        terms = get_ambiguous_terms("The banking app is open.", "english")

        self.assertNotIn("bank", [term.term for term in terms])

    def test_chinese_prefers_longer_dictionary_terms(self):
        terms = get_ambiguous_terms("我会去银行看看。", "chinese")
        term_names = [term.term for term in terms]

        self.assertIn("银行", term_names)
        self.assertNotIn("行", term_names)

    def test_japanese_matches_kanji_term(self):
        terms = get_ambiguous_terms("君の心", "japanese")

        self.assertEqual([term.term for term in terms], ["心"])

    def test_detect_language_uses_japanese_script_markers(self):
        self.assertEqual(detect_language("佐々木", "auto"), "japanese")


if __name__ == "__main__":
    unittest.main()
