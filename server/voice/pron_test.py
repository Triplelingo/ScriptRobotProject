import os
import azure.cognitiveservices.speech as speechsdk
from dotenv import load_dotenv

# 프로젝트 루트의 .env 파일 로드
# __file__ 기준으로 두 단계 위가 프로젝트 루트
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

# Azure Speech 서비스 설정
speech_config = speechsdk.SpeechConfig(
    subscription=os.getenv("AZURE_SPEECH_KEY"),
    region=os.getenv("AZURE_SPEECH_REGION")
)

# 기본 마이크 사용 설정
audio_config = speechsdk.AudioConfig(use_default_microphone=True)

# 기준 문장
reference_text = " He was like, “You are so rude” And I was like, “Boy, does it look like I could care? I couldn't even care less!" 

# 발음 평가 설정 (100점 만점, 음소 단위)
pron_config = speechsdk.PronunciationAssessmentConfig(
    reference_text=reference_text,
    grading_system=speechsdk.PronunciationAssessmentGradingSystem.HundredMark,
    granularity=speechsdk.PronunciationAssessmentGranularity.Phoneme
)

# 음성 인식기 생성
recognizer = speechsdk.SpeechRecognizer(
    speech_config=speech_config,
    audio_config=audio_config
)

# 발음 평가 설정 적용
pron_config.apply_to(recognizer)

print("🎤 Please say:", reference_text)

# 음성 인식 실행
result = recognizer.recognize_once()

if result.reason == speechsdk.ResultReason.RecognizedSpeech:
    print("📝 You said:", result.text)

    pron_result = speechsdk.PronunciationAssessmentResult(result)
    print(f"🎯 Accuracy:      {pron_result.accuracy_score}")
    print(f"🎯 Fluency:       {pron_result.fluency_score}")
    print(f"🎯 Completeness:  {pron_result.completeness_score}")
    print(f"🎯 Pronunciation: {pron_result.pronunciation_score}")

    # 음소 단위 상세 점수
    print("\n📊 단어별 상세:")
    for word in pron_result.words:
        print(f"  [{word.word}] 정확도: {word.accuracy_score}")
        for phoneme in word.phonemes:
            print(f"    음소: {phoneme.phoneme} → {phoneme.accuracy_score}")

elif result.reason == speechsdk.ResultReason.NoMatch:
    print("❌ 음성 인식 실패 — 다시 말해주세요")

elif result.reason == speechsdk.ResultReason.Canceled:
    details = speechsdk.CancellationDetails(result)
    print(f"❌ 취소됨: {details.reason}")
    print(f"   상세: {details.error_details}")