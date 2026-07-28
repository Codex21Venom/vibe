import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

def test_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("GEMINI_API_KEY is missing from environment!")
        return
        
    try:
        model = ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL", "gemini-3.6-flash"),
            google_api_key=api_key,
            temperature=0
        )
        response = model.invoke("Say hello world in 3 words.")
        print("Gemini Response:", response.content)
    except Exception as e:
        print("Error connecting to Gemini:", e)

if __name__ == "__main__":
    test_gemini()
