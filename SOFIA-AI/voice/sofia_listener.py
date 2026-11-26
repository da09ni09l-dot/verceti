import json
import queue
import sys
from pathlib import Path

import sounddevice as sd
from vosk import KaldiRecognizer, Model, SetLogLevel

SAMPLE_RATE = 16000
BLOCK_SIZE = 8000


def emit(event):
    print(json.dumps(event, ensure_ascii=False), flush=True)


def model_directory():
    root = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return root / "model"


def main():
    SetLogLevel(-1)
    model_path = model_directory()
    if not model_path.is_dir():
        emit({"type": "error", "message": "Не знайдено локальну українську модель розпізнавання."})
        return 2

    audio_queue = queue.Queue()

    def on_audio(indata, frames, time_info, status):
        if status:
            print(str(status), file=sys.stderr, flush=True)
        audio_queue.put(bytes(indata))

    try:
        model = Model(str(model_path))
        recognizer = KaldiRecognizer(model, SAMPLE_RATE)
        recognizer.SetWords(False)
        emit({"type": "status", "message": "Локальне розпізнавання активне. Мікрофон слухає слово «Софія»."})
        with sd.RawInputStream(
            samplerate=SAMPLE_RATE,
            blocksize=BLOCK_SIZE,
            dtype="int16",
            channels=1,
            callback=on_audio,
        ):
            while True:
                audio = audio_queue.get()
                if recognizer.AcceptWaveform(audio):
                    result = json.loads(recognizer.Result())
                    phrase = (result.get("text") or "").strip()
                    if phrase:
                        emit({"type": "transcript", "text": phrase})
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        emit({"type": "error", "message": "Не вдалося запустити локальний мікрофон: " + str(error)})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
