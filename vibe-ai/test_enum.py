import sys
from enum import Enum
class LanguageType(str, Enum):
    ENGLISH = "en"

print("Language type is", type(LanguageType.ENGLISH))
print("Lower:", LanguageType.ENGLISH.lower())

try:
    import whisper
    print(whisper.tokenizer.LANGUAGES.get(LanguageType.ENGLISH))
    # just testing whisper.transcribe string check
    lang = LanguageType.ENGLISH.lower()
    if lang not in whisper.tokenizer.LANGUAGES:
        print("Not in languages")
    else:
        print("In languages")
except ImportError:
    pass
