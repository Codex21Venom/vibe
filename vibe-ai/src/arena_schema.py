from typing import List
from pydantic import BaseModel

ARENA_QUESTION_SCHEMA = {
    ""type"": ""object"",
    ""properties"": {
        ""question"": {""type"": ""string""},
        ""correct_cards"": {
            ""type"": ""array"",
            ""items"": {
                ""type"": ""object"",
                ""properties"": {
                    ""concept"": {""type"": ""string""},
                    ""explanation"": {""type"": ""string""}
                },
                ""required"": [""concept"", ""explanation""]
            },
            ""minItems"": 1,
            ""maxItems"": 2
        },
        ""distractor_cards"": {
            ""type"": ""array"",
            ""items"": {
                ""type"": ""object"",
                ""properties"": {
                    ""concept"": {""type"": ""string""},
                    ""explanation"": {""type"": ""string""}
                },
                ""required"": [""concept"", ""explanation""]
            },
            ""minItems"": 3,
            ""maxItems"": 4
        }
    },
    ""required"": [""question"", ""correct_cards"", ""distractor_cards""]
}
