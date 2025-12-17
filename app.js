// 1️⃣ Importai viršuje
import React, { useState } from "react";
import axios from "axios";
import MicRecorder from "mic-recorder-to-mp3"; // mikrofono biblioteka

function App() {
  // 2️⃣ State kintamieji ir recorder objektas (pačioje pradžioje, viduje App)
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const recorder = new MicRecorder({ bitRate: 128 });

  const apiKey = process.env.REACT_APP_ELEVEN_API_KEY;

  // 3️⃣ Funkcija: ElevenLabs TTS (tekstas → balsas)
  const speak = async (text) => {
    try {
      const res = await axios.post(
        "https://api.elevenlabs.io/v1/text-to-speech/YOUR_VOICE_ID",
        { text, model_id: "eleven_monolingual_v1" },
        {
          headers: { "xi-api-key": apiKey },
          responseType: "arraybuffer"
        }
      );

      const audioBlob = new Blob([res.data], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      console.error("TTS klaida:", error);
    }
  };

  // 4️⃣ Funkcija: Siųsti tekstą į n8n webhook
  const sendMessage = async (textToSend = message) => {
    try {
      const res = await axios.post(
        "https://evaldys.app.n8n.cloud/webhook-test/b432e7fa-98e4-43f4-8d0c-eaf7d2b25789", // 👉 pakeisk į savo webhook URL
        { transcription: textToSend }
      );

      setResponse(res.data.response);
      speak(res.data.response);
    } catch (error) {
      console.error("Webhook klaida:", error);
      setResponse("Įvyko klaida jungiantis prie agento.");
    }
  };

  // 5️⃣ Funkcija: Pradėti įrašymą
  const startRecording = () => {
    recorder.start().then(() => {
      setIsRecording(true);
    }).catch((e) => console.error(e));
  };

  // 6️⃣ Funkcija: Sustabdyti įrašymą ir siųsti į STT
  const stopRecording = () => {
    recorder.stop().getMp3().then(([buffer, blob]) => {
      const file = new File(buffer, "audio.mp3", {
        type: blob.type,
        lastModified: Date.now()
      });
      sendToSTT(file);
      setIsRecording(false);
    }).catch((e) => console.error(e));
  };

  // 7️⃣ Funkcija: Siųsti į ElevenLabs STT (balsas → tekstas)
  const sendToSTT = async (audioFile) => {
    try {
      const formData = new FormData();
      formData.append("audio", audioFile);

      const res = await axios.post(
        "https://api.elevenlabs.io/v1/speech-to-text",
        formData,
        {
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "multipart/form-data"
          }
        }
      );

      const transcribedText = res.data.text;
      setMessage(transcribedText);     // rodom tekstą UI
      sendMessage(transcribedText);    // siunčiam į n8n agentą
    } catch (error) {
      console.error("STT klaida:", error);
      setResponse("Nepavyko atpažinti kalbos.");
    }
  };

  // 8️⃣ UI (return)
  return (
    <div style={{ padding: 20 }}>
      <h1>🧠 Pokalbių agentas</h1>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Įvesk klausimą..."
        style={{ width: "300px", marginRight: "10px" }}
      />
      <button onClick={() => sendMessage()}>Siųsti</button>

      {/* 🎙️ Mikrofono mygtukas */}
      <button onClick={isRecording ? stopRecording : startRecording}>
  {isRecording ? "⏹ Sustabdyti" : "🎙 Kalbėti"}
</button>


      <p><b>AI atsakymas:</b> {response}</p>
    </div>
  );
}

export default App;
