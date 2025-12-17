import React, { useState, useRef } from "react";
import axios from "axios";

function App() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const apiKey = process.env.REACT_APP_ELEVEN_API_KEY;
  const voiceId = "JBFqnCBsd6RMkjVDRZzb"; // Rachel voice

  // 🔊 ElevenLabs TTS (tekstas → balsas)
  const speak = async (text) => {
    try {
      const res = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        { 
          text, 
          model_id: "eleven_multilingual_v2" 
        },
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

  // 🔗 Siųsti tekstą į n8n webhook
  const sendMessage = async (textToSend = message) => {
    if (!textToSend.trim()) return;
    
    setIsProcessing(true);
    try {
      const res = await axios.post(
        "https://evaldys.app.n8n.cloud/webhook-test/b432e7fa-98e4-43f4-8d0c-eaf7d2b25789",
        { transcription: textToSend }
      );

      console.log("n8n atsakymas:", res.data);
      
      // Bandome rasti AI atsakymą įvairiuose laukuose
      const aiResponse = res.data.message?.text || 
                         res.data.response || 
                         res.data.text || 
                         res.data.output ||
                         (typeof res.data === 'string' ? res.data : null);
      
      if (aiResponse && !aiResponse.includes('http')) {
        setResponse(aiResponse);
        speak(aiResponse);
      } else {
        console.error("Neteisingas atsakymo formatas:", res.data);
        setResponse("n8n grąžina neteisingą formatą. Patikrinkite workflow Response Mode.");
      }
    } catch (error) {
      console.error("Webhook klaida:", error);
      setResponse("Įvyko klaida jungiantis prie agento.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 🎙️ Pradėti įrašymą
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Bandome sukurti MediaRecorder su MP3, jei nepavyksta - su webm
      let options = { mimeType: 'audio/webm' };
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
      }
      
      mediaRecorderRef.current = new MediaRecorder(stream, options);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: options.mimeType });
        await sendToSTT(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Mikrofono klaida:", error);
      alert("Nepavyko pasiekti mikrofono. Patikrinkite leidimus.");
    }
  };

  // ⏹ Sustabdyti įrašymą
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // 🎧 Siųsti į ElevenLabs STT (balsas → tekstas)
  const sendToSTT = async (audioBlob) => {
    setIsProcessing(true);
    try {
      // Nustatome failo pavadinimą pagal MIME tipą
      const fileName = audioBlob.type.includes('webm') ? 'audio.webm' : 'audio.mp3';
      
      const formData = new FormData();
      formData.append("file", audioBlob, fileName);
      formData.append("model_id", "scribe_v1");

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
      setMessage(transcribedText);
      await sendMessage(transcribedText);
    } catch (error) {
      console.error("STT klaida:", error.response?.data || error.message);
      const errorMsg = error.response?.data?.detail?.message || 
                       error.response?.data?.message || 
                       JSON.stringify(error.response?.data) || 
                       error.message;
      setResponse(`STT klaida: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ 
      padding: 40, 
      maxWidth: 600, 
      margin: "0 auto",
      fontFamily: "Arial, sans-serif" 
    }}>
      <h1 style={{ textAlign: "center" }}>💬 Pokalbių agentas</h1>
      
      <div style={{ marginBottom: 20 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Įvesk klausimą arba spausk mikrofono mygtuką..."
          style={{ 
            width: "calc(100% - 120px)", 
            padding: 10, 
            fontSize: 16,
            marginRight: 10 
          }}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={isProcessing}
        />
        <button 
          onClick={() => sendMessage()}
          style={{ 
            padding: 10, 
            fontSize: 16,
            cursor: isProcessing ? "not-allowed" : "pointer"
          }}
          disabled={isProcessing || !message.trim()}
        >
          📤 Siųsti
        </button>
      </div>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          style={{ 
            padding: "15px 30px", 
            fontSize: 18,
            backgroundColor: isRecording ? "#ff4444" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: 50,
            cursor: isProcessing ? "not-allowed" : "pointer"
          }}
          disabled={isProcessing}
        >
          {isRecording ? "⏹ Sustabdyti" : "🎙 Kalbėti"}
        </button>
      </div>

      {isProcessing && (
        <p style={{ textAlign: "center", color: "#666" }}>
          ⏳ Apdorojama...
        </p>
      )}

      {response && (
        <div style={{ 
          backgroundColor: "#f0f0f0", 
          padding: 15, 
          borderRadius: 10,
          marginTop: 20 
        }}>
          <p><b>🤖 AI atsakymas:</b></p>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}

export default App;
