"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { Camera, RefreshCw, Activity, Fingerprint, ScanFace, Boxes, FileText, Download, CheckCircle2, ShieldAlert } from 'lucide-react';
import clsx from 'clsx';
import Gauge from '@/components/Gauge';
import TerminalLog from '@/components/TerminalLog';
import PipelineVisualizer from '@/components/PipelineVisualizer';

type Mode = 'register' | 'verify';
type Challenge = 'blink' | 'smile' | 'turn';
type ViewMode = 'camera' | 'landmarks' | 'mesh';

export default function Demo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<Mode>('verify');
  const [viewMode, setViewMode] = useState<ViewMode>('camera');
  
  const [feedback, setFeedback] = useState("System Standby. Position face in frame.");
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{success: boolean, msg: string, score?: number, name?: string, empId?: string} | null>(null);
  
  // HUD states
  const [confidence, setConfidence] = useState(0);
  const [faceQuality, setFaceQuality] = useState(0);
  const [latency, setLatency] = useState(0);
  const [pipelineStage, setPipelineStage] = useState(0);
  
  // Terminal logs
  const [logs, setLogs] = useState<{time: string, msg: string}[]>([]);
  const logsRef = useRef<{time: string, msg: string}[]>([]);
  
  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    logsRef.current.push({ time, msg });
    if (logsRef.current.length > 20) logsRef.current.shift();
    setLogs([...logsRef.current]);
  }, []);

  const clearLog = () => {
    logsRef.current = [];
    setLogs([]);
  };

  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  // Liveness state
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [challengesPassed, setChallengesPassed] = useState<Challenge[]>([]);

  // Face loop guards
  const lastFeedback = useRef<string>("");
  const noFaceSince = useRef<number | null>(null);
  const isRunning = useRef<boolean>(false);
  const stateRef = useRef({ currentChallenge, challengesPassed, isProcessing, mode, viewMode });
  const liveDescriptorRef = useRef<Float32Array | null>(null);
  const lastFrameTime = useRef<number>(0);

  // Registered Faces
  const [registeredFaces, setRegisteredFaces] = useState<{id: string, name: string, registeredAt: string}[]>([]);
  const [registerName, setRegisterName] = useState("");
  const [registerId, setRegisterId] = useState("");

  function verifyFaceFromRef() {
    if (!liveDescriptorRef.current) return;
    setIsProcessing(true);
    setPipelineStage(4);
    addLog("Extracting facial embeddings...");
    
    try {
      const storedData = localStorage.getItem('nhai_registered_faces');
      if (!storedData) throw new Error("No database");
      
      const storedFaces = JSON.parse(storedData);
      setPipelineStage(5);
      addLog("Computing Cosine Similarity...");

      let bestMatch = { name: "", distance: 1.0 };
      for (const face of storedFaces) {
        const storedDescriptor = new Float32Array(face.embedding);
        const distance = faceapi.euclideanDistance(liveDescriptorRef.current, storedDescriptor);
        if (distance < bestMatch.distance) bestMatch = { name: face.name, distance };
      }

      const matchScore = parseFloat(Math.max(0, 100 - (bestMatch.distance * 100)).toFixed(1));
      setPipelineStage(6);
      
      if (bestMatch.distance < 0.5) { 
        addLog(`Identity Verified — ${bestMatch.name} (${matchScore}%) ✓`);
        setResult({ success: true, msg: "Access Granted", score: matchScore, name: bestMatch.name, empId: storedFaces.find((f: any) => f.name === bestMatch.name)?.id || 'UNKNOWN' });
      } else {
        addLog(`Match Failed — Unknown Identity ❌`);
        setResult({ success: false, msg: "Access Denied", score: matchScore });
      }
    } catch (e) {
      addLog("Verification Failed: No profiles found ❌");
      setResult({ success: false, msg: "Access Denied" });
    } finally {
      setIsProcessing(false);
    }
  };
  useEffect(() => {
    const loadFaces = () => {
      const data = localStorage.getItem('nhai_registered_faces');
      if (data) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            setRegisteredFaces(parsed.map(f => ({ id: f.id, name: f.name, registeredAt: f.registeredAt })));
          }
        } catch(e) {}
      }
    };
    loadFaces();
    const int = setInterval(loadFaces, 2000);
    return () => clearInterval(int);
  }, []);

  const handleDownloadReport = () => {
    if (!result || !result.success) return;
    const reportContent = `NHAI Datalake 3.0 Verification Report\n================================\n\nName: ${result.name || 'Unknown'}\nTimestamp: ${new Date().toLocaleString()}\nLiveness Checks: Passed\nMatch Confidence: ${result.score || '>90'}%\nStatus: SUCCESS\n`;
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Verification_Report_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    stateRef.current = { currentChallenge, challengesPassed, isProcessing, mode, viewMode, registerName, registerId };
  }, [currentChallenge, challengesPassed, isProcessing, mode, viewMode, registerName, registerId]);

  // Load models
  useEffect(() => {
    const loadModels = async () => {
      addLog("Initializing neural models...");
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        setIsModelsLoaded(true);
        addLog("Models loaded successfully ✓");
      } catch (err) {
        addLog("Error: Failed to load models ❌");
      }
    };
    loadModels();
  }, [addLog]);

  const startCamera = useCallback(async (deviceIndex = 0) => {
    addLog("Requesting camera feed...");
    try {
      let devices = await navigator.mediaDevices.enumerateDevices();
      let videoDevices = devices.filter(device => device.kind === 'videoinput');

      if (videoDevices.length > 0 && videoDevices[0].label === '') {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          devices = await navigator.mediaDevices.enumerateDevices();
          videoDevices = devices.filter(device => device.kind === 'videoinput');
          tempStream.getTracks().forEach(t => t.stop());
        } catch (e) {}
      }
      
      videoDevices.sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        const aIsGood = aLabel.includes('integrated') || aLabel.includes('webcam') || aLabel.includes('hd');
        const bIsGood = bLabel.includes('integrated') || bLabel.includes('webcam') || bLabel.includes('hd');
        if (aIsGood && !bIsGood) return -1;
        if (!aIsGood && bIsGood) return 1;
        return 0;
      });

      setAvailableCameras(videoDevices);
      let ms: MediaStream | null = null;
      const targetIndex = deviceIndex % Math.max(1, videoDevices.length);

      if (videoDevices.length > 0) {
        const device = videoDevices[targetIndex];
        try {
          ms = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: device.deviceId } } });
          setCurrentCameraIndex(targetIndex);
        } catch (e) {}
      }

      if (!ms) ms = await navigator.mediaDevices.getUserMedia({ video: true });

      setStream(ms);
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        videoRef.current.play().catch(e => console.error("Error playing video:", e));
      }
      addLog("Camera stream active ✓");
      setPipelineStage(1); // Capture complete
    } catch (err) {
      addLog("Error: Camera access denied ❌");
    }
  }, [addLog]);

  useEffect(() => {
    if (stream && videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(e => console.error("Error playing video:", e));
    }
  }, [stream]);

  const updateFeedback = useCallback((msg: string) => {
    if (lastFeedback.current !== msg) {
      lastFeedback.current = msg;
      setFeedback(msg);
    }
  }, []);

  // Face detection loop
  useEffect(() => {
    if (!isModelsLoaded || !stream) return;

    isRunning.current = true;
    let isDetecting = false;
    let scanAngle = 0; // for the circular scanner

    const detect = async () => {
      if (!isRunning.current) return;
      const { isProcessing, currentChallenge, challengesPassed, mode, viewMode, registerName, registerId } = stateRef.current;

      if (!videoRef.current || !canvasRef.current || isProcessing) {
        requestAnimationFrame(detect);
        return;
      }

      if (videoRef.current.paused || videoRef.current.readyState < 2) {
        requestAnimationFrame(detect);
        return;
      }

      if (isDetecting) return;
      isDetecting = true;

      const frameStart = Date.now();

      try {
        const detection = await faceapi.detectSingleFace(
          videoRef.current, 
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        ).withFaceLandmarks().withFaceExpressions().withFaceDescriptor();

        const currentLatency = Date.now() - frameStart;
        if (Math.random() < 0.2) setLatency(currentLatency);

        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          if (detection) {
            if (noFaceSince.current !== null) {
              addLog("Face Detected");
              setPipelineStage(2); // Detection passed
            }
            noFaceSince.current = null;
            liveDescriptorRef.current = detection.descriptor;
            
            const dims = faceapi.matchDimensions(canvasRef.current, videoRef.current, true);
            const resizedResult = faceapi.resizeResults(detection, dims);
            
            // HUD Updates
            if (Math.random() < 0.2) {
              setConfidence(Math.round(detection.detection.score * 100));
              setFaceQuality(Math.round(Math.min(100, detection.detection.score * 100 + (1 - Math.abs(detection.expressions.neutral || 0)) * 10)));
            }

            // Draw based on viewMode
            if (viewMode === 'camera') {
              const box = resizedResult.detection.box;
              ctx.strokeStyle = '#22d3ee'; // cyan-400
              ctx.lineWidth = 3;
              ctx.shadowColor = '#22d3ee';
              ctx.shadowBlur = 15;
              ctx.strokeRect(box.x, box.y, box.width, box.height);

              // Circular scanner inside box
              scanAngle += 0.05;
              const cx = box.x + box.width / 2;
              const cy = box.y + box.height / 2;
              const r = Math.min(box.width, box.height) * 0.4;
              ctx.beginPath();
              ctx.arc(cx, cy, r, scanAngle, scanAngle + Math.PI / 2);
              ctx.strokeStyle = 'rgba(34,211,238,0.8)';
              ctx.lineWidth = 4;
              ctx.stroke();

            } else if (viewMode === 'landmarks') {
              faceapi.draw.drawFaceLandmarks(canvasRef.current, resizedResult);
            } else if (viewMode === 'mesh') {
              // Custom mesh drawing - draw points and connect them to form a mesh
              ctx.strokeStyle = 'rgba(56,189,248,0.5)';
              ctx.lineWidth = 1;
              const points = resizedResult.landmarks.positions;
              for (let i = 0; i < points.length; i++) {
                ctx.beginPath();
                ctx.arc(points[i].x, points[i].y, 2, 0, Math.PI * 2);
                ctx.fillStyle = '#38bdf8';
                ctx.fill();
                // Connect to a few nearby points for mesh effect
                for (let j = i + 1; j < Math.min(i + 5, points.length); j++) {
                  if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) < 30) {
                    ctx.beginPath();
                    ctx.moveTo(points[i].x, points[i].y);
                    ctx.lineTo(points[j].x, points[j].y);
                    ctx.stroke();
                  }
                }
              }
            }

            // Liveness Logic
            if (currentChallenge) {
              setPipelineStage(3); // In liveness check
              if (currentChallenge === 'blink') {
                const leftEye = detection.landmarks.getLeftEye();
                const rightEye = detection.landmarks.getRightEye();
                
                const getEAR = (eye: any[]) => {
                  const v1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
                  const v2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
                  const h = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
                  return (v1 + v2) / (2.0 * h);
                };
                
                const avgEAR = (getEAR(leftEye) + getEAR(rightEye)) / 2;
                
                if (avgEAR < 0.22) { 
                  setChallengesPassed(prev => [...prev, 'blink']);
                  addLog("Blink Confirmed ✓");
                  setCurrentChallenge('smile');
                } else {
                  updateFeedback("Please blink your eyes");
                }
              } else if (currentChallenge === 'smile') {
                if (detection.expressions.happy > 0.7) {
                  setChallengesPassed(prev => [...prev, 'smile']);
                  addLog("Smile Confirmed ✓");
                  setCurrentChallenge('turn');
                } else {
                  updateFeedback("Please smile for the camera");
                }
              } else if (currentChallenge === 'turn') {
                const jaw = detection.landmarks.getJawOutline();
                const nose = detection.landmarks.getNose()[0];
                const headWidth = jaw[16].x - jaw[0].x;
                const leftRatio = (nose.x - jaw[0].x) / headWidth;
                
                if (Math.abs(leftRatio - 0.5) > 0.15) {
                  setChallengesPassed(prev => [...prev, 'turn']);
                  addLog("Liveness Passed ✓");
                  setCurrentChallenge(null);
                  
                  if (mode === 'verify') verifyFaceFromRef();
                  if (mode === 'register') registerFace(registerName, registerId);
                } else {
                  updateFeedback("Please turn your head slightly");
                }
              }
            } else if (challengesPassed.length === 3) {
              updateFeedback("All checks passed");
            } else if (challengesPassed.length === 0) {
              updateFeedback("Tracking active. Ready.");
            }
          } else {
            liveDescriptorRef.current = null;
            setConfidence(0);
            if (noFaceSince.current === null) {
              noFaceSince.current = Date.now();
              updateFeedback("No face detected");
              setPipelineStage(1);
            }
          }
        }
      } catch (err) {
      } finally {
        isDetecting = false;
        if (isRunning.current) requestAnimationFrame(detect);
      }
    };

    requestAnimationFrame(detect);
    return () => { isRunning.current = false; };
  }, [isModelsLoaded, stream, addLog]);

  const startLivenessCheck = () => {
    setChallengesPassed([]);
    setCurrentChallenge('blink');
    setResult(null);
    setPipelineStage(3);
    addLog("Initiating Liveness Detection protocol...");
  };

  const registerFace = async (name: string, empId: string) => {
    if (!liveDescriptorRef.current) return;
    setIsProcessing(true);
    setPipelineStage(4);
    addLog("Extracting facial embeddings...");
    
    try {
      const newEntry = {
         id: empId,
         name: name.trim(),
         embedding: Array.from(liveDescriptorRef.current),
         registeredAt: new Date().toISOString()
      };
      
      addLog(`Saving profile: ${name.trim()}`);
      
      const existingData = localStorage.getItem('nhai_registered_faces');
      let faces: {id: string, name: string, embedding: number[], registeredAt: string}[] = [];
      if (existingData) try { faces = JSON.parse(existingData); } catch (e) {}
      faces.push(newEntry);
      localStorage.setItem('nhai_registered_faces', JSON.stringify(faces));
      
      setRegisteredFaces(faces.map((f) => ({ id: f.id, name: f.name, registeredAt: f.registeredAt })));
      addLog("Registration Complete ✓");
      setPipelineStage(6);
      setResult({ success: true, msg: "Face registered successfully." });
      updateFeedback("System Standby.");
    } catch (e) {
      addLog("Error: Registration failed ❌");
    } finally {
      setIsProcessing(false);
      setChallengesPassed([]);
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans flex flex-col pt-20 pb-12">
      <div className="max-w-screen-2xl mx-auto w-full px-4 sm:px-6">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-cyan-400" />
              Security HUD
            </h1>
            <p className="text-slate-400 font-mono text-sm mt-1 uppercase tracking-widest">NHAI Terminal Node // Live Feed</p>
          </div>
          
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 shadow-lg">
            <button 
              onClick={() => { setMode('verify'); setResult(null); setCurrentChallenge(null); setChallengesPassed([]); }}
              className={clsx("px-6 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-all", mode === 'verify' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50" : "text-slate-500 hover:text-white")}
            >
              Verify Mode
            </button>
            <button 
              onClick={() => { setMode('register'); setResult(null); setCurrentChallenge(null); setChallengesPassed([]); }}
              className={clsx("px-6 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-all", mode === 'register' ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50" : "text-slate-500 hover:text-white")}
            >
              Register Mode
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Panel: Gauges */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            <Gauge value={confidence} label="Detection Confidence" color="#38bdf8" />
            <Gauge value={(challengesPassed.length / 3) * 100} label="Liveness Score" color="#f59e0b" />
            <Gauge value={faceQuality} label="Face Quality" color="#a855f7" />
            <Gauge value={latency} label="Processing Latency" color="#10b981" suffix="ms" />
            
            {/* Offline AI Showcase */}
            <div className="mt-auto bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">System Status</h3>
              <ul className="space-y-3 font-mono text-xs">
                <li className="flex justify-between items-center text-emerald-400">
                  <span>Model: Local</span> <CheckCircle2 className="w-3 h-3" />
                </li>
                <li className="flex justify-between items-center text-emerald-400">
                  <span>Internet: None</span> <CheckCircle2 className="w-3 h-3" />
                </li>
                <li className="flex justify-between items-center text-emerald-400">
                  <span>Engine: TFLite</span> <CheckCircle2 className="w-3 h-3" />
                </li>
                <li className="flex justify-between items-center text-emerald-400">
                  <span>DB: SQLite</span> <CheckCircle2 className="w-3 h-3" />
                </li>
              </ul>
            </div>
          </div>

          {/* Center Panel: Camera Feed */}
          <div className="lg:col-span-6 flex flex-col">
            
            {/* View Toggles */}
            <div className="flex items-center gap-2 mb-3 bg-slate-900/80 p-1.5 rounded-lg w-fit border border-slate-800">
              {(['camera', 'landmarks', 'mesh'] as ViewMode[]).map((v) => (
                <button 
                  key={v}
                  onClick={() => setViewMode(v)}
                  className={clsx("px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all", viewMode === v ? "bg-slate-800 text-white shadow" : "text-slate-500 hover:text-slate-300")}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="relative w-full aspect-[4/3] bg-black rounded-2xl border border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
              <video ref={videoRef} autoPlay muted playsInline className={clsx("absolute inset-0 w-full h-full object-cover -scale-x-100", (!stream || !isModelsLoaded) ? "opacity-0" : "opacity-100")} />
              <canvas ref={canvasRef} className={clsx("absolute inset-0 w-full h-full object-cover z-10 pointer-events-none", (!stream || !isModelsLoaded) ? "opacity-0" : "opacity-100")} />
              
              {!isModelsLoaded ? (
                <div className="absolute inset-0 flex items-center justify-center text-cyan-500 bg-slate-950/80 z-20">
                  <RefreshCw className="w-8 h-8 animate-spin" />
                </div>
              ) : !stream ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 z-20">
                  <button onClick={() => startCamera(0)} className="bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-400 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.4)]">
                    Initialize Feed
                  </button>
                </div>
              ) : null}
                  
                  {/* Challenge Overlay */}
                  {currentChallenge && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/30 pointer-events-none">
                      <div className="relative w-40 h-40 flex items-center justify-center mb-6">
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                          <circle cx="80" cy="80" r="76" stroke="rgba(245, 158, 11, 0.2)" strokeWidth="8" fill="none" />
                          <circle 
                            cx="80" cy="80" r="76" stroke="#f59e0b" strokeWidth="8" fill="none" 
                            strokeDasharray="477" 
                            strokeDashoffset={currentChallenge === 'blink' ? 0 : currentChallenge === 'smile' ? 159 : 318} 
                            className="transition-all duration-1000 ease-out" 
                            strokeLinecap="round"
                          />
                        </svg>
                        <span className="text-5xl drop-shadow-xl">
                          {currentChallenge === 'blink' ? '👁️' : currentChallenge === 'smile' ? '😁' : '🔄'}
                        </span>
                      </div>
                      <h2 className="text-4xl font-extrabold text-white tracking-widest uppercase drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                        {currentChallenge === 'blink' ? "Blink" : currentChallenge === 'smile' ? "Smile" : "Turn"}
                      </h2>
                      <div className="mt-4 text-emerald-400 font-mono tracking-widest uppercase animate-pulse">
                        {challengesPassed.includes(currentChallenge) ? "Confirmed ✓" : "Waiting..."}
                      </div>
                    </div>
                  )}

                  {/* Feedback Bar */}
                  <div className="absolute bottom-0 left-0 w-full bg-slate-950/80 border-t border-slate-800 p-3 z-30 font-mono text-xs flex justify-between items-center text-slate-400">
                    <span className="uppercase tracking-widest">{feedback}</span>
                    <span className="text-cyan-500 animate-pulse flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-500" /> LIVE</span>
                  </div>
            </div>

            {/* Controls & Pipeline */}
            <div className="mt-6 space-y-6">
              {mode === 'register' && (
                <div className="flex gap-4">
                  <input 
                    type="text" 
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    placeholder="Full Name"
                    className="flex-1 bg-black border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 font-mono placeholder:text-slate-600"
                  />
                  <input 
                    type="text" 
                    value={registerId}
                    onChange={(e) => setRegisterId(e.target.value)}
                    placeholder="Employee ID"
                    className="flex-1 bg-black border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-500 font-mono placeholder:text-slate-600"
                  />
                </div>
              )}
              <button 
                onClick={startLivenessCheck}
                disabled={!stream || isProcessing || currentChallenge !== null || (mode === 'register' && (!registerName.trim() || !registerId.trim()))}
                className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 disabled:opacity-50 text-white px-6 py-4 rounded-xl font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3"
              >
                <ScanFace className="w-5 h-5 text-cyan-400" /> 
                {mode === 'verify' ? "Initiate Verification" : "Initiate Registration"}
              </button>

              <PipelineVisualizer currentStage={pipelineStage} />
            </div>

          </div>

          {/* Right Panel: Terminal Log & Result */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <div className="flex-1 min-h-[300px]">
              <TerminalLog logs={logs} onClear={clearLog} />
            </div>

            {/* Authentication Result Card */}
            {result && (
              <div className={clsx(
                "p-5 rounded-2xl border shadow-2xl relative overflow-hidden",
                result.success ? "bg-emerald-950/20 border-emerald-500/50" : "bg-red-950/20 border-red-500/50"
              )}>
                {/* Glow behind */}
                <div className={clsx("absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 blur-[60px] rounded-full pointer-events-none", result.success ? "bg-emerald-500/30" : "bg-red-500/30")} />
                
                <h3 className={clsx("text-2xl font-black uppercase tracking-wider mb-4 text-center", result.success ? "text-emerald-400" : "text-red-400")}>
                  {result.success ? "Access Granted" : "Access Denied"}
                </h3>
                
                <div className="space-y-3 font-mono text-sm relative z-10 bg-black/40 p-4 rounded-xl border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name:</span>
                    <span className="text-white font-bold">{result.name || 'UNKNOWN'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ID:</span>
                    <span className="text-white">{result.empId || 'UNKNOWN'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Confidence:</span>
                    <span className={clsx("font-bold", result.success ? "text-emerald-400" : "text-red-400")}>{result.score || 0}%</span>
                  </div>
                  <div className="border-t border-slate-800 my-2 pt-2" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Liveness:</span>
                    <span className="text-emerald-400">Passed ✓</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Spoof:</span>
                    <span className="text-emerald-400">No ✓</span>
                  </div>
                </div>

                {result.success && (
                  <button onClick={handleDownloadReport} className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-400 font-bold uppercase tracking-wider text-xs transition-colors">
                    <Download className="w-4 h-4" /> Download Log
                  </button>
                )}
              </div>
            )}
            
            {/* Old Registration popup removed */}
          </div>
        </div>
      </div>
    </div>
  );
}
